# EIDON AI-Native 升级方案 · P4 多平台接入 + P5 设置体验对齐 HanaAgent（并入 v1）

## Context（这次修订为什么做）

EIDON 的 AI-Native v1 **P0–P3 + 系统托盘已落地、全绿**（typecheck/lint/build 0；core 106 + ui 115 +
contracts 21 测试过；Electron 实机启动无异常）。已交付：provider/模型配置、Agent CRUD（全局
`~/.eidon/agents/`）+ 可见性/激活、`@agent` 切换 + `subagent` 协作、每 Agent cron + 通知回灌、群聊频道、
`@//$` 补全 Composer、全局工具/skills 管理。详见记忆 `eidon-ai-native-subsystem.md`。

原方案把 **P4 多平台接入（飞书/微信）延后到 v2**。本次修订按用户指令**把 P4 并入 v1**：参考
`temp/openhanako-main`（HanaAgent）**全量移植**飞书 + 微信桥接，二者均走**官方接口**。

**第二项修订（新增 P5）：** 用户要求**完整参考 HanaAgent `设置/{助手,技能,社交平台,供应商}`** 的实现
与交互 UI，重做 EIDON 的 AI 助手设置体验。EIDON 现状是**扁平最小实现**——`AiSettings.tsx`（10 个
provider 密码框 + 默认模型下拉 + 工具勾选）、`AiAgents.tsx`（name/description/persona/model/可见性 扁平
表单），远未达 HanaAgent 富设置。P5 把这套体验移植进 EIDON 四层。**已确认范围**：助手 = 完整做
**身份简介/意识/经验/工具/技能** 5 项 + **轻量置顶记忆 pins**（高斯衰减+LLM编译记忆延后、不引入
utility/embedding 角色）；供应商 = **核心两栏** list→detail（预设 + key/baseUrl/headers + 逐模型编辑；模型
角色与用量台账延后）。

**一处关键事实更正**（原方案把微信标为「非官方/封号风险/实验」，已过时）：
- **飞书** = `@larksuiteoapi/node-sdk`（飞书官方 Node SDK）。HanaAgent 用 `WSClient` **长连接**收消息
  （`feishu-adapter.ts:470`），`client.im.message.create` 回发——**dial-out、无需公网回调**。
- **微信** = **iLink（智联）协议**（`ilinkai.weixin.qq.com`），腾讯 **2026-03 正式发布**的官方个人号 Bot API
  （「微信 ClawBot」插件，有《使用条款》法律背书），扫码登录 → 长轮询 `getupdates` → `sendmessage` 回发
  ——同样 **dial-out、无需公网回调**。官方 npm 包 `@tencent-weixin/openclaw-weixin` 是 OpenClaw 网关插件、
  与宿主版本绑定、**非独立可用**，故社区（含 HanaAgent）都**直连复刻 iLink 协议**。本方案即移植 HanaAgent
  的直连实现（`wechat-adapter.ts` + `wechat-login.ts` + `wechat-ilink-media-crypto.ts`）。

两平台都 dial-out、不需公网回调、**依赖托盘常驻 main**（P0.5 已落地）→ 关窗后桥接持续在线。

---

## P4 总体设计：把 HanaAgent `lib/bridge/` 全量移植进 EIDON 四层

**四层归位（关键）：** 适配器是**纯 node**（飞书 SDK 走 HTTP/WebSocket、微信走 `fetch`+`node:crypto`），
放 `backend/capabilities/ai/bridge/**`（**禁 electron、禁 Pi SDK**）。「入站→找绑定 Agent 的会话→`prompt`
→流结束回发」是**编排**，放 `backend/services/ai-service.ts`。`backend/domain/ai/` 仍是唯一 import Pi SDK 的层、
本期基本不动（仅按需加一个「桥接会话工厂」按 sessionKey 复用每用户会话）。前端只经 `window.eidon` + 事件。

### 移植文件映射（HanaAgent → EIDON）

