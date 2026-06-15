/**
 * M1 · 统一持久化与迁移模块（深模块，框架无关，可在 Node 单测）。
 *
 * 设计（见 PRD / ADR-0010）：每个持久化域提供一对纯函数——
 *   load(raw)      原始 localStorage 字符串 → 校验/迁移后的状态对象
 *   serialize(s)   状态对象 → 写盘字符串（含瞬态字段裁剪）
 *
 * Zustand store 仅调用这对纯函数，绝不内联默认值合并 / 一次性迁移逻辑。
 * 复用与 Vue/Pinia 时代**完全相同**的 LS key 与序列化形状，老用户升级零感知。
 */
export interface PersistedCodec<T> {
  /** 复用既有 key（如 'eidon.settings.v1'）。 */
  readonly key: string;
  /** 含默认值合并 + 一次性迁移 + 范围钳制；raw 为 null/损坏时返回纯默认值。 */
  load(raw: string | null): T;
  /** 含字段裁剪/钳制（如 settings 的 fileTreeWidth 范围钳制）。 */
  serialize(state: T): string;
}

export * from './settings';
export * from './workspace';
