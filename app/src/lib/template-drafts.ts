import type { FieldType } from '../../core/contracts';

export interface TemplateFieldDraft {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  optionsText: string;
}

export function createBlankTemplateFieldDraft(): TemplateFieldDraft {
  return {
    key: '',
    label: '',
    type: 'text',
    required: false,
    optionsText: '',
  };
}