| HanaAgent `lib/bridge/` | → EIDON `backend/capabilities/ai/bridge/` | 说明 |
|---|---|---|
| `feishu-adapter.ts` / `feishu-outbound-renderer.ts` | 同名 | 官方 `@larksuiteoapi/node-sdk`：WSClient 长连 + EventDispatcher；`im.message.create` / `im.image.create` / `im.file.create` / CardKit 卡片 |
| `wechat-adapter.ts` / `wechat-login.ts` / `wechat-ilink-media-crypto.ts` | 同名 | iLink 直连：扫码登录、`getupdates` 长轮询、`sendmessage`、媒体 AES-128-ECB 上下行、sync buffer |
| `session-key.ts` | 同名 | 数据驱动前缀表 `SESSION_PREFIX_MAP`（保留 `fs_*`/`wx_dm_`，删 `tg_*`/`qq_*`）；`parseSessionKey`/`collectKnownUsers` |
| `bridge-manager.ts`（108KB，含大量 HanaAgent 专属物） | **拆分**：精简「适配器注册/生命周期」入 `bridge/bridge-manager.ts`（capability，纯 node）；「入站路由/会话编排/流式草稿协调/状态广播」并入 `services/ai-service.ts` | 统一 `spec.create(creds,onMessage,hooks,agentId)`（`bridge-manager.ts:102/107/128`）+ `adapter.{start,stop,sendReply,sendBlockReply,sendDraft,sendRichDraft,sendTypingIndicator,cancelTypingIndicator,sendMedia,download*}` + `streamingCapabilities`/`richStreamingCapabilities` |
| `bridge-context.ts` / `bridge-presentation.ts` / `outbound-http.ts` / `owner-policy.ts` | 同名（按需裁剪） | 出站 HTTP、归属策略、上下文呈现 |
| `media-*.ts`（utils/capabilities/delivery-service/item-normalizer/publisher/roots）+ `streaming/interaction/receipt-capabilities.ts` | `bridge/media/*`、`bridge/capabilities/*` | **全量移植**（用户选「全量」）：媒体上下行 + 富流式（CardKit/草稿）+ 输入中指示 + 回执 |
| `telegram-*.ts` / `qq-*.ts` | **不移植** | 本期仅飞书 + 微信；session-key 数据驱动，后续加平台只补前缀表 + 适配器 |

> 「全量移植」≠ 逐字拷 108KB：`bridge-manager.ts` 含 HanaAgent 的 desk/deferred-result/diary 等专属编排，
> 移植时**只取平台无关的桥接编排**（适配器生命周期、入站路由、流式草稿协调、状态/媒体投递），其余按 EIDON
> 现有 `ai-service` 会话注册表与事件改写。逐文件移植时**先读 `.agents/skills/pi-sdk`**（改 domain/ai 前必读）。

---

## 纵向切片（P4 新增/改动，遵循 todos 域模板）

**`shared/`（先改契约再改解析，ADR-0005/0014）：**
- `contracts/ai.ts`：新增 `BridgePlatformSchema = z.enum(["feishu","wechat"])`、`BridgeBindingSchema`
  `{ platform, agentId, enabled, label?, config? }`、`BridgeBindingsFileSchema`（落 `~/.eidon/bridge.json`）。
  **凭证不进此文件** → 飞书 `appId/appSecret`、微信 `botToken/baseUrl` 落 `auth.json`（已有 `AuthFileSchema`，
  扩 `bridge` 段，gitignored）。`fixtures/contracts/bridge.json` 新增 + `ai.conformance.test.ts` 覆盖。
- `models/ai.ts`：wire 类型 `BridgePlatform`、`BridgeBinding`、`BridgeStatus`
  `{platform,agentId,state:"idle"|"connecting"|"online"|"error",error?}`、`BridgeInbound`
  `{platform,agentId,userId,preview}`、`WechatLoginState`（QR dataUrl + `waiting|scanned|confirmed|expired|error`）。
- `ipc/channels.ts`：新增 `bridge:*` 通道 + **同步补 `CHANNEL_PRESENCE`**（启动期穷尽校验）：
  `bridge:listPlatforms` / `bridge:listBindings` / `bridge:bind` / `bridge:unbind` / `bridge:setEnabled` /
  `bridge:status` / `bridge:wechatStartLogin` / `bridge:wechatCancelLogin`。
- `ipc/events.ts`：新增 `eidon:bridge-status`（每绑定连接态）、`eidon:bridge-inbound`（外部来消息提示）、
  `eidon:bridge-wechat-qr`（扫码 QR + 状态推送）。同步进 `EIDON_EVENT` 常量。

