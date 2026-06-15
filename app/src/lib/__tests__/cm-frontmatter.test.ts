import { describe, expect, it } from 'vitest';
import { parser } from '@lezer/markdown';

import { frontmatterMarkdownExtension } from '../cm-frontmatter';

const p = parser.configure([frontmatterMarkdownExtension]);

/** 解析后收集出现过的节点类型名集合。 */
function nodeNames(doc: string): Set<string> {
  const tree = p.parse(doc);
  const names = new Set<string>();
  tree.iterate({ enter: (n) => void names.add(n.name) });
  return names;
}

describe('frontmatter Lezer 解析', () => {
  it('顶部 frontmatter 解析为 Frontmatter，而非 SetextHeading2', () => {
    const doc = '---\ntype: Note\ntag: w\n---\n\n# Title\n';
    const names = nodeNames(doc);
    expect(names.has('Frontmatter')).toBe(true);
    expect(names.has('FrontmatterMark')).toBe(true);
    // 闭合 `---` 不再被当成 setext 二级标题下划线 → 不出现 SetextHeading2。
    expect(names.has('SetextHeading2')).toBe(false);
    // 正文标题仍正常解析。
    expect(names.has('ATXHeading1')).toBe(true);
  });

  it('两个分隔线都标成 FrontmatterMark（共 2 个）', () => {
    const doc = '---\na: 1\n---\nbody\n';
    const tree = p.parse(doc);
    let marks = 0;
    tree.iterate({ enter: (n) => { if (n.name === 'FrontmatterMark') marks++; } });
    expect(marks).toBe(2);
  });

  it('支持 YAML 结束符 `...` 作闭界', () => {
    const doc = '---\na: 1\n...\nbody\n';
    expect(nodeNames(doc).has('Frontmatter')).toBe(true);
  });

  it('正文中部真正的 setext 标题不受影响（仍是 SetextHeading2）', () => {
    const doc = '# Top\n\nSome text\n---\n';
    const names = nodeNames(doc);
    expect(names.has('Frontmatter')).toBe(false);
    expect(names.has('SetextHeading2')).toBe(true);
  });

  it('`---` 不在文档顶端时不触发 frontmatter', () => {
    const doc = 'intro\n\n---\nkey: val\n---\n';
    expect(nodeNames(doc).has('Frontmatter')).toBe(false);
  });

  it('无闭界的残缺 frontmatter 收束到文末，不破坏解析', () => {
    const doc = '---\na: 1\nb: 2\n';
    const names = nodeNames(doc);
    expect(names.has('Frontmatter')).toBe(true);
    expect(names.has('SetextHeading2')).toBe(false);
  });
});
