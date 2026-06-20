/**
 * MarkdownHelp.tsx — Markdown 语法 / 快捷键对话框。
 * 两个 tab：syntax（可搜索的语法卡片网格）、shortcuts（分组快捷键表）。
 * computed → useMemo；v-model → 受控 input；点击代码块复制到剪贴板。
 * Esc 关闭由父组件（App）统一处理；本组件只在 open 时渲染并上抛 close。
 */
import { useMemo, useState } from 'react';
import { Icon } from '../shared/Icons';

interface MarkdownHelpProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'syntax' | 'shortcuts';

interface Shortcut {
  keys: string;
  zh: string;
  en: string;
}
interface ShortcutGroup {
  title: string;
  items: Shortcut[];
}
const shortcutGroups: ShortcutGroup[] = [
  {
    title: '文件 / Files',
    items: [
      { keys: 'Ctrl+N', zh: '新建 Markdown 文件', en: 'New markdown file' },
      { keys: 'Ctrl+Alt+N', zh: '新建纯文本文件', en: 'New plain text file' },
      { keys: 'Ctrl+Shift+N', zh: '新建窗口', en: 'New window' },
      { keys: 'Ctrl+O', zh: '打开文件', en: 'Open file' },
      { keys: 'Ctrl+S', zh: '保存', en: 'Save' },
      { keys: 'Ctrl+Shift+S', zh: '另存为', en: 'Save As' },
      { keys: 'Ctrl+W', zh: '关闭标签页', en: 'Close tab' },
    ],
  },
  {
    title: '视图 / View',
    items: [
      { keys: 'Ctrl+Shift+P', zh: '编辑 / 分栏 / 预览 三档循环', en: 'Cycle Edit / Split / Preview' },
      { keys: 'Ctrl+B', zh: '文件树显隐', en: 'Toggle file tree' },
      { keys: 'Ctrl+Shift+O', zh: '大纲显隐', en: 'Toggle outline' },
      { keys: 'Ctrl+\\', zh: '向右分屏', en: 'Split editor right' },
      { keys: 'Ctrl+Shift+\\', zh: '向下分屏', en: 'Split editor down' },
      { keys: 'Ctrl+Alt+→ / ←', zh: '焦点切到下一/上一面板', en: 'Focus next / prev pane' },
    ],
  },
  {
    title: '搜索 & 跳转 / Search & Navigate',
    items: [
      { keys: 'Ctrl+F', zh: '编辑器内查找（预览模式则在预览中查找）', en: 'Find in editor (or preview when in Preview mode)' },
      { keys: 'Ctrl+Shift+F', zh: '跨文件夹搜索', en: 'Search across folder' },
      { keys: 'Ctrl+Shift+K', zh: '命令面板', en: 'Command palette' },
      { keys: 'F1 / Ctrl+/', zh: '帮助（这个对话框）', en: 'Help (this dialog)' },
      { keys: 'Ctrl+,', zh: '设置', en: 'Settings' },
    ],
  },
  {
    title: '编辑 & 格式化 / Editing',
    items: [
      { keys: 'Ctrl+Alt+L', zh: '格式化 Markdown（Prettier）', en: 'Format Markdown (Prettier)' },
      { keys: 'Ctrl+J', zh: 'AI 改写所选文本（需在设置开启）', en: 'AI rewrite the selection (requires enabling in Settings)' },
      { keys: 'Cmd/Ctrl + click [[link]]', zh: '跳转到双链目标', en: 'Open the target of a [[wikilink]]' },
      { keys: 'Tab', zh: '增加缩进 / 跨表格列', en: 'Indent / table column nav' },
      { keys: 'Shift+Tab', zh: '减少缩进', en: 'Outdent' },
    ],
  },
  {
    title: '工作区 / Workspace',
    items: [
      { keys: 'Ctrl+P', zh: '快速切换最近文件（VSCode 风格）', en: 'Quick file switcher (VSCode-style)' },
      { keys: 'Ctrl+D', zh: '打开今日的每日笔记', en: "Open today's daily note" },
      { keys: '(Command palette)', zh: 'Properties Table —— Bases 视图（按 Ctrl+Shift+K 找 "bases"）', en: 'Properties Table — Bases view (Ctrl+Shift+K → bases)' },
    ],
  },
  {
    title: '导出 / Export',
    items: [
      { keys: 'Ctrl+Shift+Alt+P', zh: '导出 PDF（系统打印对话框）', en: 'Export PDF (system print)' },
      { keys: 'Ctrl+Shift+C', zh: '复制为 HTML', en: 'Copy as HTML' },
    ],
  },
];

interface Item {
  /** Bilingual category label, e.g. "标题 / Headings" */
  category: string;
  syntax: string;
  example: string;
  /** Chinese description */
  zh: string;
  /** English description */
  en: string;
}

