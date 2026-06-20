/**
 * 目录全文搜索。
 *
 * 递归遍历 root，对文本类文件逐行不分大小写子串匹配，命中即记录（file/1-based line/200 字截断 snippet），
 * 总数封顶 maxResults。跳过 dotfiles/dotdirs 与重目录（node_modules/target/.git/dist）。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SearchHit } from "@shared/models";

const ALLOWED_EXT = new Set(["md", "markdown", "mdown", "mkd", "txt"]);
const SKIP_DIRS = new Set(["node_modules", "target", ".git", "dist"]);

export async function searchInDir(
  root: string,
  query: string,
  maxResults: number,
): Promise<SearchHit[]> {
  if (!query) return [];
  const needle = query.toLowerCase();
  const hits: SearchHit[] = [];

  async function walk(dir: string): Promise<void> {
    if (hits.length >= maxResults) return;
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of dirents) {
      if (hits.length >= maxResults) return;
      const name = d.name;
      // 跳过 dotfiles/dotdirs 与 deny-list（按名匹配）。
      if (name.startsWith(".") || SKIP_DIRS.has(name)) continue;
      const full = path.join(dir, name);
      if (d.isSymbolicLink()) continue;
      if (d.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!d.isFile()) continue;
      const ext = path.extname(name).toLowerCase().replace(/^\./, "");
      if (!ALLOWED_EXT.has(ext)) continue;
      let content: string;
      try {
        content = await fs.readFile(full, "utf8");
      } catch {
        continue;
      }
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (hits.length >= maxResults) break;
        if (lines[i].toLowerCase().includes(needle)) {
          hits.push({
            file: full,
            line: i + 1,
            snippet: [...lines[i]].slice(0, 200).join(""),
          });
        }
      }
    }
  }

  await walk(root);
  return hits;
}
