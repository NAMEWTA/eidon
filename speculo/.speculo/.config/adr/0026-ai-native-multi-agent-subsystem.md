# ADR-0026 · AI-Native 多 Agent 子系统（取代 0018/0019 与「离线-only」NFR）

**状态：** 已执行（2026-06）

## 背景

ADR-0018 把 AI·Agent·Recipes 判为「不在范围」，ADR-0019 物理删除该子系统、仅留 `shared/models/ai.ts` +
`backend/domain/ai.ts` 占位（`isAiAvailable()` 恒 false），并把「完全离线、无联网依赖」列为非功能约束（NFR）。

产品方向反转：EIDON 要成为 **AI-Native 应用**——以 `pi-sdk`（`@earendil-works/pi-ai` +
`@earendil-works/pi-coding-agent`）为基座，深度参考 `temp/openhanako-main`（HanaAgent，成熟的 pi-sdk 多 Agent
桌面应用）的范式，做一个与 EIDON 四层架构融合的多 Agent 系统。

**决策：** 重新引入 AI 作为旗舰能力层，**取代 ADR-0018/0019 与「离线-only」NFR**。工程上**复用现有四层
【代码】架构与全部现有能力**，严格遵守：**仅 `backend/domain/ai/` 可 import Pi SDK**；`capabilities/ai/**`
纯 node（禁 electron）；前端只走 `window.eidon` + 事件。完整方案见
`~/.claude/plans/eidon-ai-native-snoopy-raccoon.md`。

## 已确认的子决策（D1–D6）

1. **D1 Agent = 全局文件夹**：Agent 是跨工作区常驻助手，存 `~/.eidon/agents/{id}/`：`config.json`（zod，
   {@link AgentConfigSchema}）+ 人格相关 markdown（`identity.md` 身份简介 · `ishiki.md` 意识/主人格 ·
   `experience.md` 经验 · `pinned.md` 置顶记忆）+ `sessions/`/`cron-jobs.json`。全局资源 `~/.eidon/{providers,auth,
   tools,channels,bridge}.json` + `skills/`。路径经 `capabilities/ai/runtime-paths.aiHome`（main 注入
   `os.homedir()/.eidon`）保持 capability 纯 node。
2. **D2 磁盘契约单一事实源**（沿用 ADR-0005/0014）：AgentConfig / ProvidersFile（含逐 provider `headers` +
   逐模型 `ModelMeta`）/ CronJobsFile / ChannelsFile / **BridgeBindingsFile** 全为 `shared/contracts/ai.ts` 的
   zod；凭证（provider API key、平台 secret/botToken）落 gitignored `auth.json`（含 `bridge` 段）。改形状先改
   契约 + `fixtures/contracts/` 再改解析（`pnpm contracts:check`）。
3. **D3 系统托盘常驻**：关窗隐藏到托盘而非退出，main 进程持续托管 60s cron 调度器与平台桥接；仅托盘菜单 /
   `Cmd+Q` 真退出（`backend/shell/tray.ts` + `lifecycle/quit-state.ts`）。
4. **D4 多 Agent 协作**：可见性（public/private）+ `activatableByAgents` 二次确认门控团队花名册与 `subagent`
   委派；`notify` 工具 + cron 完成自动回灌（`eidon:agent-activity` → Toast + 系统通知）；群聊频道
   (`channels.json`) 成员依次作答。系统提示拼装 = identity + ishiki + pinned（+ experience 若启用）。
5. **D5 设置体验对齐 HanaAgent**（P5）：助手（卡片选择 + 身份/意识/经验/工具/技能 + 置顶 + 模型/可见性/cron/
   头像）、供应商（两栏 list→detail + key/baseUrl/自定义 headers + 逐模型能力编辑 + 默认模型）、技能（per-agent
   启用）。复用基元 `frontend/components/ai/settings-ui`（Section/Row/Toggle/KeyInput）。经现有 `agents:get`/
   `agents:update` 富 payload 读写人格正文（无需新通道）。
