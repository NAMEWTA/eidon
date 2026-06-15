/**
 * 集中的 DOM 副作用模块（P1.6）。
 *
 * 把 App.vue 里若干纯展示型 `watchEffect`（写 documentElement 的样式/属性）收敛为
 * 对 settings store 的单一 `subscribe`。这些副作用是**纯 DOM**，与 React 渲染无关，
 * 因此在应用启动时挂一次即可，行为与 Vue 版逐字一致：
 *
 *   --ui-font-size       ← settings.uiFontSize
 *   zoom (documentElement) ← settings.globalZoom        // #72 高 DPI 全局缩放
 *   --content-font-size  ← settings.previewFontSize      // PR #74 预览字号
 *   data-theme           ← dataThemeFor(settings.theme)
 *
 * 其余涉及 Tauri/多 store 编排的 effect（菜单语言、workspace index、capture/rest、
 * rag、spellcheck、customCss 等）随 App 壳在 Phase 3 以 useEffect 接线，不在此处。
 */
import { useSettingsStore } from '../stores/settings';
import { dataThemeFor } from '../lib/themes';

function applyDomEffects(): void {
  if (typeof document === 'undefined') return;
  const s = useSettingsStore.getState();
  const root = document.documentElement;
  root.style.setProperty('--ui-font-size', `${s.uiFontSize}px`);
  (root.style as unknown as { zoom: string }).zoom = String(s.globalZoom || 1);
  root.style.setProperty('--content-font-size', `${s.previewFontSize || 15}px`);
  root.setAttribute('data-theme', dataThemeFor(s.theme));
}

/**
 * 挂载 DOM 副作用：立即应用一次（初始同步），再订阅 settings 变化重应用。
 * 返回 unsubscribe，供需要时拆除（如测试 / 多 root 清理）。
 */
export function subscribeDomEffects(): () => void {
  applyDomEffects();
  // settings 变更（任何字段）都重应用一遍——四个 set 操作幂等且极廉价。
  return useSettingsStore.subscribe(() => applyDomEffects());
}
