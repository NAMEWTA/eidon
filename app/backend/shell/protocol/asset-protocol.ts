/**
 * `eidon-asset://` 自定义资产协议。
 *
 * 渲染层经 `src/ipc` 的 convertFileSrc(absPath) 生成 `eidon-asset://local/<encodeURI(path)>`；
 * 本协议解码为绝对路径并伺服文件字节。安全：①必须绝对路径、拒 `..` 穿越；②收紧到已登记 workspace 根
 * （旧实现 scope 过宽）。根经 backend/shell/index 在工作区打开类调用（kn:indexInit/git:status/git:init）登记。
 */
import { protocol, net } from "electron";
import path from "node:path";

export const ASSET_SCHEME = "eidon-asset";

const allowedRoots = new Set<string>();

/** 登记一个允许伺服的 workspace 根（绝对路径）。 */
export function addAllowedRoot(dir: string): void {
  if (dir) allowedRoots.add(path.resolve(dir));
}

/** app ready 前调用：声明协议为 standard + secure + fetch + stream。 */
export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);
}

/** app ready 后调用：注册 protocol.handle。 */
export function handleAssetProtocol(): void {
  protocol.handle(ASSET_SCHEME, async (request) => {
    const filePath = urlToPath(request.url);
    if (!filePath) return new Response("bad request", { status: 400 });
    if (!isAllowed(filePath)) return new Response("forbidden", { status: 403 });
    try {
      // net.fetch 经 file:// 高效流式伺服（支持 Range / 大图），并自动推断 Content-Type。
      return await net.fetch(pathToFileUrl(filePath));
    } catch {
      return new Response("not found", { status: 404 });
    }
  });
}

/** `eidon-asset://local/<encodeURI(path)>` → 绝对文件路径；非法返回 null。 */
function urlToPath(rawUrl: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    return null;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  // Windows 盘符：`/C:/x/a.png` → `C:/x/a.png`。
  if (/^\/[A-Za-z]:/.test(decoded)) decoded = decoded.slice(1);
  const resolved = path.normalize(decoded);
  // 必须绝对路径；normalize 已折叠 `..`，再核验未含残留穿越段。
  if (!path.isAbsolute(resolved)) return null;
  if (resolved.split(/[\\/]/).includes("..")) return null;
  return resolved;
}

function isAllowed(filePath: string): boolean {
  // 尚无登记根（M5 接通前）：放行任意绝对路径。
  if (allowedRoots.size === 0) return true;
  const resolved = path.resolve(filePath);
  for (const root of allowedRoots) {
    if (resolved === root) return true;
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (resolved.startsWith(prefix)) return true;
  }
  return false;
}

function pathToFileUrl(filePath: string): string {
  const forward = filePath.replace(/\\/g, "/");
  const withLead = forward.startsWith("/") ? forward : `/${forward}`;
  return `file://${encodeURI(withLead)}`;
}
