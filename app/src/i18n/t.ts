/**
 * 命令式翻译（非 React 渲染上下文用）。读当前 settings.language 即时翻译。
 * React 组件内仍用 `useI18n()`（订阅语言切片、随切换重渲染）；此函数供
 * composable 的命令式函数、命令 run 回调、store subscribe 副作用等调用。
 */
import { useSettingsStore } from '../stores/settings';
import { resolveDict, translate } from './translate';

export function t(key: string, params?: Record<string, string | number>): string {
  return translate(resolveDict(useSettingsStore.getState().language), key, params);
}
