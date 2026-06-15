import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // core 业务测试 + src 纯模块测试（M1 持久化 / M2 i18n / M3 reducers 等）。
    // src 纯模块均框架无关，node 环境即可；`test:core` 脚本仍按目录范围只跑 core。
    include: ["core/**/*.test.ts", "src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@core": new URL("./core", import.meta.url).pathname,
      "@src": new URL("./src", import.meta.url).pathname,
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
