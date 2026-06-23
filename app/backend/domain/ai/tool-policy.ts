/**
 * backend/domain/ai/tool-policy —— 内置工具「生效集合」策略（纯函数，单测友好）。
 *
 * 生效工具 = (per-agent 白名单 enabled 或 全集 allTools) − 禁用集 disabled。
 * 全集与配置由 service 喂入；domain 不碰 capability/IO。
 */

/**
 * 计算 Agent 实际生效的内置工具名。
 *
 * @param allTools 内置工具全集（白名单 enabled 为空时的基准集）。
 * @param enabled  per-agent 白名单：非空则收窄到这些工具，空则回退到全集。
 * @param disabled 禁用集（全局禁用 + per-agent 禁用合并后传入），从基准集中减去。
 * @returns 生效工具名（保持基准集顺序）。
 */
export function resolveToolNames(
  allTools: readonly string[],
  enabled: readonly string[],
  disabled: readonly string[],
): string[] {
  const base = enabled.length ? enabled : allTools;
  const off = new Set(disabled);
  return base.filter((name) => !off.has(name));
}