**`backend/`：**
- `capabilities/ai/bridge/**`：上表移植（**纯 node**）。凭证读写复用 `capabilities/ai/store`（auth.json）。
- `services/ai-service.ts`：① 桥接注册表 + 托盘常驻 main 启动时拉起 enabled 绑定的 `adapter.start()`；
  ② 入站 `onMessage` → `sessionKey={platform}_dm_{userId}@{agentId}`（微信仅 DM；飞书 DM+群 `fs_group_`）→
  取/建该 Agent 的桥接会话（复用现有会话注册表 + domain/ai `session`）→ `prompt` →
  流式经 `adapter.sendRichDraft/sendDraft` 实时更新（CardKit/草稿）、完成 `sendReply`；③ `onStatus` →
  `eidon:bridge-status`；④ 媒体上下行经移植的 `media-delivery-service`。
- `ipc/handlers/ai.handlers.ts`：接 `bridge:*` 通道 → service。
- `shell/{lifecycle,index}.ts`：托盘常驻 main **就绪后**启动桥接、**真退出前** `adapter.stop()`（复用
  `lifecycle/quit-state.ts`）。`shell/tray.ts` 托盘菜单可加「桥接：在线/离线」状态项（可选）。
- `package.json`：加 `@larksuiteoapi/node-sdk` + `qrcode`（微信 QR 渲染）；微信媒体走 `node:crypto`（无新依赖）。
  按 Pi SDK 同样方式处理 ESM/external 外置打包。

**`bridge/` + `frontend/`：**
- `bridge/ipc/ai.ts`：加 `bridge:*` 包装（`eidonInvoke`）+ 订阅 `eidon:bridge-{status,inbound,wechat-qr}`。
- `frontend/stores/ai.ts`：bindings / 每平台 status / 微信 QR 登录态。
- `frontend/components/ai/` + `SettingsPanel.tsx`：新增**「接入 / Bridge」**设置分类（`components.css` 的
  `data-active-cat` 白名单**记得加 `bridge`**——P0–P3 曾因漏白名单导致空白页）：
  - 平台列表（飞书 / 微信）+ 每平台：选**绑定 Agent**、启停开关、实时状态徽标。
  - **飞书**：填 `appId/appSecret`（提示：建自建应用 → 开机器人 → 事件订阅选「长连接」模式 → 授 im:message 权限）。
  - **微信**：「扫码登录」按钮 → 后端 `bridge:wechatStartLogin` 拉 QR → `eidon:bridge-wechat-qr` 推 `<img>` +
    `waiting/scanned/confirmed/expired` → confirmed 后存 `botToken`。
  - i18n `en.ts`/`zh.ts` 补 `bridge.*` 文案。

---

## 平台硬约束（写进实现与 UI 提示）

**微信 iLink：**
- **仅 1v1 私聊**（平台硬限制，`isGroup` 恒 false）→ 只有 `wx_dm_*` sessionKey，无群聊。
- **24h 上下文窗口**：回复须用入站消息带的 `context_token`（不可复用、24h 有效）；**超窗不能主动触达** →
  **cron 主动推送微信仅在窗口内有效**，超窗优雅降级并在 UI/活动流提示。
- **bot_id/bot_token 每次扫码轮换**（设计如此）→ 提供「重新登录」流程刷新凭证。
- 登录响应的 `baseurl` 可能不同于默认 `ilinkai.weixin.qq.com` → **后续请求一律用返回的 baseUrl**。
- 请求头 `X-WECHAT-UIN` 每次随机（防重放）；媒体 CDN 走 **AES-128-ECB** 加解密（移植 `wechat-ilink-media-crypto.ts`）。
- 风险声明：腾讯可随时变更/下线 iLink，UI 标注「实验性官方通道，勿用于核心业务」。

**飞书：** 需用户建飞书自建应用并开机器人 + 事件订阅（**长连接**模式，免公网）+ 授 im:message 等权限；
支持 DM + 群聊；CardKit 卡片可**实时流式**更新（移植 `FEISHU_CARDKIT_STREAMING_CAPABILITIES`）。

---

## P5 设置体验对齐 HanaAgent（助手 · 技能 · 供应商 · 社交平台）

### 概念映射（HanaAgent → EIDON）

