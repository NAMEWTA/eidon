import { useEffect, useMemo, useState } from 'react';

import type { FieldDef, FieldValue, TemplateLayer } from '@shared/contracts';
import type { ScannedNode } from '@shared/models';
import type { Template } from '@shared/models';
import { useNodesStore } from '../../stores/nodes';
import { useTemplatesStore } from '../../stores/templates';
import { useToastsStore } from '../../stores/toasts';
import { useI18n } from '../../i18n';
import { Icon } from '../shared/Icons';

interface NodeInspectorProps {
  open: boolean;
  node: ScannedNode | null;
  onClose: () => void;
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

export function NodeInspector({ open, node, onClose, onChanged }: NodeInspectorProps) {
  const { t } = useI18n();
  const [template, setTemplate] = useState<Template | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const layer: TemplateLayer | null = useMemo(() => {
    if (!node || !template) return null;
    return template.layers[node.node.level] ?? null;
  }, [node, template]);

  useEffect(() => {
    if (!open || !node) return;
    void useTemplatesStore.getState()
      .get(node.node.templateId, node.node.schemaVersion)
      .then(setTemplate)
      .catch(() => setTemplate(null));
  }, [node, open]);

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

  if (!open || !node) return null;

  return (
    <div className="node-dialog__backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="node-dialog" role="dialog" aria-label={t('node.inspector')}>
        <header className="node-dialog__header">
          <h3>L{node.node.level} · {node.node.type}</h3>
          <button type="button" onClick={onClose} title={t('node.close')}><Icon name="close" size={16} /></button>
        </header>

        <div className="node-dialog__body">
          <div className="node-dialog__meta">
            <span>ID {node.node.id}</span>
            <span>{node.path}</span>
            <span>schema v{node.node.schemaVersion}</span>
          </div>

          {!layer && (
            <div className="node-dialog__orphan">
              <p>{t('node.templateIsMissing')}</p>
              <pre>{JSON.stringify(node.node.fields, null, 2)}</pre>
            </div>
          )}

          {layer && (
            <div className="node-dialog__fields">
              {layer.fields.map((field) => (
                <label key={field.key} className="node-dialog__field">
                  <span>{field.label}</span>
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
                      <option value=""></option>
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
            </div>
          )}
        </div>

        <footer className="node-dialog__footer">
          <button type="button" onClick={onClose}>{t('node.close')}</button>
          {layer && (
            <button type="button" className="primary-btn" disabled={saving} onClick={() => void save()}>
              {t('node.saveFields')}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

export default NodeInspector;
