> **服务工作流：** `../../../../workflows/dev/H-diagnose/H-diagnose.md`
> **产物文件名：** `diagnosis.md`
> **来源：** `temp/bug/2026-06-23-使用问题.md`

# Diagnosis

本 change 覆盖 7 组使用问题，其中 3 项为「诊断类」（下记），其余为优化/新功能（见计划 C/E/F/B2）。

## 用户症状

- **BUG1**：文件资源管理器点「在文件树中定位当前文件」后，树行渲染重叠错乱（截图 `image-20260623-104408`）。
- **AI 工具不符**：Agent 自报只有 `read/grep/find/ls`，缺 `edit` 等（截图 `image-20260625-120137`）。
- **BUG2/Split**：Split Right/Down 无 i18n、位置不合理、分屏复制全部标签（体验问题，非崩溃）。

## 反馈循环

- 主循环：`pnpm dev` 热重载 + 手动复现 + DevTools 观察（UI 类）。
- 确定信号：纯逻辑抽函数 + vitest（`pnpm test:core`）——AI 工具白名单装配尤其适用。

## 复现结果

- BUG1：打开较深 L3 内文件→点定位→稳定重叠（虚拟列表行 `top` 叠加）。
- AI 工具：对话问「你有哪些工具」→ 只回 4 个信息工具，连 search_kb/notify/subagent 都没有 → 指向 customTools 整体未达模型。

## 假设列表

### AI 工具（已确认根因）
1. **pi-SDK `tools` 白名单连带过滤 customTools**（确认）：`sdk.d.ts:37-44` + `agent-session.js:1831,1839`
   `isAllowedTool` 对 customTools 一并按名过滤。EIDON 传 `tools:[read,grep,find,ls]`，把 edit/write/bash/notify/subagent/search_kb/read_node
   全走 customTools → 名字不在白名单 → 被全部剔除。预测：把 customTool 名并入 `tools` 白名单后，模型即可见这些工具。**已验证源码逻辑成立。**

### BUG1（排序，待 dev 复现确认）
1. **开合状态三处并管竞态**（最可能）：`openIds`(React) + 命令式 `arborist.open()` + `data` 预载后代，在 reveal 多次
   `setTreeData`/多 rAF 间不同步 → 行 `top` 错乱。预测：reveal 改为单次提交 open 集合 + 单次 scrollTo 后消失。
2. **重复 id**：reveal 与并发刷新交错产生重复 path 行 → React key 撞 → 叠行。预测：日志查重复 id 命中。
3. **scrollTo 早于重渲染**：偏移过期。预测：scrollTo 前等真正渲染完成可消除。

## 插桩结果

- AI 工具：源码静态确认（见上），无需运行期插桩即可定位；修复后以「问工具列表」作回归信号。
- BUG1：计划用 `[DEBUG-ft01]` 打印 reveal 各阶段扁平 id（查重复）+ 行 `top`，dev 复现后据命中假设择定修复。
