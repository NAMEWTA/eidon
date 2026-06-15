# Handoff: SoloMD Recipe 引擎

## 目标

将 SoloMD 原版 Agent Recipes 引擎的设计范式、代码资产、删除状态和同类开源方案梳理清楚，为 EIDON 2.0 后续是否/如何恢复 agent 自动化能力提供决策依据。

## 已完成

- 已从 git 历史还原 `sample-recipes/` 和 `cookbook/` 的全部内容
- 已还原 `app/core/contracts/recipe.ts` 的 Zod schema（`d0356aa` 提交）
- 已搜索 2024–2025 同类开源框架，确认 SoloMD Recipe 是自研实现而非 fork
- 已识别最接近的开源对标方案：InitRunner（Python）和 AiSentinel（Ruby）

## 未完成

- Recipe runner runtime 代码（调度器、工具循环、prompt 注入）已完全删除，未做考古还原
- `app/core/contracts/recipe.ts` 当前是否存在存根未确认（`find` 无结果，可能在本次重构中也被移除）
- 尚未决定 EIDON 2.0 的 AI 子系统采用：自研重写 vs 引入 InitRunner 类库 vs 放弃 agent 自动化

## Recipe 引擎核心总结

### 是什么

SoloMD 自研的 **声明式 AI agent 规则引擎**。用户编写一个 YAML 文件描述「何时触发 + 发给 LLM 什么 prompt + 允许哪些工具 + 写入配额」，放到 `<vault>/.solomd/agents/` 下，SoloMD 的 recipe runner 自动发现、加载并按触发器执行。

### 配置结构

```yaml
name: Weekly review
trigger: schedule              # schedule | on-save | on-commit | on-tag-add | manual
schedule: "0 18 * * SUN"      # 仅 trigger=schedule 时必须
match: "daily/**/*.md"         # 仅 on-save / on-commit 时必须；glob 模式
tag: "review"                  # 仅 on-tag-add 时必须
prompt: |                      # 发给 LLM 的系统 prompt（必填）
  Read this week's daily/ notes...
allow-write: true              # 默认 false；开启后 agent 可调用写文件工具
write-cap: 5                   # 硬上限（最大 50）；超出则 run abort，已写文件不回滚
provider: claude               # 可选，空=走 Default AI provider
model: claude-sonnet-4-6       # 可选
tools:                         # 允许的工具白名单，默认只读集
  - read_note
  - write_note
  - search
```

### 11 个已知工具（`KnownTool` 枚举）

| 只读工具 | 写入工具 |
|---|---|
| `list_notes`, `read_note`, `search` | `write_note`, `append_to_note` |
| `get_backlinks`, `list_tags`, `get_outline` |  |
| `autogit_log`, `autogit_diff` |  |
| `read_agent_trace` |  |

### 5 种触发器

| 触发器 | 必需字段 | 语义 |
|---|---|---|
| `schedule` | `schedule` | cron 表达式，到点执行 |
| `on-save` | `match` | 匹配文件保存时执行 |
| `on-commit` | `match` | git commit 包含匹配文件时执行 |
| `on-tag-add` | `tag` | 标签被添加时执行 |
| `manual` | 无 | 仅手动触发 |

### 代码资产与删除状态

| 资产 | 路径 | 状态 |
|---|---|---|
| 合约 schema | `app/core/contracts/recipe.ts` | `b5236fd` 后仅存根（当前分支可能已全删） |
| Zod golden fixtures | `fixtures/contracts/` | 同上 |
| 内置交易书（11 个） | `app/src-tauri/cookbook/` | 已删除 |
| 参考示例（1 个） | `app/src-tauri/sample-recipes/` | 已删除 |
| Runtime runner | `app/src-tauri/src/` 中相关模块 | 已删除（未考古具体文件） |

### 与同类方案的对比

| 维度 | SoloMD Recipe | InitRunner (Python) | AiSentinel (Ruby) |
|---|---|---|---|
| 配置格式 | YAML | YAML | YAML |
| 触发方式 | 5 种（vault 专用） | cron / file_watch / webhook / IM | cron |
| 工具层 | 11 个内置工具（vault 语义） | 开放 tool type 系统 | shell + sandbox |
| 写入安全 | `allow-write` + `write-cap` 硬上限 | `read_only` flag | allowlist + timeout |
| 推理策略 | 单一 ReAct | 4 种（react/todo/plan/reflexion） | 单一 tool-loop |
| 跨次记忆 | 无 | 三种（语义/情景/程序） | SQLite 持久会话 |
| 安全沙箱 | 无（信任本地 vault） | ABAC + Bubblewrap/Docker | sandbox + timeout |
| 第三方依赖 | 无（纯自研） | Anthropic/OpenAI/Google SDK 等 | rufus-scheduler + LLM SDK |

### 关键设计决策

1. **YAML 而非可视化编辑器** — 面向开发者的文本配置，与 Obsidian 社区习惯一致
2. **写入配额而非撤销** — `write-cap` 是硬上限，超出 abort 但不回滚已写文件（简化实现）
3. **工具白名单而非能力描述** — 11 个工具是编译期枚举，不给 LLM 自由描述工具的机会（降低幻觉风险）
4. **无跨次记忆** — 每次触发独立运行，不依赖前次上下文（简化调度模型）
5. **`match` glob 而非正则** — 降低用户配置门槛

## 推荐技能

- `deep-research` — 如需深入研究 InitRunner/AiSentinel 是否适合 EIDON 2.0
- `goal-builder` — 如需为新 AI 子系统编写实现任务
- `simplify` — 如需审计 `recipe.ts` 存根代码是否需要进一步清理

## 摘要

1. SoloMD Recipe 引擎是自研的声明式 AI agent 系统，YAML 配置 + cron/事件触发 + 工具白名单 + 写入配额，11 个内置工具、5 种触发器
2. 代码已整体删除（`b5236fd`），仅 `recipe.ts` Zod schema 可能残留存根；`cookbook/` 和 `sample-recipes/` 两个示例目录均已移除
3. 同类开源方案 InitRunner（Python）和 AiSentinel（Ruby）共享相同设计范式，但更通用、安全模型更成熟
4. EIDON 2.0 若恢复 agent 自动化，可选：重写原版 Recipe 引擎 / 引入 InitRunner 并适配 / 放弃本地 agent 改为外部触发
5. 原版 Recipe 的最大资产是 11 个 vault 专用工具定义——这是任何外部方案无法直接替代的领域知识
