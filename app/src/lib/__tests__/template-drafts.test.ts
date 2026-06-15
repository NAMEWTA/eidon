import { describe, expect, it } from 'vitest';

import { createBlankTemplateFieldDraft } from '../template-drafts';

describe('template draft helpers', () => {
  it('creates a blank field row without generated key or label text', () => {
    expect(createBlankTemplateFieldDraft()).toEqual({
      key: '',
      label: '',
      type: 'text',
      required: false,
      optionsText: '',
    });
  });
});
