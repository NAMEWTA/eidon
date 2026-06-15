/**
 * M2 · i18n 纯查找模块（框架无关，可在 Node 单测）。
 *
 * 把原 `useI18n()` 内联的查找逻辑逐字抽成纯函数：点路径查找 → 英文兜底 →
 * 原样 key 兜底 → `{param}` 插值。React hook（useI18n.ts）只负责注入「当前
 * 语言字典」，行为与 Vue 版 100% 一致（见 src/i18n/index.ts 历史实现）。
 */
import { en } from './en';
import { zh } from './zh';

export const dicts = { zh, en } as const;
export type Lang = keyof typeof dicts;

/** 选择语言字典；未知或旧语言设置回退中文。 */
export function resolveDict(lang: string): Record<string, unknown> {
  return (dicts as Record<string, Record<string, unknown>>)[lang] || zh;
}

/** 沿点路径在嵌套字典里取字符串；任一段缺失或非字符串返回 undefined。 */
export function lookup(d: unknown, parts: string[]): string | undefined {
  let cur: unknown = d;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/**
 * 翻译查找：当前语言 → 英文兜底 → 原样 key 兜底，再做 `{param}` 全局替换。
 *
 * v4.3.5 行为：缺失键先回退英文（让部分翻译的功能在非 en/zh 语言下不至于显示
 * 破碎的原始 key），再回退 key 本身。
 */
export function translate(
  dict: unknown,
  key: string,
  params?: Record<string, string | number>,
): string {
  const parts = key.split('.');
  let str = lookup(dict, parts) ?? lookup(en, parts) ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}
