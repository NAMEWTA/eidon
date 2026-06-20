import boundaries from "eslint-plugin-boundaries";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// 重构后边界（ADR-0025）：单向链 frontend → bridge → backend(ipc → service → {domain, capability}) + shared(叶子)。
//   - frontend（纯 UI）只经 bridge + shared + 运行时 window.eidon 访问后端；禁 import backend/preload/electron。
//   - bridge（前后端契约边界，渲染侧运行）只碰 shared 契约 + window.eidon；禁 import backend/preload/electron。
//   - backend：ipc 接入 → service 编排 → {domain 业务规则(注入端口)/capability 底层资源}；domain/capability 禁 electron（可单测）。
//   - shared：框架无关叶子，禁 react/zustand/electron。
//   - @tauri-apps/* 全局永久禁；electron 仅 preload + backend/{shell,ipc} 可用。

const reactHooksRules = {
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/exhaustive-deps": "warn",
};

const reactJsxRules = {
  "react/react-in-jsx-scope": "off",
  "react/jsx-uses-react": "off",
};

const banTauri = {
  group: ["@tauri-apps", "@tauri-apps/*"],
  message: "本项目不使用 @tauri-apps（纯 Electron 桌面栈）。改用 window.eidon / bridge/ipc / backend 能力层。",
};

const banReactZustand = {
  group: ["react", "react-dom", "react/*", "react-dom/*", "zustand", "zustand/*"],
  message: "非渲染层，禁 UI 框架（react/zustand）。",
};

const banElectron = {
  group: ["electron", "electron/*"],
  message: "本层禁依赖 electron（保持框架无关 / 可单测）。",
};

const ALL_SRC = ["frontend/**/*.{ts,tsx}", "bridge/**/*.ts", "backend/**/*.ts", "preload/**/*.ts", "shared/**/*.ts"];

export default [
  {
    ignores: [
      "out/**",
      "dist/**",
      "dist-app/**",
      "node_modules/**",
      "eslint.config.mjs",
      "vitest.config.ts",
      "electron.vite.config.ts",
      "**/__tests__/**",
      "**/*.test.ts",
    ],
  },

  // ── boundaries：单向依赖（机器强制）──────────────────────────────────
  {
    files: ALL_SRC,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "@typescript-eslint": tseslint, boundaries },
    settings: {
      // 具体优先：emit 单列；backend 各子层在 shell 之前。
      "boundaries/elements": [
        { type: "backend-events", pattern: "backend/ipc/emit.ts", mode: "full" },
        { type: "backend-ipc", pattern: "backend/ipc/**" },
        { type: "backend-service", pattern: "backend/services/**" },
        { type: "backend-domain", pattern: "backend/domain/**" },
        { type: "backend-capability", pattern: "backend/capabilities/**" },
        { type: "backend-shell", pattern: "backend/shell/**" },
        { type: "bridge", pattern: "bridge/**" },
        { type: "preload", pattern: "preload/**" },
        { type: "shared", pattern: "shared/**" },
        { type: "frontend", pattern: "frontend/**" },
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: "frontend",
              disallow: ["backend-shell", "backend-ipc", "backend-service", "backend-domain", "backend-capability", "backend-events", "preload"],
              message: "前端只经 bridge + shared + 运行时 window.eidon 访问后端，禁直接 import backend/preload。",
            },
            {
              from: "bridge",
              disallow: ["backend-shell", "backend-ipc", "backend-service", "backend-domain", "backend-capability", "backend-events", "preload"],
              message: "桥接层只碰 shared 契约 + window.eidon，禁直接 import backend/preload。",
            },
            {
              from: ["backend-shell", "backend-ipc"],
              disallow: ["frontend", "bridge", "preload"],
              message: "backend 不得 import 前端/桥接/preload。",
            },
            {
              from: "backend-service",
              disallow: ["frontend", "bridge", "preload", "backend-ipc", "backend-shell"],
              message: "service 只组合 domain + capability（+ emit），禁依赖 ipc/壳/前端。",
            },
            {
              from: "backend-domain",
              disallow: ["frontend", "bridge", "preload", "backend-ipc", "backend-service", "backend-shell", "backend-capability", "backend-events"],
              message: "domain 仅经注入端口 + shared，禁依赖 capability/ipc/壳。",
            },
            {
              from: "backend-capability",
              disallow: ["frontend", "bridge", "preload", "backend-ipc", "backend-service", "backend-shell"],
              message: "能力层只依赖 shared + backend-events(emit) + node:*/库；不得依赖 ipc/service/壳。",
            },
            {
              from: "backend-events",
              disallow: ["frontend", "bridge", "preload", "backend-ipc", "backend-service", "backend-domain", "backend-capability"],
              message: "emit 只依赖 shared + electron 类型。",
            },
            {
              from: "shared",
              disallow: ["frontend", "bridge", "backend-shell", "backend-ipc", "backend-service", "backend-domain", "backend-capability", "backend-events", "preload"],
              message: "shared 为框架无关叶子，只可依赖 shared + 第三方纯库。",
            },
          ],
        },
      ],
    },
  },

  // ── 全局：永久禁 @tauri-apps ───────────────────────────────────────
  {
    files: ALL_SRC,
    rules: {
      "no-restricted-imports": ["error", { patterns: [banTauri] }],
    },
  },

  // ── shared：框架无关叶子（禁 react/zustand/electron）────────────────
  {
    files: ["shared/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [banTauri, banReactZustand, banElectron] }],
    },
  },

  // ── backend domain/capability/service：纯逻辑（禁 electron + react/zustand，保持可单测）──
  {
    files: ["backend/domain/**/*.ts", "backend/capabilities/**/*.ts", "backend/services/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [banTauri, banElectron, banReactZustand] }],
    },
  },

  // ── backend shell/ipc + preload：禁 react/zustand（允许 electron）──
  {
    files: ["backend/shell/**/*.ts", "backend/ipc/**/*.ts", "preload/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [banTauri, banReactZustand] }],
    },
  },

  // ── bridge：渲染侧 IPC 传输（禁 react/zustand/electron；只走 window.eidon）──
  {
    files: ["bridge/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            banTauri,
            banReactZustand,
            { group: ["electron", "electron/*", "@electron/remote", "@electron/remote/*"], message: "桥接层禁直接用 electron / ipcRenderer；只经 window.eidon。" },
          ],
        },
      ],
    },
  },

  // ── frontend：禁 electron / ipcRenderer（只走 window.eidon → bridge）+ React 规则 ──
  {
    files: ["frontend/**/*.{ts,tsx}"],
    plugins: { react: reactPlugin, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactHooksRules,
      ...reactJsxRules,
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            banTauri,
            { group: ["electron", "electron/*", "@electron/remote", "@electron/remote/*"], message: "渲染层禁直接用 electron / ipcRenderer；只经 window.eidon（bridge/ipc）。" },
          ],
        },
      ],
    },
  },
];
