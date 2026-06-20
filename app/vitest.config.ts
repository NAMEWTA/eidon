import { defineConfig } from "vitest/config";

// 重构后测试布局（ADR-0025）：shared（契约 + 数据模型 + 纯工具）、backend（domain 业务内核 + 能力层）、
// frontend（渲染纯模块）。均框架无关或可在 node 下跑（前端测试用模块级 mock，不依赖真实 DOM）。
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "shared/**/*.test.ts",
      "backend/**/*.test.ts",
      "frontend/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@src": new URL("./frontend", import.meta.url).pathname,
      "@": new URL("./frontend", import.meta.url).pathname,
      "@frontend": new URL("./frontend", import.meta.url).pathname,
      "@bridge": new URL("./bridge", import.meta.url).pathname,
      "@backend": new URL("./backend", import.meta.url).pathname,
      "@shared": new URL("./shared", import.meta.url).pathname,
    },
  },
});