| HanaAgent | EIDON 落点 | 说明 |
|---|---|---|
| 身份 `identity.md`（短一行） | `~/.eidon/agents/{id}/identity.md`（现有 persona） | **身份简介**：缩为简介，也进团队名册 |
| 意识 `ishiki.md`（长，主人格） | **新增** `~/.eidon/agents/{id}/ishiki.md` | **意识** = 详细人格/语气/行为，系统提示主体（`ishiki.example.md` 即「人格定义」正文） |
| 经验（分类 markdown） | **新增** `experience.md` + `config.experience.enabled` | `# 类目\n1. 条目`；`parseExperience/serializeExperience` 移植自 `tabs/agent/AgentExperience.tsx` |
| 置顶 `pinned.md` | **新增** `pinned.md` | 自由 markdown 列表，**永不衰减**，直接注入上下文 |
| 工具开关 | 现有 `config.tools.disabled` | 仅补 UI（移植 `AgentToolsSection` 范式） |
| 技能开关 | 现有 `config.skills.enabled` | 补 per-agent UI + 独立 Skills 页 |
| 头像 | 现有 `config.avatar` + `agents/{id}/avatar.*` | 卡片堆叠头像 + 文件选择（裁剪可后续） |

> **系统提示拼装**（`backend/domain/ai/`，唯一 Pi SDK 层）：`systemPrompt = identity + ishiki + pinned（+ experience 若启用）`。
> 现状仅注入 persona/identity → 扩为合并 ishiki + pins + experience；其余 Pi 包装不变。**不引入** utility/embedding 模型角色（记忆衰减/编译延后）。

### 复用基元（移植到 `frontend/components/ai/settings/`，统一观感、复用 EIDON CSS 变量）

- `SettingsSection`（变体 `default`/`double-column`/`flush` + `context` 右上角插槽，承载「本区作用于哪个对象」的开关/选择器）、
  `SettingsRow`（label/hint/control/layout）。源：`settings/components/SettingsSection.tsx`、`SettingsRow.tsx`。
- `Toggle`、`ComboInput`（预设+自由输入）、`SelectWidget`（分组+图标）、`ProviderIcon`、`NumberInput`、`KeyInput`（密钥框不回显）。

### 助手设置：替换 `AiAgents.tsx` → 富 AgentTab（移植 `tabs/AgentTab.tsx`）

- **AgentCardStack**（移植 `tabs/agent/AgentCardStack.tsx`）：横向扇形卡片堆叠——头像、悬停展开、拖拽排序
  （新 `agents:reorder`）、点选切换、点已选→换头像、`+` 新建卡、选中卡操作（设为主/导出/删除）。
- 名称输入 + **模型胶囊**（`SelectWidget` 按 provider 分组 + `ProviderIcon`）。
- 「关于 Ta」：**身份**（textarea×3 → `identity.md`）、**意识**（textarea×10 → `ishiki.md`）。
- **置顶记忆 pins**（移植 `MemorySection` 的 pins 部分）：列表 + 增/删（写 `pinned.md`）；**不做**衰减/编译/健康条。
- **经验**（移植 `AgentExperience.tsx`）：启用 Toggle + 分类块（块名 + 编号条目、行内编辑/删除）→ `experience.md`。
- **工具**（移植 `AgentToolsSection.tsx`）：可选工具逐项 Toggle → `config.tools.disabled`。
- **技能**：本 Agent 启用的 skill 勾选（也在独立 Skills 页管理）。
- 新建/删除走 overlay（移植 `AgentCreateOverlay`/`AgentDeleteOverlay` 范式）；`AgentCron`（已有）并入卡片编辑区。

### 供应商设置：替换 `AiSettings.tsx` 的 provider 部分 → 两栏 ProvidersTab（移植 `tabs/ProvidersTab.tsx`）

- **两栏**（`SettingsSection variant="double-column"`）：左 = provider 列表（状态点=是否有凭证、`ProviderIcon`、名称、
  模型数）+「添加自定义」；右 = `ProviderDetail`。
- **ProviderDetail**（移植 `tabs/providers/ProviderDetail.tsx`）：凭证（API key + baseUrl + 自定义 headers，
  移植 `ApiKeyCredentials`/`ProviderHeadersField`）+ `ProviderModelList`。
