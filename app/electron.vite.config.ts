import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// 配置文件位于 app/，下方所有路径都相对它解析为绝对路径。
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// electron-vite：三构建目标（main / preload / renderer）合一配置。
// - main / preload 走 Node 侧（externalizeDepsPlugin 把 dependencies 外置，不打进 bundle，运行时从 node_modules 加载，
//   这样 isomorphic-git / chokidar / nspell 等重依赖不被打包）。
// - renderer 复用既有 Vite 栈（React SWC + Tailwind v4）与别名，端口沿用 1420。
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { "@shared": r("shared"), "@backend": r("backend") },
    },
    build: {
      rollupOptions: {
        input: { index: r("backend/shell/index.ts") },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { "@shared": r("shared") },
    },
    build: {
      rollupOptions: {
        input: { index: r("preload/index.ts") },
        // 沙箱(sandbox:true)要求 preload 为 CJS；package.json type:module 下需 .cjs 扩展名。
        output: { format: "cjs", entryFileNames: "index.cjs" },
      },
    },
  },
  renderer: {
    // 渲染层根目录 = app/（index.html 在此，引用 /src/main.tsx，publicDir=app/public）。
    root: r("."),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // 渲染层：@/@src/@frontend（前端纯 UI）；@bridge（桥接层）；@shared（数据模型/契约/工具）。
        "@src": r("frontend"),
        "@": r("frontend"),
        "@frontend": r("frontend"),
        "@bridge": r("bridge"),
        "@shared": r("shared"),
      },
    },
    build: {
      rollupOptions: {
        input: { index: r("index.html") },
      },
    },
    server: {
      port: 1420,
      strictPort: true,
    },
  },
});
