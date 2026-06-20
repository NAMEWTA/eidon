import { describe, expect, it } from 'vitest';

import {
  ensureFrontmatterTimestamps,
  splitFrontMatter,
  stringifyFrontMatter,
  toTagsArray,
  UNIVERSAL_KEYS,
} from '../frontmatter';

const DATE_RE = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;

describe('splitFrontMatter', () => {
  it('解析合法 frontmatter 并切出正文', () => {
    const raw = '---\ntitle: Hi\ntags: [a, b]\n---\n\n# Body\n';
    const { data, body, hasFM } = splitFrontMatter(raw);
    expect(hasFM).toBe(true);
    expect(data.title).toBe('Hi');
    expect(data.tags).toEqual(['a', 'b']);
    expect(body).toBe('\n# Body\n');
  });

  it('无 frontmatter 时原样返回正文，data 为空', () => {
    const raw = '# Just body\n';
    const { data, body, hasFM } = splitFrontMatter(raw);
    expect(hasFM).toBe(false);
    expect(data).toEqual({});
    expect(body).toBe(raw);
  });

  it('非法 YAML 不吞正文（hasFM=false，body 原样）', () => {
    const raw = '---\n: : bad\n---\n# Body';
    const { body, hasFM } = splitFrontMatter(raw);
    expect(hasFM).toBe(false);
    expect(body).toBe(raw);
  });

  it('顶层是数组/标量时回退为无 frontmatter', () => {
    const raw = '---\n- a\n- b\n---\nbody';
    const { data, hasFM, body } = splitFrontMatter(raw);
    expect(hasFM).toBe(false);
    expect(data).toEqual({});
    expect(body).toBe(raw);
  });
});

describe('stringifyFrontMatter', () => {
  it('通用字段排在扩展字段之前', () => {
    const out = stringifyFrontMatter(
      { author: 'me', title: 'T', tags: ['x'] },
      '# Body',
    );
    expect(out.indexOf('title')).toBeLessThan(out.indexOf('author'));
    expect(out.indexOf('tags')).toBeLessThan(out.indexOf('author'));
    expect(out.endsWith('# Body')).toBe(true);
  });

  it('空/空串/空数组字段被剔除', () => {
    const out = stringifyFrontMatter(
      { title: '', tags: [], author: 'me' },
      'body',
    );
    expect(out).not.toContain('title');
    expect(out).not.toContain('tags');
    expect(out).toContain('author: me');
  });

  it('无任何有效字段时不写 frontmatter 块', () => {
    expect(stringifyFrontMatter({ title: '' }, '# Body')).toBe('# Body');
  });

  it('与 splitFrontMatter 往返：正文稳定', () => {
    const raw = '---\ntitle: Hi\n---\n\n# Body\n';
    const { data, body } = splitFrontMatter(raw);
    const out = stringifyFrontMatter(data, body);
    const again = splitFrontMatter(out);
    expect(again.data.title).toBe('Hi');
    expect(again.body.trimStart()).toBe('# Body\n');
  });
});

describe('toTagsArray', () => {
  it('数组原样规整', () => {
    expect(toTagsArray(['a', ' b '])).toEqual(['a', 'b']);
  });
  it('逗号 / 空白分隔字符串', () => {
    expect(toTagsArray('a, b  c，d')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('其它类型返回空数组', () => {
    expect(toTagsArray(42)).toEqual([]);
    expect(toTagsArray(null)).toEqual([]);
  });
});

describe('UNIVERSAL_KEYS', () => {
  it('包含三个通用键（updated 已于 2026-06 移除）', () => {
    expect([...UNIVERSAL_KEYS].sort()).toEqual(['created', 'tags', 'title']);
  });
});

describe('ensureFrontmatterTimestamps', () => {
  it('无 frontmatter 的纯文本：注入 created/updated 块，正文跟随', () => {
    const raw = '# Just a note\n\nbody';
    const out = ensureFrontmatterTimestamps(raw);
    const { data, body, hasFM } = splitFrontMatter(out);
    expect(hasFM).toBe(true);
    expect(data.created).toBeDefined();
    expect(data.updated).toBeUndefined();
    expect(body.trimStart()).toBe('# Just a note\n\nbody');
  });

  it('替换已有 updated 字段的值，保留其余 frontmatter 与正文', () => {
    const raw = '---\ntitle: Hi\ncreated: 2026-01-01 08:00:00\nupdated: 2026-01-01 08:00:00\n---\n\n# Body\n';
    const out = ensureFrontmatterTimestamps(raw);
    expect(out).toContain('title: Hi');
    // created 保留原值，不被改成 updated 的新值。
    expect(out).toContain('created: 2026-01-01 08:00:00');
    expect(out).toMatch(/updated: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    // 仅一个 updated / created 字段，且正文不动。
    expect(out.match(/updated:/g)).toHaveLength(1);
    expect(out.match(/created:/g)).toHaveLength(1);
    expect(out.endsWith('# Body\n')).toBe(true);
  });

  it('有 frontmatter 但缺 created/updated 时补齐', () => {
    const raw = '---\ntitle: X\n---\nbody';
    const out = ensureFrontmatterTimestamps(raw);
    const { data, body } = splitFrontMatter(out);
    expect(data.created).toBeDefined();
    expect(data.updated).toBeUndefined();
    expect(data.title).toBe('X');
    expect(body).toBe('body');
    expect(DATE_RE.test(out)).toBe(true);
  });

  it('保留既有 created、不再注入 updated（2026-06 起）', () => {
    const raw = '---\ncreated: 2026-01-01 08:00:00\ntitle: X\n---\nbody';
    const out = ensureFrontmatterTimestamps(raw);
    expect(out).toContain('created: 2026-01-01 08:00:00');
    expect(out).not.toContain('updated:');
  });

  it('重复调用不累积字段、不破坏正文（注入后第二次只滚 updated）', () => {
    const once = ensureFrontmatterTimestamps('plain body\n');
    const twice = ensureFrontmatterTimestamps(once);
    expect(twice.match(/updated:/g)).toBeNull();
    expect(twice.match(/created:/g)).toHaveLength(1);
    const { hasFM, body } = splitFrontMatter(twice);
    expect(hasFM).toBe(true);
    expect(body.trim()).toBe('plain body');
  });
});
