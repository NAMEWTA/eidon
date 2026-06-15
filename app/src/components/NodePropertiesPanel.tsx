import { useEffect, useMemo, useState } from 'react';

import type { FieldDef, FieldValue, TemplateLayer } from '../../core/contracts';
import type { ScannedNode } from '../../core/nodes';
import type { Template } from '../../core/templates';
import { useNodesStore } from '../stores/nodes';
import { useTemplatesStore } from '../stores/templates';
import { useToastsStore } from '../stores/toasts';
import { deriveTemplateVisual, templateDisplayName } from '../lib/template-visuals';
import { useI18n } from '../i18n';
import { Icon } from './Icons';

interface NodePropertiesPanelProps {
  node: ScannedNode | null;
  onClose?: () => void;
  onChanged: () => void;
}

const displayFieldValue = (value: FieldValue): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const coerceValue = (field: FieldDef, raw: string | boolean): FieldValue => {
  if (field.type === 'boolean') return Boolean(raw);
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  if (field.type === 'number') return Number(raw);
  return raw;
};

const fieldTypeIcon = (type: FieldDef['type']): string => ({
  text: 'T',
  textarea: 'P',
  number: '#',
  date: 'D',
  select: 'S',
  boolean: 'B',
}[type] ?? 'F');

export function NodePropertiesPanel({ node, onClose, onChanged }: NodePropertiesPanelProps) {
  const { t } = useI18n();
  const [template, setTemplate] = useState<Template | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);

  const layer: TemplateLayer | null = useMemo(() => {
    if (!node || !template) return null;
    return template.layers[node.node.level] ?? null;
  }, [node, template]);

  const templateName = template
    ? templateDisplayName({
        templateName: template.templateName,
        l1Name: template.layers[1].name,
        l2Name: template.layers[2].name,
        l3Name: template.layers[3].name,
      })
    : node?.node.templateId ?? '';
  const templateVisual = node
    ? deriveTemplateVisual({ templateId: node.node.templateId, name: templateName || node.node.type })
    : null;

  useEffect(() => {
    if (!node) {
      setTemplate(null);
      setValues({});
      return;
    }
    void useTemplatesStore.getState()
      .get(node.node.templateId, node.node.schemaVersion)
      .then(setTemplate)
      .catch(() => setTemplate(null));
  }, [node]);

  useEffect(() => {
    if (!node || !layer) {
      setValues({});
      return;
    }
    const next: Record<string, string | boolean> = {};
    for (const field of layer.fields) {
      const value = node.node.fields[field.key] ?? null;
      next[field.key] = field.type === 'boolean' ? Boolean(value) : displayFieldValue(value);
    }
    setValues(next);
  }, [layer, node]);

  function updateField(field: FieldDef, value: string | boolean) {
    setValues((cur) => ({ ...cur, [field.key]: value }));
  }

  async function save() {
    if (!node || !layer) return;
    const fields: Record<string, unknown> = {};
    for (const field of layer.fields) {
      fields[field.key] = coerceValue(field, values[field.key] ?? (field.type === 'boolean' ? false : ''));
    }
    setSaving(true);
    try {
      await useNodesStore.getState().updateFields({
        path: node.path,
        templateLayer: layer,
        fields,
      });
      useToastsStore.getState().success(t('node.fieldsSaved'));
      onChanged();
    } catch (error) {
      useToastsStore.getState().error(String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="node-props">
      <header className="node-props__head">
        <span className="node-props__title">{t('node.properties')}</span>
        {onClose && <button className="rs-pane-close" type="button" title={t('node.close')} onClick={onClose}>
          <Icon name="close" size={16} />
        </button>}
      </header>

      {!node ? (
        <div className="node-props__empty">{t('node.selectNode')}</div>
      ) : (
        <div className="node-props__body">
          <section className="node-props__identity">
            <span className="node-props__glyph" style={{ background: templateVisual?.color }}>
              {templateVisual?.glyph}
            </span>
            <span className="node-props__identity-text">
              <strong>{node.path.split('/').pop() ?? node.path}</strong>
              <small>{node.node.type} · {templateName || t('node.templateNameMissing')}</small>
            </span>
          </section>

          <section className="node-props__schema">
            <span>L{node.node.level}</span>
            <span>schema v{node.node.schemaVersion}</span>
          </section>

          {!layer && (
            <section className="node-props__orphan">
              <p>{t('node.templateIsMissing')}</p>
              <pre>{JSON.stringify(node.node.fields, null, 2)}</pre>
            </section>
          )}

          {layer && layer.fields.length === 0 && (
            <div className="node-props__empty">{t('node.noCustomFields')}</div>
          )}

          {layer && layer.fields.length > 0 && (
            <section className="node-props__fields">
              {layer.fields.map((field) => (
                <label key={field.key} className="node-props__field">
                  <span className="node-props__field-label">
                    <span className="node-props__field-type">{fieldTypeIcon(field.type)}</span>
                    {field.label}
                    {field.required && <em>*</em>}
                  </span>
                  {field.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(values[field.key])}
                      onChange={(event) => updateField(field, event.target.checked)}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={String(values[field.key] ?? '')}
                      onChange={(event) => updateField(field, event.target.value)}
                    >
                      <option value="">{t('node.unset')}</option>
                      {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={String(values[field.key] ?? '')}
                      onChange={(event) => updateField(field, event.target.value)}
                    />
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={String(values[field.key] ?? '')}
                      onChange={(event) => updateField(field, event.target.value)}
                    />
                  )}
                </label>
              ))}
              <button type="button" className="node-props__save" disabled={saving} onClick={() => void save()}>
                {saving ? t('node.saving') : t('node.saveFields')}
              </button>
            </section>
          )}

          <section className="node-props__meta">
            <h4>{t('node.nodeMetadata')}</h4>
            <dl>
              <dt>{t('node.id')}</dt><dd>{node.node.id}</dd>
              <dt>{t('node.template')}</dt><dd>{templateName || node.node.templateId}</dd>
              <dt>{t('node.path')}</dt><dd>{node.path}</dd>
              <dt>{t('node.created')}</dt><dd>{node.node.createdAt}</dd>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}

export default NodePropertiesPanel;
