/**
 * 单提交单文件 diff。
 *
 * 取「提交树 vs 一级父树」该文件的新旧 blob，用 jsdiff `structuredPatch`（3 行上下文）重建 hunk，
 * 逐字段翻成 `DiffResult{hunks[{oldStart,newStart,...lines[{kind,text}]}],unified}`，精确对齐 HistoryPanel。
 * 注意：父不存在（根提交/新增文件）旧内容按空串；文件在该提交被删则新内容按空串。
 */
import { structuredPatch } from "diff";
import type { DiffResult, DiffHunk, DiffLine, DiffLineKind } from "@shared/models";
import { git, repo, isInitialized, relPath } from "./git-client";

export async function fileDiff(
  folder: string,
  filePath: string,
  sha: string,
): Promise<DiffResult> {
  if (!(await isInitialized(folder))) throw new Error(`git open failed: ${folder}`);
  const rel = relPath(folder, filePath);
  if (rel === null) throw new Error(`file is outside workspace: ${filePath}`);

  const { commit } = await git.readCommit({ ...repo(folder), oid: sha });
  const parentOid = commit.parent[0] ?? null;

  const newContent = await readBlobText(folder, sha, rel);
  const oldContent = parentOid ? await readBlobText(folder, parentOid, rel) : "";

  // jsdiff：3 行上下文，文件名仅占位（renderer 不消费）。
  const patch = structuredPatch(rel, rel, oldContent, newContent, "", "", {
    context: 3,
  });

  const hunks: DiffHunk[] = [];
  let unified = "";
  for (const h of patch.hunks) {
    const lines: DiffLine[] = [];
    unified += `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@\n`;
    for (const raw of h.lines) {
      const marker = raw[0];
      if (marker === "\\") continue; // "\ No newline at end of file" —— 不进结构化输出
      const kind: DiffLineKind =
        marker === "+" ? "add" : marker === "-" ? "remove" : "context";
      lines.push({ kind, text: raw.slice(1) });
      unified += `${raw}\n`;
    }
    hunks.push({
      oldStart: h.oldStart,
      oldLines: h.oldLines,
      newStart: h.newStart,
      newLines: h.newLines,
      lines,
    });
  }

  return { fromSha: parentOid, toSha: sha, hunks, unified };
}

/** 取某提交树里该文件 blob 文本；文件不存在（新增/删除侧）返回空串。 */
async function readBlobText(folder: string, oid: string, rel: string): Promise<string> {
  try {
    const { blob } = await git.readBlob({ ...repo(folder), oid, filepath: rel });
    return Buffer.from(blob).toString("utf8");
  } catch {
    return "";
  }
}
