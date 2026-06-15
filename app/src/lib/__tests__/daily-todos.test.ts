import { describe, it, expect } from 'vitest';
import { parseTodos, toggleTodo } from '../daily-todos';

const SAMPLE = [
  '# 2026-06-13',
  '',
  '## 代办',
  '- [ ] 写周报',
  '- [x] 晨跑 5km',
  '  - [ ] 嵌套子任务',
  '* [X] 大写勾选',
  '+ [ ]',
  '- 普通列表项',
  '-[ ] 缺空格不算任务',
  '```',
  '- [ ] 代码块里的伪任务',
  '```',
  '正文结束',
].join('\n');

describe('parseTodos', () => {
  it('识别 -/*/+ 列表符、大小写 x、嵌套缩进与空正文', () => {
    const todos = parseTodos(SAMPLE);
    expect(todos).toEqual([
      { line: 3, text: '写周报', checked: false, indent: 0 },
      { line: 4, text: '晨跑 5km', checked: true, indent: 0 },
      { line: 5, text: '嵌套子任务', checked: false, indent: 2 },
      { line: 6, text: '大写勾选', checked: true, indent: 0 },
      { line: 7, text: '', checked: false, indent: 0 },
    ]);
  });

  it('跳过代码围栏内的伪任务行与非任务行', () => {
    const lines = parseTodos(SAMPLE).map((t) => t.line);
    expect(lines).not.toContain(8); // 普通列表项
    expect(lines).not.toContain(9); // 缺空格
    expect(lines).not.toContain(11); // 代码块内
  });

  it('空内容 → 空数组', () => {
    expect(parseTodos('')).toEqual([]);
  });
});

describe('toggleTodo', () => {
  it('未勾 → 勾上；已勾（含大写）→ 取消', () => {
    const checked = toggleTodo(SAMPLE, 3);
    expect(checked.split('\n')[3]).toBe('- [x] 写周报');
    const unchecked = toggleTodo(SAMPLE, 4);
    expect(unchecked.split('\n')[4]).toBe('- [ ] 晨跑 5km');
    const upper = toggleTodo(SAMPLE, 6);
    expect(upper.split('\n')[6]).toBe('* [ ] 大写勾选');
  });

  it('保留缩进与其余内容逐字不变', () => {
    const out = toggleTodo(SAMPLE, 5);
    const lines = out.split('\n');
    expect(lines[5]).toBe('  - [x] 嵌套子任务');
    lines[5] = SAMPLE.split('\n')[5];
    expect(lines.join('\n')).toBe(SAMPLE);
  });

  it('非任务行 / 越界行号 → 原样返回', () => {
    expect(toggleTodo(SAMPLE, 0)).toBe(SAMPLE);
    expect(toggleTodo(SAMPLE, 8)).toBe(SAMPLE);
    expect(toggleTodo(SAMPLE, 999)).toBe(SAMPLE);
    expect(toggleTodo(SAMPLE, -1)).toBe(SAMPLE);
  });
});
