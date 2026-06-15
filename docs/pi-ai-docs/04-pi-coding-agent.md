# 04 — pi-coding-agent: CLI 与扩展系统

> 包名: `@earendil-works/pi-coding-agent`
> 源码: `packages/coding-agent/`

## 概述

旗舰级终端编码代理 CLI。通过扩展系统、Skills、Prompt Templates 和 Themes 实现高度可定制。

## CLI 基本用法

```bash
pi [options] [@files...] [messages...]

# 交互模式
pi "Add error handling to this file"

# 打印模式（非交互）
pi -p "What is in this file?" @src/main.ts

# JSON 事件流模式
pi --mode json "Explain the code"

# RPC 模式（JSONL over stdin/stdout）
pi --mode rpc
```

## 关键 CLI 选项

### 模型选择

```bash
--provider anthropic|openai|google|...
--model sonnet:high              # provider/id 或 :thinking 简写
--thinking off|minimal|low|medium|high|xhigh
--models "sonnet,haiku,gpt-4o"   # Ctrl+P 切换列表
--list-models [search]           # 列出可用模型
--api-key <key>                  # 覆盖环境变量
```

### 会话管理

```bash
-c, --continue              # 恢复最近的会话
-r, --resume                # 浏览并选择历史会话
--session <path|id>         # 指定会话文件或 UUID
--fork <path|id>            # 从已有会话 fork 新会话
--session-dir <dir>         # 自定义会话存储目录
--no-session                # 临时模式（不保存）
-n, --name <name>           # 会话显示名称
```

### 工具控制

```bash
-t, --tools <list>          # 白名单工具
-xt, --exclude-tools <list> # 禁用工具
-nbt, --no-builtin-tools    # 禁用内置工具
-nt, --no-tools             # 默认禁用所有工具
```

内置工具: `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`

### 资源加载

```bash
-e, --extension <source>    # 加载扩展（可重复）
--skill <path>              # 加载 skill（可重复）
--prompt-template <path>    # 加载模板（可重复）
--theme <path>              # 加载主题（可重复）
--no-extensions / --no-skills / --no-themes / --no-prompt-templates
--no-context-files, -nc     # 跳过 AGENTS.md / CLAUDE.md
```

## 会话系统

### 存储格式

JSONL 树状结构（每条记录有 `id` 和 `parentId`），支持原地分支。存储在 `~/.pi/agent/sessions/`。

### 交互命令

| 命令 | 功能 |
|------|------|
| `/resume` | 选择历史会话 |
| `/new` | 新建会话 |
| `/name <name>` | 设置显示名 |
| `/session` | 显示会话信息（文件、ID、消息数、token、费用） |
| `/tree` | 查看会话树（支持搜索、折叠、标签、过滤） |
| `/fork` | 从历史消息 fork 新会话 |
| `/clone` | 复制当前分支到新会话 |
| `/compact [prompt]` | 手动压缩上下文 |
| `/copy` | 复制最后一条助手消息 |
| `/export [file]` | 导出为 HTML |
| `/share` | 上传为私有 GitHub gist |
| `/trust` | 保存项目信任决定 |
| `/reload` | 重新加载扩展/skills/模板 |
| `/settings` | 修改配置 |
| `/model` | 切换模型 |
| `/login` / `/logout` | OAuth 认证 |
| `/hotkeys` | 显示快捷键 |
| `/changelog` | 版本历史 |
| `/quit` | 退出 |

### 树导航 (`/tree`)

- 输入搜索、Ctrl+←/→ 折叠/展开、←/→ 翻页
- Ctrl+O 切换过滤模式（默认→无工具→仅用户→仅标签→全部）
- Shift+L 添加书签标签
- Shift+T 切换标签时间戳

### Fork 与 Clone

- **Fork** (`/fork`): 从分支上的历史用户消息创建新会话，该消息出现在编辑器中可修改
- **Clone** (`/clone`): 复制当前活跃分支到新会话文件，保留完整历史

## 配置系统

### 设置文件

```json
// ~/.pi/agent/settings.json (全局)
// .pi/settings.json (项目级，覆盖全局)
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "defaultProjectTrust": "ask",
  "enableInstallTelemetry": true
}
```

### 项目信任

交互式启动时，pi 询问是否信任包含本地设置/资源的项目：
- 受信后加载 `.pi/settings.json`、项目资源、项目扩展
- 非交互模式 (`-p`, `--mode json`, `--mode rpc`) 使用 `defaultProjectTrust` 设置
- `--approve`/`-a` 或 `--no-approve`/`-na` 单次覆盖

### 上下文文件

自动发现并加载 `AGENTS.md` / `CLAUDE.md`：
- `~/.pi/agent/AGENTS.md` (全局)
- 从 cwd 向上遍历父目录
- 当前目录

### 系统提示覆盖

- `.pi/SYSTEM.md` 替换默认系统提示
- `APPEND_SYSTEM.md` 追加而不替换

### 关键环境变量

| 变量 | 用途 |
|------|------|
| `PI_CODING_AGENT_DIR` | 配置目录（默认 `~/.pi/agent`） |
| `PI_CODING_AGENT_SESSION_DIR` | 会话目录 |
| `PI_PACKAGE_DIR` | 包目录 |
| `PI_OFFLINE` | 禁用所有启动网络操作 |
| `PI_SKIP_VERSION_CHECK` | 跳过版本更新检查 |
| `PI_TELEMETRY` | 遥测开关 |
| `VISUAL` / `EDITOR` | 外部编辑器 |

## 交互模式 UI

### 编辑器功能

| 功能 | 操作 |
|------|------|
| 文件引用 | `@` + 模糊搜索 |
| 路径补全 | Tab |
| 多行输入 | Shift+Enter |
| 图片粘贴 | Ctrl+V |
| Bash 透传 | `!command` (输出给 LLM), `!!command` (静默执行) |

### 消息队列

- **Enter**: 排队 steering 消息（当前轮次完成后发送）
- **Alt+Enter**: 排队 follow-up 消息（Agent 完成后发送）
- **Escape**: 中止，队列消息恢复到编辑器
- **Alt+Up**: 取回队列消息到编辑器

## Pi Packages

可打包扩展、Skills、Prompts、Themes 通过 npm/git 分发：

```json
{
  "name": "my-pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

安装: `pi install npm:@foo/pi-tools` / `pi install git:github.com/user/repo`

## SDK 编程使用

```typescript
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager
} from "@earendil-works/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

await session.prompt("What files are in the current directory?");
```

## 设计哲学（"不做"清单）

pi 刻意不包括以下功能，全部留给扩展：

- **不内置 MCP** — 用 Skills 或扩展实现
- **不内置子代理** — 用 tmux 或扩展实现
- **不内置权限弹窗** — 容器化或用扩展实现
- **不内置 Plan 模式** — 写 plan 到文件，或扩展实现
- **不内置 TODO** — 用 TODO.md 文件
- **不内置后台 Bash** — 用 tmux

## Eidon 集成要点

1. **Skills 机制可复用**: Eidon 的 AI 功能可以定义为 Skills（`SKILL.md` 文件），如"整理知识库"、"总结月度报告"等
2. **Pi Packages 模式**: Eidon 的 AI 功能可打包为扩展，方便分发和版本管理
3. **会话持久化借鉴**: JSONL 树状结构 + fork/clone 很适合 Eidon 的多分支 workspace 场景
4. **配置分层**: 全局→项目→CLI 参数的三层配置覆盖很实用
5. **不需要 CLI 部分**: Eidon 是 GUI 应用，使用 SDK 编程模式即可