- **ModelEditPanel**（移植同名）：逐模型 显示名 / 上下文长度（`ComboInput` 预设）/ 最大输出 / 能力开关（vision·video·audio·reasoning）。
- **预设**：移植 `utils/provider-presets.ts`（~17 家：ollama 本地、dashscope、openai、gemini、deepseek、volcengine、
  moonshot、zhipu、siliconflow、groq、mistral、minimax、openrouter、xiaomi… 各带 url + api 风味），**对齐 pi-ai 的 provider id**。
- 默认模型选择保留（现有 `providers.json.defaultModel`）。**延后**：模型角色（utility/embedding）、用量台账、OAuth/Coding Plan 分组。

### 技能设置：新增 Skills 页（移植 `tabs/SkillsTab.tsx` 精简版）

- 列出已发现 skill（现有 `skills:list` / ResourceLoader）+ **per-agent 启用 Toggle**（写 `config.skills.enabled`）。
- 安装（.skill 文件 / base64）、查看（`SkillViewerOverlay` 范式）、删除。bundles / marketplace **延后**。

### 社交平台设置（P4 桥接 UI，按 HanaAgent 范式）

- **BridgeAgentRow**（移植同名）：选「本平台绑定哪个 Agent」（横向头像行，tab 级 context）。
- **PlatformSection**（移植同名，声明式 `credentialFields`）：状态点+文字+启用 Toggle 作 section context；
  凭证输入（text/secret `KeyInput`）+「测试」按钮。**飞书**用此（appId/appSecret）。
- **WechatSection**（移植同名）：扫码登录态——未登录「扫码」→ QR overlay（`WechatQrcodeOverlay`）；已登录显示「重扫/解绑」+ 24h 回复窗口提醒。
- 全局设置（权限模式/回执/富流式开关）+ **对外意识 publicIshiki**（桥接专用人格 textarea）+ **BridgeTutorial** 帮助 overlay。

### 契约与 IPC（先改 `shared/contracts/ai.ts` zod + `fixtures/`，再改解析）

- `AgentConfigSchema` 扩：`experience: { enabled: z.boolean().default(false) }`、（可选）`yuan?`；**ishiki/experience/pinned 为同目录 `.md` 文件**（非 config 内联，便于 diff/备份/迁移）。
- `ProviderConfigSchema` 扩：`headers: z.record(z.string(), z.string()).default({})`、`models: z.record(模型id, { displayName?, context?, maxOutput?, image?, video?, audio?, reasoning? })`。
- provider 预设作为常量（前端或 shared 叶子常量，非磁盘契约）。
- IPC（扩 `IpcContract` + `CHANNEL_PRESENCE` 穷尽校验）：`agents:setIdentity/setIshiki/setExperience/setPins/setTools/setSkills/setAvatar/reorder/getDoc`（读 identity/ishiki/experience/pinned 文本）；
  `providers:summary/addCustom/delete/setConfig(baseUrl,headers,enabled)/setModelMeta`（`listModels` 已有）。可把多项折进现有 `agents:update` 富 payload，仅新增 setAvatar/reorder/getDoc/provider:* 等。
- 后端：`capabilities/ai/agent-store` 扩 ishiki/experience/pinned/avatar 文件 IO；`providers-store` 扩 headers/模型元数据；`domain/ai` 系统提示拼装扩展；`ai-service` + `ai.handlers` 接线。
- `SettingsPanel.tsx`：把 `agents` 分类升级为富 AgentTab，新增 `providers`/`skills`/`bridge` 分类；**新分类必须进 `components.css` 的 `data-active-cat` 白名单**（P0–P3 踩过的坑）。i18n 补 `settings.agent.*`/`settings.providers.*`/`settings.skills.*`/`settings.bridge.*`。

---

## 里程碑（更新后）

- **P0–P3 + 托盘**：✅ 已交付、全绿（见 Context）。
- **P4 多平台接入（本期，全量移植，并入 v1）**：飞书（官方 SDK 长连，DM+群+CardKit 流式）+
  微信（官方 iLink，DM + 扫码登录 + 媒体 + 草稿流式）；契约/通道/事件/服务编排/「接入」UI 全套；依赖托盘常驻。
