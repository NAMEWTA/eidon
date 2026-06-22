# Handoff

## 目标

把 EIDON 升级为 **AI-Native 多 Agent 应用**，基于 pi-sdk（`@earendil-works/pi-ai` +
`@earendil-works/pi-coding-agent`），深度参考 `temp/openhanako-main`（HanaAgent）的实现范式。
诉求：多 Agent（人格/工具/skills/命令 + 每 Agent 定时任务 + @ 协作 + 可被激活/发现为子 Agent）、
全局工具/skills 管理、模型提供商/模型配置、多平台接入（微信/飞书）、以及右栏顶部唤起的
`@`文件 / `@agent:` / `/`skill\|command / `$`变量 对话框。

下一步重点：① EIDON 专属知识库工具；② P4 多平台接入（飞书/微信）。

## 已完成

v1（P0–P3 + 系统托盘）+ 全部「精简点」均已落地、四层架构合规、全绿。严格遵守：
**仅 `backend/domain/ai/` 可 import Pi SDK**；前端只走 `window.eidon` + 事件；capability 纯 node。

落点（**只列路径，正文见代码/计划**）：
- `app/shared/`：`contracts/ai.ts`（zod 磁盘契约单一事实源）、`models/ai.ts`（wire 类型）、
  `utils/cron.ts`（cron 时间数学）、`ipc/{channels,events}.ts`（新增 ai/providers/agents/tools/skills/cron/channels 通道 + 3 个 `eidon:ai-*`/`agent-activity` 事件）。
- `app/backend/capabilities/ai/`：`paths/store/providers-store/agent-store/tools-store/cron-store/channels-store`；
  `capabilities/runtime-paths.ts` 扩 `aiHome`（main 注入 `~/.eidon`）。
- `app/backend/domain/ai/`：`provider/session/tools/skills/index`（唯一 Pi SDK 层；`projectEvent` 事件投影、`AiSession` 封装、`subagent`/`notify` 工具、ResourceLoader 发现 skills）。
- `app/backend/services/ai-service.ts`：编排 + 会话注册表 + 60s cron 调度器 + 群聊一轮编排。
- `app/backend/ipc/handlers/ai.handlers.ts`；`app/backend/shell/{index,tray}.ts` + `lifecycle/quit-state.ts` + `window/main-window.ts`（关窗→隐藏托盘）。
- `app/bridge/ipc/ai.ts`；`app/frontend/stores/ai.ts`；`app/frontend/components/ai/*`
  （AiPanel/Composer/MessageList/AiSettings/AiAgents/AiChannels/AgentCron）+ `styles/ai.css`；
  edits：ActivityBar（右栏顶部 AI 按钮）、App.tsx、SettingsPanel（AI/Agents 分类）、`lib/persistence/settings.ts`、i18n。
- 测试：`shared/__tests__/contracts/ai.conformance.test.ts`、`shared/__tests__/shared/cron.test.ts`、
  `backend/capabilities/ai/__tests__/store.test.ts`、`backend/domain/ai/__tests__/session.test.ts`；
  fixtures：`fixtures/contracts/{agent,providers}.json`。

关键决策（详见计划文件，勿在此复制）：Agent 存全局 `~/.eidon/`；加系统托盘使 cron/桥接关窗后仍跑；
v1=P0–P3、P4 多平台延后；Pi SDK 用 `@earendil-works`（非 `@mariozechner`）；本期取代 ADR-0018/0019 + 离线 NFR。

近期修复：① 设置 AI/Agents 页空白＝`frontend/styles/components.css` 的 `data-active-cat` 白名单漏了
`ai`/`agents`（已补）；② cron 结果回灌＝`notify` 工具 + cron 完成发 `eidon:agent-activity` → Toast + 系统通知；
③ `/`slash 真实数据＝`skills:list` + 内置 command；④ 群聊＝`channels.json` + `channels:*` + 成员依次作答（message_start 带 agentName）。

## 未完成

- **EIDON 专属工具**（read_node / search_kb / git_diff）：用 `defineTool` 在 `domain/ai/tools.ts` 定义，
  execute 调 service 注入的回调（service 接 nodes/knowledge/git 域）。当前用 Pi 内置 read/grep/find/ls 覆盖工作区读取。
- **P4 多平台接入（飞书/微信）**：方案已在计划文件设计——移植 HanaAgent `temp/openhanako-main/lib/bridge/`
  适配器（`feishu-adapter`/`wechat-adapter`），落 `backend/capabilities/ai/bridge/`（纯 node），每平台绑定一个 agentId，
  入站经 service 路由到该 Agent 会话、回复经适配器回发。依赖托盘常驻。
- **补 ADR-0026+**：登记 AI-Native 子系统 / 多 Agent 数据模型 / 托盘生命周期 / 多平台（尚未写）。
- 小项：cron `cron` 表达式 UI 提示完善；`pnpm-workspace.yaml` 里 `@google/genai`/`protobufjs` 现为 `false`（用 Google provider 时需翻 `true`）；`@agent:`/`skill` 目前以文本指令注入（可做得更结构化）。

## 验证

已运行（全绿，命令在仓库根执行）：
- `pnpm typecheck` → 0；`pnpm lint` → 0（四层边界机器强制通过）；`pnpm build` → 0（三进程打包，ESM-only Pi SDK 正确外置）。
- `pnpm test:core` → 106；`pnpm test:ui` → 115；`pnpm contracts:check` → 21（共 242 通过）。
- 运行时：`pnpm dev` 实机启动 Electron，主进程零异常，IPC 穷尽校验通过（新增全部 handler 覆盖），托盘+调度器启动正常。

未运行 / 原因：
- 真实 API key 下的端到端流式对话（需用户提供 key；后端链路已验证、`domain/ai` 事件投影有单测）。
- 渲染后设置页截图（CSS 修复已由逻辑 + build 确认；可在 app 内目视）。

## 推荐技能

- `.agents/skills/pi-sdk`（SKILL.md + `references/{pi-ai-api,pi-coding-agent-api,eidon-integration}.md`）——
  Pi SDK API 与 EIDON 集成的首要参考；改 `backend/domain/ai/**` 前必读。
- 通读 `AGENTS.md`（四层【代码】架构权威）+ 记忆 `eidon-ai-native-subsystem.md`（子系统现状与决策）。
- 改磁盘形状先改 `shared/contracts/ai.ts` + `fixtures/`（ADR-0005/0014）。

## 摘要

1. EIDON AI-Native v1（P0–P3 + 托盘）+ 全部精简点已完成并全绿（242 测试 / typecheck / lint / build / 实机启动）。
2. 架构：四层合规，Pi SDK 仅在 `backend/domain/ai/`；Agent=全局 `~/.eidon/` 文件夹；托盘使 cron 关窗后仍跑。
3. 已交付：provider/模型配置、Agent CRUD + 可见性/激活、@agent 切换 + subagent 协作、每 Agent cron + 通知回灌、群聊频道、`@//$` 补全、全局工具/skills 管理。
4. 待办：EIDON 专属工具（read_node 等）、P4 飞书/微信接入、补 ADR-0026+。
5. 完整方案在 `~/.claude/plans/speculo-commands-grill-me-md-agents-ski-deep-shannon.md`；多平台参考 `temp/openhanako-main/lib/bridge/`。
