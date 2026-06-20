# ADR-0010 · UI 层 = React 19（渲染像素保真 + 持久化形状一致）

`app/frontend/` UI 层采用 **React 19 + Tailwind CSS v4 + Zustand v5 + shadcn/ui + lucide-react + Vite**。入口 `main.tsx` 挂 React root（默认 `App`），挂载节点 `#app`。两条强约束跨版本保持：

1. **渲染面像素保真**：Markdown HTML 由 `markdown-it`（`frontend/lib/markdown`）生成、经 `dangerouslySetInnerHTML` 注入；Mermaid 渲染 / 图片放大浮层 / 链接拦截在 effect 中以命令式 API 协调，不依赖 React 渲染；样式逐字保留（`frontend/styles/`，Tailwind v4 经 `@theme inline` 映射 CSS 变量主题）。见 `Preview.tsx`。
2. **持久化形状一致**：Zustand 复用既有 `localStorage` key 与序列化形状，每个持久化域提供一对 `load` / `serialize` 纯函数（`frontend/lib/persistence/`），升级零感知。

## Considered Options

来源：该层于 v4.4 从 Vue 3 `<script setup>` + Pinia 整体重写而来；迁移可行正因业务逻辑收进框架无关的 `backend/domain/` + `shared/`，`bridge/` 是唯一前后端出口，React 直接复用同一套 bridge 与磁盘契约。

---
> **注：** 实现路径以 ADR-0025（四层架构）与 AGENTS.md §2 / 代码为准。
