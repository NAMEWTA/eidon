/**
 * CodeMirror 6 · Markdown 富文本高亮样式（源码模式用）。
 *
 * `markdownRichStyle` — 一个 HighlightStyle：让标题更大、粗体真的加粗、行内代码等宽着色等；
 * 标记符（`#`、`**`、`` ` `` 等）始终可见，缓冲区保持纯 Markdown 源码。由 `richHighlightOnly()`
 * 在 source / split / preview / reading 等非 liveEdit 模式下使用。
 *
 * 注：旧的「离开行隐藏标记符」轻量实时预览（livePreviewExtension / liveMarkdownPlugin）已随
 * source ↔ liveEdit 二态模型退役删除；完整的所见即所得渲染见 cm-live-render.ts。
 */

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Rich syntax highlighting for markdown tokens. Sizes are in `em` so they
// scale with the user's font-size setting. Heading colors gradient from
// stronger (h1) to softer (h6) for visual hierarchy.
export const markdownRichStyle = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.7em', fontWeight: '700', lineHeight: '1.25', color: 'var(--md-h1)' },
  { tag: t.heading2, fontSize: '1.4em', fontWeight: '700', lineHeight: '1.3', color: 'var(--md-h2)' },
  { tag: t.heading3, fontSize: '1.22em', fontWeight: '700', color: 'var(--md-h3)' },
  { tag: t.heading4, fontSize: '1.1em', fontWeight: '700', color: 'var(--md-h4)' },
  { tag: t.heading5, fontWeight: '700', color: 'var(--md-h5)' },
  { tag: t.heading6, fontWeight: '700', color: 'var(--md-h6)' },
  { tag: t.strong, fontWeight: '700', color: 'var(--md-strong)' },
  { tag: t.emphasis, fontStyle: 'italic', color: 'var(--md-em)' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--text-muted)' },
  { tag: t.link, color: 'var(--md-link)' },
  { tag: t.url, color: 'var(--md-url)' },
  { tag: t.monospace, fontFamily: 'var(--font-mono)', color: 'var(--md-code)', backgroundColor: 'var(--md-code-bg)' },
  { tag: t.quote, color: 'var(--md-quote)', fontStyle: 'italic' },
  { tag: t.list, color: 'var(--md-list)' },
  { tag: t.processingInstruction, color: 'var(--text-faint)' },
  { tag: t.contentSeparator, color: 'var(--md-hr)' },
  // Code block syntax highlighting (provided by nested language packages)
  { tag: t.keyword, color: 'var(--syn-keyword)' },
  { tag: t.string, color: 'var(--syn-string)' },
  { tag: t.number, color: 'var(--syn-number)' },
  { tag: t.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: t.function(t.variableName), color: 'var(--syn-function)' },
  { tag: t.variableName, color: 'var(--syn-variable)' },
  { tag: t.typeName, color: 'var(--syn-type)' },
  { tag: t.className, color: 'var(--syn-type)' },
  { tag: t.propertyName, color: 'var(--syn-property)' },
  { tag: t.operator, color: 'var(--syn-operator)' },
  { tag: t.punctuation, color: 'var(--text-muted)' },
  { tag: t.bracket, color: 'var(--text-muted)' },
  { tag: t.bool, color: 'var(--syn-number)' },
  { tag: t.null, color: 'var(--syn-number)' },
  { tag: t.tagName, color: 'var(--syn-keyword)' },
  { tag: t.attributeName, color: 'var(--syn-property)' },
  { tag: t.attributeValue, color: 'var(--syn-string)' },
]);

/** Just the rich highlight style without hiding markers (raw source mode). */
export function richHighlightOnly() {
  return [syntaxHighlighting(markdownRichStyle)];
}