6. **D6 多平台接入走官方接口**（P4）：**飞书** = 官方 `@larksuiteoapi/node-sdk` 的 `WSClient` 长连接收消息
   （dial-out 免公网）+ `im.message.create` 回发；**微信** = 腾讯官方 **iLink** 协议（`ilinkai.weixin.qq.com`，
   2026-03 正式个人号 Bot API）：扫码登录 + `getupdates` 长轮询 + `sendmessage` 回发。每平台绑定一个 agentId；
   入站 → 绑定 Agent 的桥接会话 → prompt → 回发。微信硬约束：仅 1v1 私聊、24h 上下文窗口（影响 cron 推送）、
   bot_token 每次扫码轮换、用登录返回的 baseUrl。

## 落点（四层纵切）

```
shared/    contracts/ai.ts(zod 磁盘契约 + Bridge*) · models/ai.ts(wire 类型 + Bridge*/流事件) ·
           ipc/{channels,events}.ts(ai/providers/agents/tools/skills/cron/channels/bridge 通道 + eidon:ai-*/agent-activity/bridge-* 事件)
backend/   capabilities/ai/*(纯 node IO：paths/store/providers/agent/tools/cron/channels + bridge/{feishu,wechat}-adapter,wechat-login,manager,bridge-store) ·
           domain/ai/*(唯一 import Pi SDK：provider/session/tools/skills + systemPrompt 拼装) ·
           services/ai-service.ts(编排 + 会话注册表 + cron 调度 + 群聊 + 桥接路由/扫码) ·
           ipc/handlers/ai.handlers.ts · shell/{tray,index,lifecycle/quit-state}
bridge/    ipc/ai.ts(eidonInvoke 包装 + 事件订阅)
frontend/  stores/ai.ts · components/ai/*(AiPanel/Composer/MessageList + AgentTab/ProvidersTab/SkillsTab/BridgeTab/AiChannels/AgentCron + settings-ui) · components/panels/SettingsPanel.tsx(AI/助手/供应商/技能/接入 分类)
```

## 取代关系

- **取代 0018**（AI 不在范围）：AI 重新进入范围，作为旗舰能力层。
- **取代 0019**（物理删除 + 离线 NFR）：占位 stub 被实现取代；`isAiAvailable()` 改为「已配至少一个 provider
  key 即可用」；「完全离线」NFR 撤销（AI 推理与平台桥接需联网；非 AI 的知识库/编辑/版本能力仍本地优先）。

## 边界与约束（不可逾越）

1. 四层单向依赖；**仅 `backend/domain/ai/` import Pi SDK**；`capabilities/ai/**` 纯 node（禁 electron）；桥接编排
   在 `services/ai-service.ts`，不在 capability 里碰 domain/Pi；前端只走 `window.eidon` + 事件。
2. 新增 IPC 通道同步改 `IpcContract` + `CHANNEL_PRESENCE`（`Handlers` 映射类型编译期穷尽，漏一即编译错）。
3. 凭证落 gitignored `auth.json`；`@larksuiteoapi/node-sdk` + `qrcode` 经 `externalizeDepsPlugin` 外置（同 Pi SDK，
   运行时从 node_modules 加载）。

## 验证

`pnpm typecheck` + `pnpm lint`（四层边界 0 违规）+ `pnpm test:core`（111）+ `pnpm test:ui`（115）+
`pnpm contracts:check`（24）+ `electron-vite build`（三进程，SDK 外置）全绿。**端到端（需真实凭证，未自动化）：**
配 provider key → 单/多 Agent 流式对话 + 工具调用；飞书沙箱自建应用长连接收发；微信扫码登录后私聊收发。

## 后续（已设计，未在本期实现）

桥接「全量」能力（媒体 AES-128-ECB CDN 上下行、飞书 CardKit 实时流式卡片、微信草稿流式、输入中指示、群聊媒体）
与 telegram/qq 适配器、Agent 记忆系统（高斯衰减 + LLM 编译记忆，需 utility/embedding 模型角色）、供应商用量台账、
EIDON 专属工具（read_node/search_kb/git_diff）。本期桥接为**官方协议文本优先**实现，上述为下一层。
