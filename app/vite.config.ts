import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  // React（SWC 编译）+ Tailwind v4（CSS-first，经 vite 插件处理 @import "tailwindcss"）
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // 既有别名（少量历史代码可能用到）
      "@core": new URL("./core", import.meta.url).pathname,
      "@src": new URL("./src", import.meta.url).pathname,
      // shadcn 原语沿用 "@/..." 约定（仅 components/ui 与 lib/utils 使用），
      // 应用其余部分维持相对路径 import。
      "@": new URL("./src", import.meta.url).pathname,
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
