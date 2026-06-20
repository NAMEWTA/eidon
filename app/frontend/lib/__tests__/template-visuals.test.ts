import { describe, expect, it } from 'vitest';

import { deriveTemplateVisual, templateDisplayName } from '../template-visuals';

describe('template visuals', () => {
  it('derives a stable glyph and color from template identity', () => {
    const first = deriveTemplateVisual({ templateId: 'tpl-1', name: '资料库' });
    const second = deriveTemplateVisual({ templateId: 'tpl-1', name: '资料库' });

    expect(first).toEqual(second);
    expect(first.glyph).toBe('资');
    expect(first.color).toMatch(/^oklch\(/);
  });

  it('falls back to template id when display names are missing', () => {
    expect(deriveTemplateVisual({ templateId: 'abc' }).glyph).toBe('a');
  });

  it('joins level names for compact display', () => {
    expect(templateDisplayName({ l1Name: '档案库', l2Name: '案卷', l3Name: '文件' })).toBe('档案库 / 案卷 / 文件');
  });

  it('uses the custom template name before level names', () => {
    expect(templateDisplayName({
      templateName: '档案',
      l1Name: '档案库',
      l2Name: '案卷',
      l3Name: '文件',
    })).toBe('档案');
  });
});
