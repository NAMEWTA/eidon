/**
 * App-level i18n React hook。
 *
 * 行为与 既有实现一致：读 settings 的 `language` 字段（订阅其切片 → 语言切换即时
 * 重渲染），查找逻辑全部委托给框架无关的 M2 纯模块（translate.ts），字典与
 * 兜底链逐字保留。
 */
import { useCallback } from 'react';
import { useSettingsStore } from '../stores/settings';
import { resolveDict, translate } from './translate';

export function useI18n() {
  const language = useSettingsStore((s) => s.language);
  const dict = resolveDict(language);
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(dict, key, params),
    [dict],
  );
  return { t, lang: language };
}
