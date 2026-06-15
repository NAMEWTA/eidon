# ADR-0010 · UI 层 = React 19（渲染像素保真 + 持久化形状一致）

`app/src/` UI 层采用 **React 19 + Tailwind CSS v4 + Zustand v5 + shadcn/ui + lucide-react + Vite**。入口 `main.tsx` 挂两个 React root（默认 `App`；URL `?slideshow=1` 挂 `Slideshow`），挂载节点 `#app`，不启用 StrictMode（挂载 effect 内注册大量 Tauri / window 监听）。两条强约束跨版本保持：

1. **渲染面像素保真**：Markdown HTML 由 `markdown-it`（`lib/markdown`）生成、经 `dangerouslySetInnerHTML` 注入；Mermaid 渲染 / 图片放大浮层 / 链接拦截在 effect 中以命令式 API 协调，不依赖 React 渲染；样式逐字保留（`styles/`，Tailwind v4 经 `@theme inline` 映射 CSS 变量主题）。见 `Preview.tsx`。
2. **持久化形状一致**：Zustand 复用既有 `localStorage` key 与序列化形状，每个持久化域提供一对 `load` / `serialize` 纯函数（`lib/persistence/`），升级零感知。

## Considered Options

来源：该层于 v4.4 从 Vue 3 `<script setup>` + Pinia 整体重写而来；迁移可行正因 ADR-0006 把业务逻辑收进框架无关的 `core/`、`bridge/` 是唯一 Tauri 出口，React 直接复用同一套 bridge 与磁盘契约（`core/` / `src-tauri/` / 契约 / fixtures 均未改动）。