const C = {
  headings: '标题 / Headings',
  emphasis: '强调 / Emphasis',
  lists: '列表 / Lists',
  links: '链接与图片 / Links & Images',
  code: '代码 / Code',
  quotes: '引用 / Quotes',
  tables: '表格 / Tables',
  math: '数学公式 / Math (KaTeX)',
  diagrams: '图表 / Diagrams',
  extras: '扩展语法 / Extras',
  other: '其他 / Other',
};

const items: Item[] = [
  // Headings
  {
    category: C.headings,
    syntax: '# Heading',
    example: '# H1\n## H2\n### H3',
    zh: '一到六级标题，# 的数量决定级别',
    en: 'Headings 1–6, the number of # is the level',
  },

  // Emphasis
  {
    category: C.emphasis,
    syntax: '**bold**',
    example: '**bold text**',
    zh: '加粗文字',
    en: 'Bold text',
  },
  {
    category: C.emphasis,
    syntax: '*italic*',
    example: '*italic text*',
    zh: '斜体文字',
    en: 'Italic text',
  },
  {
    category: C.emphasis,
    syntax: '~~strike~~',
    example: '~~deleted~~',
    zh: '删除线',
    en: 'Strikethrough',
  },
  {
    category: C.emphasis,
    syntax: '`code`',
    example: '`inline code`',
    zh: '行内代码',
    en: 'Inline code',
  },
  {
    category: C.emphasis,
    syntax: '==mark==',
    example: '==highlighted==',
    zh: '高亮（GFM 扩展）',
    en: 'Highlight (GFM extension)',
  },

  // Lists
  {
    category: C.lists,
    syntax: '- item',
    example: '- Apple\n- Banana\n- Cherry',
    zh: '无序列表（- 或 * 都行）',
    en: 'Unordered list (- or * works)',
  },
  {
    category: C.lists,
    syntax: '1. item',
    example: '1. First\n2. Second\n3. Third',
    zh: '有序列表',
    en: 'Ordered list',
  },
  {
    category: C.lists,
    syntax: '- [ ] task',
    example: '- [ ] Todo\n- [x] Done',
    zh: '任务列表，可点击切换状态',
    en: 'Task list, click checkbox to toggle',
  },
  {
    category: C.lists,
    syntax: '  - nested',
    example: '- Outer\n  - Inner\n    - Deeper',
    zh: '缩进 2 个空格 = 嵌套一层',
    en: 'Indent 2 spaces to nest deeper',
  },

  // Links & images
  {
    category: C.links,
    syntax: '[text](url)',
    example: '[Google](https://google.com)',
    zh: '链接：[显示文字](网址)',
    en: 'Link: [text](url)',
  },
  {
    category: C.links,
    syntax: '![alt](url)',
    example: '![Logo](./logo.png)',
    zh: '图片：和链接一样，前面加 !',
    en: 'Image: same as link, prefixed with !',
  },
  {
    category: C.links,
    syntax: '<url>',
    example: '<https://example.com>',
    zh: '自动链接',
    en: 'Autolink',
  },
  {
    category: C.links,
    syntax: '[text][ref]',
    example: 'See [the docs][1].\n\n[1]: https://example.com',
    zh: '引用式链接，便于复用 URL',
    en: 'Reference-style link, reuse the URL',
  },
  {
    category: C.links,
    syntax: '[[note]]',
    example: '[[Welcome]]\n[[Welcome|home page]]\n[[Welcome#Get started]]',
    zh: '双链：跳转工作区中同名笔记。Cmd/Ctrl+点击打开。开 `[[` 自动补全。',
    en: 'Wikilink to a note in the workspace folder. Cmd/Ctrl+click to open. Type `[[` for autocomplete. Optional `|alias` and `#heading`.',
  },

  // Code
  {
    category: C.code,
    syntax: '```lang',
    example: '```js\nconsole.log("hi")\n```',
    zh: '代码块，可指定语言名启用语法高亮（js/python/rust/...）',
    en: 'Fenced code block, set the language for syntax highlighting',
  },
  {
    category: C.code,
    syntax: '    indent',
    example: '    indented code',
    zh: '4 空格缩进也是代码块',
    en: 'Indenting 4 spaces also makes a code block',
  },

  // Quotes
  {
    category: C.quotes,
    syntax: '> quote',
    example: '> Knowledge is power.\n> — Bacon',
    zh: '引用块，可多行',
    en: 'Blockquote, can span multiple lines',
  },
  {
    category: C.quotes,
    syntax: '> > nested',
    example: '> outer\n> > inner',
    zh: '嵌套引用',
    en: 'Nested blockquote',
  },

  // Tables
  {
    category: C.tables,
    syntax: '| h1 | h2 |',
    example: '| Name | Age |\n|------|-----|\n| Ada  | 36  |\n| Bob  | 24  |',
    zh: '表格：第二行 --- 必须有，对齐用 :--- :---: ---:',
    en: 'Table: second row of --- is required; alignment with :--- :---: ---:',
  },

  // Math (KaTeX)
  {
    category: C.math,
    syntax: '$inline$',
    example: '$E = mc^2$',
    zh: '行内数学公式',
    en: 'Inline math',
  },
  {
    category: C.math,
    syntax: '$$block$$',
    example: '$$\n\\int_0^\\infty e^{-x^2} dx\n$$',
    zh: '块级数学公式',
    en: 'Block math',
  },

  // Mermaid
  {
    category: C.diagrams,
    syntax: '```mermaid',
    example: '```mermaid\nflowchart LR\nA --> B\nB --> C\n```',
    zh: '流程图（mermaid 代码块），支持 flowchart / sequence / gantt 等',
    en: 'Diagram via Mermaid: flowchart / sequence / gantt etc.',
  },

  // Extras
  {
    category: C.extras,
    syntax: '[^1]',
    example: 'See note[^1].\n\n[^1]: This is the note.',
    zh: '脚注：正文标记 + 底部定义',
    en: 'Footnote: marker in text + definition at bottom',
  },
  {
    category: C.extras,
    syntax: '---\nkey: val\n---',
    example: '---\ntitle: My Doc\nauthor: Alex\n---\n\n# body',
    zh: 'YAML front-matter（文档元数据，必须在首行）',
    en: 'YAML front-matter (document metadata, must be at line 1)',
  },

  // Other
  {
    category: C.other,
    syntax: '---',
    example: 'Above\n\n---\n\nBelow',
    zh: '水平分隔线（也可用 *** 或 ___）',
    en: 'Horizontal rule (--- or *** or ___)',
  },
  {
    category: C.other,
    syntax: '\\*escape',
    example: '\\*literal asterisk\\*',
    zh: '反斜杠转义特殊字符',
    en: 'Backslash to escape special characters',
  },
  {
    category: C.other,
    syntax: '  ↵',
    example: 'line one  \nline two',
    zh: '行尾两个空格 = 强制换行',
    en: 'Two trailing spaces = hard line break',
  },
];

