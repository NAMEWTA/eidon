/**
 * 每日笔记代办解析/切换（纯函数，无 I/O，可在 Node 单测）。
 *
 * 供日历面板把当日 md 里的任务列表渲染为可交互 checkbox：
 *   - `parseTodos`  逐行识别 `- [ ]` / `- [x]`（兼容 `*`/`+` 列表符与任意缩进/嵌套）
 *   - `toggleTodo`  翻转指定行的勾选态，其余内容逐字保留（含行尾换行风格）
 *
 * 行号从 0 起（与 split('\n') 下标一致），便于直接回写。
 */

export interface TodoItem {
  /** 0-based 行号（对应 content.split('\n') 下标）。 */
  line: number;
  /** 勾选框后的正文（不含列表符与 checkbox 标记）。 */
  text: string;
  checked: boolean;
  /** 前导空白宽度（空格数；tab 按 1 计），用于嵌套缩进渲染。 */
  indent: number;
}

// 列表符 -/*/+ + 空格 + [ ]/[x]/[X] + （空格+正文 | 行尾）
const TODO_RE = /^(\s*)([-*+])\s+\[( |x|X)\](?:\s(.*))?$/;

export function parseTodos(content: string): TodoItem[] {
  const todos: TodoItem[] = [];
  const lines = content.split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // 跳过代码围栏内的伪任务行
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = TODO_RE.exec(line);
    if (!m) continue;
    todos.push({
      line: i,
      text: (m[4] ?? '').trim(),
      checked: m[3].toLowerCase() === 'x',
      indent: m[1].length,
    });
  }
  return todos;
}

/** 翻转第 line 行的勾选态；该行不是任务行则原样返回。 */
export function toggleTodo(content: string, line: number): string {
  const lines = content.split('\n');
  if (line < 0 || line >= lines.length) return content;
  const m = TODO_RE.exec(lines[line]);
  if (!m) return content;
  const next = m[3] === ' ' ? 'x' : ' ';
  lines[line] = lines[line].replace(/\[( |x|X)\]/, `[${next}]`);
  return lines.join('\n');
}
