/**
 * 文件监听（chokidar）+ 自写抑制（基于内容哈希，与时序无关）。
 *
 * 监听文件的**父目录**（非递归）；事件回调把变更路径 canonical 化后只放行已登记的文件；
 * 父目录引用计数，最后一个文件 unwatch 时释放目录监听。emit 时回传**原始路径**（用户传入的字符串），
 * 避免 macOS /tmp→/private/tmp 这类符号链接导致 renderer 的 tab.filePath 对不上。
 *
 * 自写/无实质变化抑制（取代旧的「写盘后 N ms 内忽略」时间窗口方案）：
 *  为每个被监听文件记录「我们已知的内容哈希」——writeFile 写盘后登记**所写字节**的哈希，watchFile 时
 *  以当前磁盘内容初始化。事件触发时**读取磁盘实际内容**并与已知哈希比对：相等 ⇒ 是本应用自写的回声
 *  或无实质变化 ⇒ 静默丢弃；不等 ⇒ 更新已知哈希并上报一次。
 *  如此不再依赖「fsevents 回声落在某个时间窗口内」这一脆弱假设（macOS 上 fsevents 合并/延迟可超过窗口，
 *  导致「保存即误报 文件已被外部修改」），彻底根治该误报。
 */
import { watch, type FSWatcher } from "chokidar";
import { createHash } from "node:crypto";
import { promises as fs, realpathSync } from "node:fs";
import path from "node:path";
import { emitEvent } from "../../ipc/emit";

// ── 已知内容哈希注册表 ──────────────────────────────────────────────
// 键 = 路径（canonical 与 resolve 两种形式各登记一份，应对符号链接/路径归一差异）；
// 值 = 我们认为该文件当前在磁盘上的内容哈希（最近一次自写，或最近一次上报的外部内容）。
const knownHashes = new Map<string, string>();

function hashBytes(bytes: Buffer | Uint8Array): string {
  return createHash("sha1").update(bytes).digest("hex");
}

async function hashFile(p: string): Promise<string | null> {
  try {
    return hashBytes(await fs.readFile(p));
  } catch {
    return null; // 文件被删 / 不可读
  }
}

/** 该路径的两种形式（resolve 未解析符号链接 + canonical 解析符号链接），去重后返回。 */
function pathForms(filePath: string): string[] {
  const resolved = path.resolve(filePath);
  const canon = canonical(filePath);
  return resolved === canon ? [resolved] : [resolved, canon];
}

/**
 * 记录一次自写：由 file-ops.writeFile 在写盘后调用，传入**实际写入的字节**。
 * 登记所写内容的哈希，使随之而来的、内容与此一致的 watcher 变更事件被识别为自写回声并抑制。
 */
export function markSelfWrite(filePath: string, bytes: Buffer | Uint8Array): void {
  const h = hashBytes(bytes);
  for (const k of pathForms(filePath)) knownHashes.set(k, h);
}

// ── 监听状态 ────────────────────────────────────────────────────────
let watcher: FSWatcher | null = null;
/** canonical 文件路径 → 原始（用户传入）路径字符串。 */
const watchedFiles = new Map<string, string>();
/** canonical 父目录 → 该目录下被监听文件的引用计数。 */
const watchedDirs = new Map<string, number>();

function canonical(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    // 文件被删时 realpath 失败 —— 回退 resolve，仍能据此通知 renderer。
    return path.resolve(p);
  }
}

function ensureWatcher(): FSWatcher {
  if (watcher) return watcher;
  watcher = watch([], { ignoreInitial: true, depth: 0, persistent: true });
  const onEvent = (changedPath: string): void => {
    const canon = canonical(changedPath);
    const original = watchedFiles.get(canon);
    if (original === undefined) return; // 非关注文件（同目录兄弟）
    void evaluateChange(changedPath, canon, original);
  };
  // change：直接覆盖写；add：原子保存（写 .tmp + rename 到位）会触发 add；unlink：外部删除。
  watcher.on("change", onEvent);
  watcher.on("add", onEvent);
  watcher.on("unlink", onEvent);
  return watcher;
}

/**
 * 读取磁盘当前内容并与「已知哈希」比对，决定是否上报：
 *  - 文件已被删/不可读 → 真实变化，上报并清除已知哈希；
 *  - 磁盘内容 === 已知哈希 → 自写回声 / 无实质变化 → 抑制；
 *  - 不等 → 真实外部变化，更新已知哈希（令同一内容的重复事件不再二次上报）并上报一次。
 */
async function evaluateChange(
  changedPath: string,
  canon: string,
  original: string,
): Promise<void> {
  // 仅处理仍在监听中的文件（unwatch 后到达的延迟事件直接忽略）。
  if (!watchedFiles.has(canon)) return;
  const current = await hashFile(changedPath);
  if (current === null) {
    for (const k of pathForms(original)) knownHashes.delete(k);
    knownHashes.delete(canon);
    emitEvent("eidon:file-changed", original);
    return;
  }
  const known = knownHashes.get(canon) ?? knownHashes.get(path.resolve(original));
  if (known === current) return; // 磁盘内容与我们已知的一致 ⇒ 抑制
  knownHashes.set(canon, current);
  knownHashes.set(path.resolve(original), current);
  emitEvent("eidon:file-changed", original);
}

export function watchFile(filePath: string): void {
  const canon = canonical(filePath);
  const parent = path.dirname(canon);
  if (watchedFiles.has(canon)) {
    // 已在监听同一 canonical 文件：刷新原始路径别名即可（不重复注册目录）。
    watchedFiles.set(canon, filePath);
    return;
  }
  watchedFiles.set(canon, filePath);
  // 以当前磁盘内容初始化已知哈希，避免「开监听后首个无实质变化的事件」被误判为外部修改。
  // 自写哈希更权威：仅在期间未被自写覆盖时落库。
  if (!knownHashes.has(canon)) {
    void hashFile(canon).then((h) => {
      if (h !== null && !knownHashes.has(canon)) {
        knownHashes.set(canon, h);
        knownHashes.set(path.resolve(filePath), h);
      }
    });
  }
  const count = (watchedDirs.get(parent) ?? 0) + 1;
  watchedDirs.set(parent, count);
  const w = ensureWatcher();
  if (count === 1) w.add(parent); // 该目录首个文件 → 注册 OS 监听
}

export function unwatchFile(filePath: string): void {
  const canon = canonical(filePath);
  const parent = path.dirname(canon);
  if (!watchedFiles.delete(canon)) return; // 本就没监听
  for (const k of pathForms(filePath)) knownHashes.delete(k);
  knownHashes.delete(canon);
  const count = (watchedDirs.get(parent) ?? 0) - 1;
  if (count <= 0) {
    watchedDirs.delete(parent);
    void watcher?.unwatch(parent); // 该目录最后一个文件 → 释放 OS 监听
  } else {
    watchedDirs.set(parent, count);
  }
}
