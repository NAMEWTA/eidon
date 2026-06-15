# ADR-0021 · 像素宠物「小芽」品牌 / 交互层

**状态：** 已锁定
**日期：** 2026-06
**分支：** `refactor/eidon-base`

## 动机

EIDON 需要可识别的品牌人格 + 轻量交互愉悦。以一只像素风「小芽」承载：既是应用图标的来源，
又作为 ActivityBar 常驻的交互宠物（鼠标跟随 / 点击 / 久置睡眠 / 应用事件触发表情）。

## 决策

- **单一生成器**：`scripts/generate-brand-icon.mjs` 程序化产出全套品牌资产——应用图标多尺寸
  + `app/public/eidon-pet-sheet.png` 精灵表（行=形态、列=帧）+ idle 动图归档。资产由代码生成、可复现，不手绘散落。
- **三处耦合（必须同步，否则精灵错位）**：
  1. 生成器 `STATE_ORDER`（精灵表行的**权威顺序**）；
  2. `src/styles/components.css` 的 `.eidon-pet--<state>` 行映射（`background-position-y`）+ `steps()` 走帧；
  3. `src/components/EidonPet.tsx` 的 `PetState`。
- **权威行序（11 行）**：`0 idle · 1 happy · 2 thinking · 3 focus · 4 sleepy · 5 charging · 6 follow · 7 received · 8 organized · 9 resting · 10 clicked`。
  - `sleepy(4)` / `organized(8)` 为**预留行**（已生成、UI 暂未接线）；组件 `sleep` 态**复用 `resting(9)` 行**。这些特例在 `components.css` 头注释固化。
- **交互契约**：宠物订阅 window 事件切换瞬时表情——`eidon:saved`→received、`eidon:remote-pulled`→charging、`eidon:open-global-search`/`eidon:open-cjk-proofread`→focus、`eidon:reminder-due`→received（事件名见 ADR-0022 改名）。

## 约束

改形态 / 调行序时**三处必须同步改**，否则精灵表行错位（见 `EidonPet.tsx` 顶部注释与 memory `eidon-pet-sprite-sheet`）。
精灵表是 `generate-brand-icon.mjs` 的产物——改了形态须重跑生成器并同步 CSS 行映射与组件枚举。

## Consequences

- 纯前端组件 + 构建脚本，无后端 / 契约 / 数据层影响；离线、无联网依赖。
- 双主题品牌（应用图标 + 宠物）共用一套生成逻辑，风格天然一致。
