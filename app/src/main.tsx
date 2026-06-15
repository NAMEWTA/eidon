/**
 * main.tsx — 应用入口（P3.8）。
 *
 * 单 React root：挂 <App />，挂载点 `#app`。不使用 StrictMode——本应用在挂载 effect 内注册大量
 * Tauri/window 监听与一次性启动逻辑，StrictMode 的开发期双挂载会重复注册监听 / 重复触发启动；
 * 生产不启用 StrictMode，为与生产行为一致并避免开发期重复副作用，这里整体关闭
 * （Editor 等命令式包装器仍各自做了卸载清理）。
 */
import { createRoot } from "react-dom/client";
// Tailwind v4 入口（含 @theme inline 到既有 CSS 变量的映射）必须最先加载。
import "./styles/tailwind.css";
// 既有全局样式：CJK 字体、主题变量、代码高亮主题、渲染面（preview/editor）、组件 chrome。
import "./styles/cjk-font.css";
import "./styles/main.css";
import "./styles/hljs-theme.css";
import "./styles/preview.css";
import "./styles/editor.css";
import "./styles/components.css";
import "katex/dist/katex.min.css";
import { subscribeDomEffects } from "./effects/dom-effects";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

// 挂载纯 DOM 副作用（主题/缩放/字号），与 React 渲染无关，启动时一次。
subscribeDomEffects();

const rootEl = document.getElementById("app");
if (rootEl) {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}
