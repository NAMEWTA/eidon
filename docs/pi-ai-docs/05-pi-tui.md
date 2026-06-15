# 05 — pi-tui: 终端 UI 库

> 包名: `@earendil-works/pi-tui`
> 源码: `packages/tui/`

## 概述

极简终端 UI 框架，核心特性：Component 树 + 差分渲染 + 同步输出（防闪烁）。

对 Eidon 而言**参考价值较低**（Eidon 是 Tauri 桌面应用，React UI 渲染，不涉及终端 UI），
但 Component 系统的设计模式和事件处理仍有借鉴意义。

## Component 系统

```typescript
interface Component {
  render(width: number): string[];      // 每行不能超过 width
  handleInput?(data: string): void;     // 接收原始终端字节（含 ANSI）
  invalidate?(): void;                  // 清除缓存渲染状态
}
```

**关键规则**:
- 每行渲染输出不可超过 `width`，否则 TUI 抛出异常
- 每行后 TUI 自动追加 SGR reset + OSC 8 reset
- 样式不跨行传递——多行样式文本需每行重新应用或使用 `wrapTextWithAnsi()`

### Focusable（IME 支持）

需要文本光标和 IME（CJK 等）的组件实现 `Focusable`：
- TUI 设置 `focused = true`
- 渲染输出中扫描 `CURSOR_MARKER`（零宽度 APC 序列）定位硬件光标
- 容器组件必须传播 focus 给子组件

## 内置组件

| 组件 | 功能 |
|------|------|
| `Container` | 子组件分组，`addChild`/`removeChild` |
| `Box` | 带 padding 和背景色的容器 |
| `Text` | 多行自动换行文本 |
| `TruncatedText` | 单行截断文本（状态栏用） |
| `Input` | 单行输入 + 水平滚动 |
| `Editor` | 多行编辑器 + 自动补全 + 粘贴 |
| `Markdown` | Markdown 渲染 + 代码高亮 |
| `Loader` | 动画加载器 |
| `CancellableLoader` | Loader + Escape 取消 + AbortSignal |
| `SelectList` | 键盘导航选择列表 |
| `SettingsList` | 设置面板 + 值切换 |
| `Spacer` | 垂直空白行 |
| `Image` | 内联图片（Kitty/iTerm2 协议） |

## 差分渲染（三种策略）

每一帧 TUI 自动选择最优策略：

1. **首次渲染**: 全部输出（不清除历史 scrollback）
2. **宽度改变或变更在视口上方**: 清屏 + 全量渲染
3. **正常更新**: 光标移到第一个变更行 → 从该行向下清除 → 渲染受影响行

全部包裹在**同步输出**（`\x1b[?2026h` … `\x1b[?2026l`）中，原子性、无闪烁。

触发渲染: `tui.requestRender()`（内置动画组件自动调用）

## 事件处理

### 输入分发

```
终端 stdin → TUI → 聚焦 overlay (如有) → 聚焦组件 → 全局 listener
```

### 按键检测

```typescript
import { matchesKey, Key } from "@earendil-works/pi-tui";

matchesKey(data, Key.ctrl("c"));   // Ctrl+C
matchesKey(data, Key.enter);       // Enter
matchesKey(data, Key.up);          // ↑
matchesKey(data, Key.shift("tab"));// Shift+Tab
```

支持 Kitty 键盘协议。

### 全局 InputListener

```typescript
tui.addInputListener((data) => {
  if (matchesKey(data, "ctrl+c")) {
    tui.stop();
    process.exit(0);
  }
});
```

## 主题系统

```typescript
interface SelectListTheme {
  selectedPrefix: (text: string) => string;
  selectedText: (text: string) => string;
  description: (text: string) => string;
  scrollInfo: (text: string) => string;
  noMatch: (text: string) => string;
}
```

各组件主题定义其渲染样式函数。pi 内置 `dark` 和 `light` 主题，支持热重载。

## 布局系统

### Overlay 系统

```typescript
const handle = tui.showOverlay(component, {
  width: 60,                  // 固定宽度 或 "80%"
  minWidth: 40,
  maxHeight: 20,              // 或 "50%"
  anchor: "center",           // 或 top-left, bottom-right 等
  row: "25%",                 // 百分比位置（覆盖 anchor）
  col: 5,                     // 绝对位置（覆盖百分比/anchor）
  margin: 2,                  // 或 { top, right, bottom, left }
  visible: (w, h) => w >= 100, // 响应式可见性
  nonCapturing: true,          // 不自动获取焦点
});

handle.hide(); handle.show(); handle.focus(); handle.unfocus();
```

**OverlayHandle**: `hide()`, `setHidden()`, `isHidden()`, `focus()`, `unfocus()`, `isFocused()`

位置解析优先级: 绝对 `row/col` > 百分比 `row/col` > `anchor`

## 自动补全

```typescript
const provider = new CombinedAutocompleteProvider(commands, cwd);
editor.setAutocompleteProvider(provider);
```

触发: `/` → 命令补全, Tab → 文件路径补全, `@` → 可附加文件

## 工具函数

| 函数 | 功能 |
|------|------|
| `visibleWidth(str)` | 忽略 ANSI 码的可视宽度 |
| `truncateToWidth(str, w, ellipsis?)` | 截断并保留 ANSI |
| `wrapTextWithAnsi(str, w)` | 自动换行并保留 ANSI |
| `matchesKey(data, key)` | 按键检测（含 Kitty 协议） |

## 完整生命周期

```
1. new ProcessTerminal()
2. new TUI(terminal)
3. tui.addChild(components...)
4. tui.setFocus(editor)
5. tui.addInputListener(ctrl+c)
6. tui.start()               → 进入 raw mode, 开始事件循环
   └─ terminal.start(onInput, onResize)
7. 用户输入 → handleInput() → 组件更新 → tui.requestRender()
8. tui.stop()                → 退出 raw mode, 恢复终端
```

## Eidon 关联

Eidon 是 Tauri 2 + React 19 桌面应用，**不直接使用 pi-tui**。但以下设计模式可借鉴：

1. **Component 接口规范**: `render(width) → string[]` + `handleInput` + `invalidate` 的三方法契约可映射到 React 组件的 props/state/effects
2. **Overlay 系统**: 对话框/模态窗口的位置解析优先级（绝对 > 百分比 > anchor）可用于 Eidon 的面板系统
3. **差分渲染思想**: 虽然 React 已处理 DOM diff，但 Eidon 的 Canvas/WebGL 渲染（精灵表等）场景需要自己的增量更新策略
4. **主题系统**: 样式函数模式可在 Eidon 的 CSS 变量/ThemeContext 中参考