async function copyExample(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* 复制失败静默——与 既有实现一致 */
  }
}

export function MarkdownHelp({ open, onClose }: MarkdownHelpProps) {
  const [activeTab, setActiveTab] = useState<Tab>('syntax');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = `${it.category} ${it.syntax} ${it.example} ${it.zh} ${it.en}`.toLowerCase();
      return q.split(/\s+/).every((tok) => hay.includes(tok));
    });
  }, [query]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const it of filtered) {
      if (!seen.has(it.category)) {
        seen.add(it.category);
        out.push(it.category);
      }
    }
    return out;
  }, [filtered]);

  function itemsOf(cat: string) {
    return filtered.filter((it) => it.category === cat);
  }

  if (!open) return null;

  return (
    <div
      className="help__backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="help" role="dialog" aria-label="EIDON help">
        <header className="help__header">
          <div className="help__tabs">
            <button className={activeTab === 'syntax' ? 'active' : ''} onClick={() => setActiveTab('syntax')}>Markdown 语法</button>
            <button className={activeTab === 'shortcuts' ? 'active' : ''} onClick={() => setActiveTab('shortcuts')}>快捷键</button>
          </div>
          {activeTab === 'syntax' && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="help__search"
              placeholder="搜索语法 / Search syntax…"
              spellCheck={false}
            />
          )}
          <button className="help__close" onClick={() => onClose()}><Icon name="close" size={18} /></button>
        </header>
        <div className="help__body">
          {activeTab === 'syntax' && (
            <>
              {categories.map((cat) => (
                <section key={cat} className="help__section">
                  <h3>{cat}</h3>
                  <div className="help__grid">
                    {itemsOf(cat).map((it, i) => (
                      <div key={i} className="help__item">
                        <div className="help__syntax">{it.syntax}</div>
                        <div className="help__desc help__desc--zh">{it.zh}</div>
                        <div className="help__desc help__desc--en">{it.en}</div>
                        <pre
                          className="help__example"
                          onClick={() => copyExample(it.example)}
                          title="Click to copy / 点击复制"
                        >{it.example}</pre>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              {!filtered.length && <p className="help__empty">No matching syntax</p>}
            </>
          )}

          {activeTab === 'shortcuts' && (
            <>
              <p className="help__lead">
                <code>Ctrl</code>（Linux/Windows）= <code>Cmd</code>（Mac）。完整命令清单按 <kbd>Ctrl+Shift+K</kbd> 打开命令面板。
              </p>
              {shortcutGroups.map((g) => (
                <section key={g.title} className="help__section">
                  <h3>{g.title}</h3>
                  <table className="help__keys">
                    <tbody>
                      {g.items.map((s, i) => (
                        <tr key={i}>
                          <td className="help__keys-key"><kbd>{s.keys}</kbd></td>
                          <td className="help__keys-desc">
                            <div>{s.zh}</div>
                            <div className="help__keys-en">{s.en}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </>
          )}

        </div>
        <footer className="help__footer">
          点击代码块可复制 · 按 <kbd>Esc</kbd> 或点击外部关闭<br />
          Click any code block to copy · Press <kbd>Esc</kbd> or click outside to close
        </footer>
      </div>
    </div>
  );
}

export default MarkdownHelp;
