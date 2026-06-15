/**
 * App-level i18n 出口（barrel）。
 *
 * 拆分：M2 纯查找逻辑见 `translate.ts`（框架无关、可单测）；React hook 见
 * `useI18n.ts`（读 Zustand settings 的 language 切片）。历史上调用点统一
 * `import { useI18n } from '../i18n'`，此处保持该出口不变。
 */
export { useI18n } from './useI18n';
export { t } from './t';
export { dicts, resolveDict, lookup, translate, type Lang } from './translate';
