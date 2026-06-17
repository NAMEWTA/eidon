# Handoff

## 目标

完成 EIDON 从 Tauri 2 到 Electron 的完整迁移评估，输出一份可供决策的评估文档。用户下一步关注：是否执行迁移、以及如何在 Electron 架构下直接集成 pi-coding-agent SDK。

## 已完成

1. **代码库全面探查**：3 个 Explore agent 并行扫描了 Rust 后端（17 文件、~6,341 行、48 个 command）、前端（React 19 + Zustand + CodeMirror 6）、构建系统（Vite 6、CI/CD、代码签名）。

2. **架构方案对比与选定**：初始方案（core 留在 renderer，保留桥接抽象层）→ 用户提出更优方案（core 上移 main process，消除依赖注入）。最终采用后者的调用链：
   ```
   renderer → IPC → main(ipcHandler → core → service)
   ```

3. **Rust 模块逐一分类**：
   - 类别 1（直接删除，Electron 内置替代）：菜单、窗口管理、macOS 语言、打印、5 个插件 — ~420 行
   - 类别 2（TypeScript 重写）：文件 I/O、搜索、索引、CJK 校对、云检测等 — ~2,910 行
   - 类别 3（npm 包替换）：15 个 Rust crate 均找到 npm 等价物，零 Rust 保留

4. **风险评估**：
   - 最高风险：`git2` → `isomorphic-git`（历史修剪需系统 git CLI 降级）
   - 中等风险：编码检测（jschardet 对 CJK 准确度略低）、拼写检查（纯 JS 慢 ~10x）、Argon2 WASM（仅会话级）
   - 降低风险：IPC 次数大幅减少（scanNodes 从 N 次 invoke 变为 1 次 IPC）

5. **工作量估算**：~67 人天（~13.5 人周），单人 8-12 周，双人 6-8 周

6. **产出物**：
   - 评估文档：`docs/tauri2-to-electron-migration-evaluation.md`
   - Plan 文件：`/Users/wta/.claude/plans/dazzling-enchanting-glade.md`

## 未完成

1. **决策未做出**：是否执行迁移。需权衡：二进制体积 ~130 MB（vs ~12 MB）、内存 ~300 MB（vs ~150 MB） vs 统一 npm 技术栈 + 可直接集成 pi SDK + 无 Linux 系统依赖。
2. **pi-coding-agent 实际集成验证**：评估中给出了代码骨架（`electron/core/ai.ts`），但未实际安装和测试 pi SDK。pi 的 GitHub 页面确认其需要 Node.js 环境，与 Electron main process 兼容。
3. **编码检测准确度回测**：`jschardet` vs `chardetng` 对 CJK 文件的准确度差异需用真实测试集验证。
4. **Git 操作完整验证**：`isomorphic-git` 对大规模仓库（1000+ 提交）的性能和 API 覆盖度需实际测试。
5. **迁移执行**：若决定迁移，按评估文档 Part E 的工作量估算分阶段执行，从项目脚手架开始。

## 验证

- 无代码变更，纯评估任务，无需运行测试
- 评估文档已写入 `docs/tauri2-to-electron-migration-evaluation.md`
- 代码探查结果已验证：bridge 层结构（`core/bridge/tauri.ts` 等 7 个文件）、core 模块依赖（仅 `snapshots` 直接导入 bridge/git）、14 个渲染进程文件从 contracts 导入类型

## 推荐技能

- `code-review` — 若进入实施阶段，用于审查迁移代码
- `run` — 启动 Electron 应用验证迁移效果
- `simplify` — 消除依赖注入后清理冗余代码
- `goal-builder` — 若需将迁移拆分为多个长跑任务，构建可审计的 goal 提示词

## 摘要

1. EIDON Tauri 2 → Electron 迁移完全可行，零 Rust 保留，所有 ~6,341 行 Rust 均可删除或用 TypeScript/npm 等价物替换
2. 核心架构决策：`core/` 业务逻辑上移到 Electron main process（Node.js），消除 `NodeStore`/`TemplateStore` 等桥接注入接口，直接用 `fs` 操作文件
3. 前端保留率 ~85%，仅 ~60 个文件需修改（其中 ~40 个是机械替换），CodeMirror 扩展、UI 组件、i18n、样式全部零改动
4. pi-coding-agent SDK 可直接在 `electron/core/ai.ts` 中 import，操作真实文件系统，这是 Tauri 架构无法做到的
5. 预估 ~13.5 人周（单人 8-12 周），主要工作量在 Git 操作重写（8 天）、文件转换移植（5 天）、工作区索引重写（5 天）、文件 I/O+编码移植（5 天）
