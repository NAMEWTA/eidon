/**
 * Pandoc 导出驱动。
 *
 * 不打包 pandoc：在 PATH 上查找，缺失时给结构化错误。pandoc_detect 返回 {path,version}|null；
 * pandoc_export 把 markdown 写临时文件后跑 pandoc（可选 --citeproc/--bibliography/--csl/--template/extra）。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PandocInfo, PandocExportArgs } from "@shared/models";

const execFileP = promisify(execFile);
const isWindows = process.platform === "win32";

/** 在 PATH 上定位 pandoc（POSIX 还会探测常见安装位置，因 GUI 应用 PATH 常被裁剪）。 */
async function locatePandoc(): Promise<string | null> {
  try {
    const { stdout } = await execFileP(isWindows ? "where" : "which", ["pandoc"]);
    const first = stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (first) return first;
  } catch {
    // which/where 未命中，继续探测候选路径
  }
  if (!isWindows) {
    for (const c of [
      "/opt/homebrew/bin/pandoc",
      "/usr/local/bin/pandoc",
      "/usr/bin/pandoc",
    ]) {
      try {
        await fs.access(c);
        return c;
      } catch {
        /* 继续 */
      }
    }
  }
  return null;
}

export async function pandocDetect(): Promise<PandocInfo | null> {
  const pandocPath = await locatePandoc();
  if (!pandocPath) return null;
  try {
    const { stdout } = await execFileP(pandocPath, ["--version"]);
    const firstLine = stdout.split(/\r?\n/)[0]?.trim() ?? "";
    const version = firstLine.startsWith("pandoc ")
      ? firstLine.slice("pandoc ".length)
      : firstLine;
    return { path: pandocPath, version };
  } catch (e) {
    throw new Error(`pandoc found at ${pandocPath} but failed to run: ${(e as Error).message}`);
  }
}

export async function pandocExport(args: PandocExportArgs): Promise<void> {
  const pandocPath = await locatePandoc();
  if (!pandocPath) {
    throw new Error(
      "Pandoc not found on PATH. Install pandoc (https://pandoc.org/installing.html) and retry.",
    );
  }

  const tmpPath = path.join(os.tmpdir(), `eidon-pandoc-${Date.now()}.md`);
  await fs.writeFile(tmpPath, args.inputMarkdown, "utf8");

  const argv: string[] = [tmpPath, "-o", args.outputPath];
  const bib = args.bibliography?.trim();
  if (bib) {
    argv.push("--citeproc", `--bibliography=${bib}`);
    const csl = args.csl?.trim();
    if (csl) argv.push(`--csl=${csl}`);
  }
  const tpl = args.template?.trim();
  if (tpl) argv.push(`--template=${tpl}`);
  for (const extra of args.extraArgs) if (extra) argv.push(extra);

  try {
    await execFileP(pandocPath, argv);
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    const detail =
      err.stderr?.trim() || err.stdout?.trim() || err.message || "unknown error";
    throw new Error(`pandoc failed: ${detail}`);
  } finally {
    await fs.rm(tmpPath, { force: true }).catch(() => {});
  }
}
