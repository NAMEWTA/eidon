/**
 * cm-frontmatter.ts — CodeMirror / Lezer 的 YAML frontmatter 支持。
 *
 * 背景：`@codemirror/lang-markdown` 默认不解析 frontmatter，于是「一行文字 + 下一行 `---`」
 * 会被 Lezer 当成 setext 二级标题（`SetextHeading2`），导致顶部 frontmatter 的闭合 `---`
 * 命中 heading2 大号粗体样式（开头 `---` 是水平线 → 淡色小号），出现「一大一小」。
 *
 * 本模块提供两件东西：
 *   1. `frontmatterMarkdownExtension` — 一个 Lezer `MarkdownConfig`：仅在文档最顶端把
 *      `---\n…\n---`（或 `...` 结束）解析为独立的 `Frontmatter` 块，两个分隔线都标成
 *      `FrontmatterMark`（走 `processingInstruction` 淡色），消除「一大一小」。
 *   2. `frontmatterDecorations()` — 一个轻量 ViewPlugin：给 `Frontmatter` 覆盖的每一行加
 *      `.cm-frontmatter` 行装饰、闭合行加 `.cm-frontmatter--end`，配合 editor.css 呈现
 *      「独立块 + 底部分割线」外观。
 *
 * 两者都只在 markdown 语言层启用（见 cm-config.ts `markdownExt()`），故所有视图模式
 * （source / liveEdit）一致生效。
 */
import type { BlockContext, Line, MarkdownConfig } from '@lezer/markdown';
import { styleTags, tags as t } from '@lezer/highlight';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';

/** 顶部开界：仅 `---`（容忍行尾空白）。 */
const OPEN_FENCE = /^---[ \t]*$/;
/** 闭界：`---` 或 YAML 文档结束符 `...`（容忍行尾空白）。 */
const CLOSE_FENCE = /^(?:---|\.\.\.)[ \t]*$/;

/**
 * Lezer 块解析器：仅当 `cx.lineStart === 0`（文档最顶端）且首行是 `---` 时，把直到下一个
 * `---` / `...` 的整段解析为 `Frontmatter`。只在 line 0 触发，正文中后续真正的水平线 / setext
 * 标题完全不受影响。无闭界时收束到文档末尾，保证「匹配开界后必然 return true」，不破坏 BlockParser 契约。
 */
function parseFrontmatter(cx: BlockContext, line: Line): boolean {
  if (cx.lineStart !== 0) return false;
  if (!OPEN_FENCE.test(line.text)) return false;

  const openTo = cx.lineStart + line.text.length;
  const children = [cx.elt('FrontmatterMark', cx.lineStart, openTo)];
  let end = openTo;
  let closed = false;

  while (cx.nextLine()) {
    const lineEnd = cx.lineStart + line.text.length;
    if (CLOSE_FENCE.test(line.text)) {
      children.push(cx.elt('FrontmatterMark', cx.lineStart, lineEnd));
      end = lineEnd;
      closed = true;
      break;
    }
    end = lineEnd;
  }

  cx.addElement(cx.elt('Frontmatter', 0, end, children));
  if (closed) cx.nextLine(); // 跨过闭合 `---`，让后续正文从下一行开始解析
  return true;
}

export const frontmatterMarkdownExtension: MarkdownConfig = {
  defineNodes: [{ name: 'Frontmatter', block: true }, 'FrontmatterMark'],
  props: [
    // 两个 `---` 都走 processingInstruction（cm-live-preview.ts 已映射到 --text-faint），
    // 与开头分隔线一致；内部 YAML 行不额外染色，保持 key/value 默认可读。
    styleTags({ FrontmatterMark: t.processingInstruction }),
  ],
  parseBlock: [
    {
      name: 'Frontmatter',
      before: 'HorizontalRule', // 抢在水平线 / setext 标题解析之前
      parse: parseFrontmatter,
    },
  ],
};

/** 给 Frontmatter 块逐行加行装饰：整块淡背景 + 闭合行底部分割线（CSS 见 editor.css）。 */
const frontmatterLinePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      // frontmatter 块始终整体展示，无需随选区变化重建；仅文档/视口变化时重建。
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.build(update.view);
      }
    }

    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const doc = view.state.doc;
      const tree = syntaxTree(view.state);
      for (const { from, to } of view.visibleRanges) {
        tree.iterate({
          from,
          to,
          enter: (node) => {
            if (node.name !== 'Frontmatter') return;
            const startLine = doc.lineAt(node.from).number;
            const endLine = doc.lineAt(Math.min(node.to, doc.length)).number;
            for (let n = startLine; n <= endLine; n++) {
              const ln = doc.line(n);
              const cls = n === endLine ? 'cm-frontmatter cm-frontmatter--end' : 'cm-frontmatter';
              builder.add(ln.from, ln.from, Decoration.line({ class: cls }));
            }
          },
        });
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

export function frontmatterDecorations() {
  return [frontmatterLinePlugin];
}
