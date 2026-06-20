/**
 * 标签模糊排序——编辑器 `#tag` 自动补全（cm-tag-autocomplete）与属性面板标签 chip 输入
 * （TagInput）共享同一套打分，避免两处逐字重复。
 *
 * 打分：全等 100 / 前缀 80 / 包含 50；空输入则按使用频次列全部。同分再按 count、字母序。
 */
export interface RankedTag {
  tag: string;
  count: number;
}

export function rankTags(
  partial: string,
  tags: ReadonlyArray<{ tag: string; count: number }>,
  limit = 30,
): RankedTag[] {
  const p = partial.trim().toLowerCase();
  return tags
    .map((t) => {
      const lc = t.tag.toLowerCase();
      let score = 0;
      if (!p) score = 1; // 空输入：列出全部（仅按频次/字母序）
      else if (lc === p) score = 100;
      else if (lc.startsWith(p)) score = 80;
      else if (lc.includes(p)) score = 50;
      return { t, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.t.count - a.t.count || a.t.tag.localeCompare(b.t.tag))
    .slice(0, limit)
    .map((r) => ({ tag: r.t.tag, count: r.t.count }));
}
