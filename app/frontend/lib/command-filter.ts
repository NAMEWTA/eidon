/**
 * M6 · 命令面板过滤（纯函数，框架无关，可单测）。
 *
 * 逐字复刻 CommandPalette 的 filtered 计算：空查询 → 原序全集；否则把查询
 * 按空白分词，每个 token 都需出现在 `${title} ${id} ${hint}` 的小写串里（AND 语义）。
 * 不排序——保留命令注册顺序（与 既有实现一致）。
 */
export interface CommandLike {
  id: string;
  title: string;
  hint?: string;
}

export function filterCommands<T extends CommandLike>(commands: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...commands];
  return commands.filter((c) => {
    const hay = `${c.title} ${c.id} ${c.hint ?? ''}`.toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  });
}