- **P5 设置体验对齐 HanaAgent（本期，并入 v1）**：助手（卡片堆叠 + 身份/意识/经验/工具/技能 + 置顶 pins）、
  供应商（核心两栏 list/detail + 预设 + key/baseUrl/headers + 逐模型编辑）、技能（独立页 + per-agent 启用）、
  社交平台（P4 UI 按 PlatformSection/WechatSection 范式）；复用基元 `SettingsSection`/`SettingsRow`/`Toggle` 等移植。
- **收尾（本期一并完成）**：
  - **EIDON 专属工具** `read_node`/`search_kb`/`git_diff`：`domain/ai/tools.ts` 用 `defineTool` 定义，
    execute 调 service 注入的回调（接 nodes/knowledge/git 域）。当前用 Pi 内置 read/grep/find/ls 覆盖。
  - **补 ADR-0026+**：AI-Native 子系统 / 多 Agent 数据模型 / 托盘生命周期 / **多平台桥接（官方 iLink + 飞书长连）**。
  - **更新记忆** `eidon-ai-native-subsystem.md`：决策 #3 反转（P4 已并入 v1）、修正「微信=官方 iLink（2026-03）」、
    记录 P5 设置体验对齐（身份/意识/经验/工具/技能 + pins；供应商两栏）+ 概念映射（identity=简介、ishiki=意识、experience=经验）。

---

## 不可逾越约束（全程遵守）

1. 四层单向依赖；**仅 `backend/domain/ai/` import Pi SDK**；`capabilities/ai/bridge/**` 纯 node（禁 electron）；
   前端只走 `window.eidon` + 事件。桥接编排放 `services/ai-service.ts`，不在 capability 里碰 domain/Pi。
2. 新增 IPC 通道**同步**改 `IpcContract` + `CHANNEL_PRESENCE`（启动穷尽校验，漏一个即启动失败）。
3. 改磁盘形状**先**改 `shared/contracts/ai.ts` zod + `fixtures/`，再改解析（`pnpm contracts:check`）。
4. 凭证（飞书 `appSecret`、微信 `botToken`）落 `auth.json`，gitignored；`bridge.json` 只存非密绑定元数据。
5. 设置新分类**必须**进 `components.css` 的 `data-active-cat` 白名单（否则空白页）。
6. 「分层」「三层」禁裸用，显式限定【代码】/【节点】。

## 验证

- `pnpm lint`（四层边界机器强制）+ `pnpm typecheck` + `pnpm test:core` + `pnpm test:ui` + `pnpm contracts:check` 全绿。
- **设置体验（P5）**：助手页卡片堆叠可建/选/拖序/换头像；编辑 身份/意识/经验/工具/技能/置顶 均落盘对应文件并经
  `systemPrompt` 注入（新会话验证人格生效）；供应商页两栏可选 provider、填 key/baseUrl/headers、逐模型改上下文/能力，
  默认模型可选；技能页 per-agent 启用生效；四个新分类无空白页（`data-active-cat` 白名单已含）。
- **飞书端到端**：建沙箱自建应用 → 长连接连上（`eidon:bridge-status=online`）→ 私聊 + 群聊各收发一条 →
  绑定 Agent 用其人格/模型回复 → CardKit 卡片**实时流式**更新 → 关主窗（托盘）仍在线。
- **微信端到端**：设置页扫码登录 → 拿 `botToken`（confirmed）→ 私聊收发一条 → 图片上/下行（AES 解密正确）→
  草稿流式更新 → 关窗仍在线 → 24h 窗口内 cron 可推送、超窗优雅降级。
- **边界**：适配器断连重连（`onStatus` 投影状态）、`botToken` 轮换后重登、同一 `sessionKey` 复用会话、
  真退出（Cmd+Q）时 `adapter.stop()` 释放、媒体 sync buffer 持久化。

---

### 参考来源（微信 iLink 官方性核查）
- [@tencent-weixin/openclaw-weixin — npm](https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin)
- [iLink 是什么？腾讯微信官方 OpenClaw ClawBot Bot API 指南](https://allclaw.org/blog/what-is-ilink-zh)
- [微信 — OpenClaw 官方频道文档](https://docs.openclaw.ai/zh-CN/channels/wechat)
- [x1ah/wechat-ilink-demo — 独立调用 iLink 协议（无需 OpenClaw）](https://github.com/x1ah/wechat-ilink-demo)
- [corespeed-io/wechatbot — 多语言 iLink Bot SDK](https://github.com/corespeed-io/wechatbot)