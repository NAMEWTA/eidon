import boundaries from "eslint-plugin-boundaries";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// 桥接边界（ADR-0007）：禁止任何文件直接 import @tauri-apps/api（invoke/Channel/event）。
// allowlist 必须保持为空（0）。core/bridge 是唯一豁免出口。
const directInvokeAllowlist = [];

const directInvokeRules = {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        {
          name: "@tauri-apps/api/core",
          importNames: ["invoke", "Channel"],
          message: "Use core/bridge instead of direct Tauri core imports.",
        },
        {
          name: "@tauri-apps/api/event",
          message: "Use core/bridge/events instead of direct Tauri events.",
        },
      ],
      patterns: [
        {
          group: ["@tauri-apps/api/*"],
          message: "Use core/bridge instead of direct Tauri imports.",
        },
      ],
    },
  ],
};

// React Hooks 正确性规则（迁移护栏：hooks 调用顺序、依赖数组）。
const reactHooksRules = {
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/exhaustive-deps": "warn",
};

// 新 JSX transform（jsx: react-jsx）下无需 import React。
const reactJsxRules = {
  "react/react-in-jsx-scope": "off",
  "react/jsx-uses-react": "off",
};

export default [
  {
    ignores: [
      "dist/**",
      "src-tauri/**",
      "node_modules/**",
      "eslint.config.mjs",
      "vitest.config.ts",
      "vite.config.ts",
    ],
  },
  // 三层边界（boundaries）+ 桥接 no-restricted-imports：覆盖 src 与 core 的所有 TS/TSX。
  {
    files: ["src/**/*.{ts,tsx}", "core/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      boundaries,
    },
    settings: {
      "boundaries/elements": [
        { type: "src", pattern: "src/**" },
        { type: "core-bridge", pattern: "core/bridge/**" },
        { type: "core", pattern: "core/**" },
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: "core",
              disallow: ["src"],
              message: "core must not import UI-layer src code.",
            },
            {
              from: "core",
              disallow: [["core", { pattern: "*/**" }]],
              message: "core modules must depend through public index.ts APIs.",
            },
          ],
        },
      ],
      ...directInvokeRules,
    },
  },
  // React 规则：仅作用于 src 的 TS/TSX（视图层）。
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...reactHooksRules,
      ...reactJsxRules,
    },
  },
  // core 必须框架无关：禁止 import react / zustand / 任何 UI 框架 / 直连 Tauri。
  {
    files: ["core/**/*.ts"],
    ignores: ["core/bridge/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "core must stay framework-free.",
            },
            {
              name: "react-dom",
              message: "core must stay framework-free.",
            },
            {
              name: "zustand",
              message: "core must stay framework-free.",
            },
            {
              name: "@tauri-apps/api/core",
              message: "Only core/bridge may import Tauri core APIs.",
            },
            {
              name: "@tauri-apps/api/event",
              message: "Only core/bridge may import Tauri events.",
            },
          ],
          patterns: [
            {
              group: [
                "react",
                "react-dom",
                "react/*",
                "react-dom/*",
                "zustand",
                "zustand/*",
              ],
              message: "core must stay framework-free.",
            },
            {
              group: ["@tauri-apps/api/*"],
              message: "Only core/bridge may import Tauri APIs.",
            },
          ],
        },
      ],
    },
  },
  // core/bridge 是唯一 Tauri 出口：豁免 no-restricted-imports。
  {
    files: ["core/bridge/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  ...directInvokeAllowlist.map((file) => ({
    files: [file],
    rules: {
      "no-restricted-imports": "off",
    },
  })),
];
