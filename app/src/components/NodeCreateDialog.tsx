import { useEffect, useMemo, useState } from 'react';

import type { FieldDef, FieldValue, Level, TemplateLayer } from '../../core/contracts';
import type { Template } from '../../core/templates';
import { useNodesStore } from '../stores/nodes';
import { useTemplatesStore } from '../stores/templates';
import { useToastsStore } from '../stores/toasts';
import { useWorkspaceStore } from '../stores/workspace';
import { templateDisplayName } from '../lib/template-visuals';
import { useI18n } from '../i18n';
import { Icon } from './Icons';

type DialogMode = 'create' | 'promote';

interface NodeCreateDialogProps {
  open: boolean;
  mode: DialogMode;
  path: string;
  onClose: () => void;
  onChanged: () => void;
}

const depthOf = (relPath: string): number =>
  relPath.split('/').filter(Boolean).length;

const parentOf = (relPath: string): string => {
  const parts = relPath.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
};

const labelForMode = (mode: DialogMode, t: (k: string) => string): string =>
  mode === 'create' ? t('node.createNode') : t('node.promoteToNode');

const coerceFieldValue = (field: FieldDef, raw: string | boolean): FieldValue => {
  if (field.type === 'boolean') return Boolean(raw);
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  if (field.type === 'number') return Number(raw);
  return raw;
};

const displayTemplateName = (template: Template): string =>
  templateDisplayName({
    templateName: template.templateName,
    l1Name: template.layers[1].name,
    l2Name: template.layers[2].name,
    l3Name: template.layers[3].name,
  });

export function NodeCreateDialog({ open, mode, path, onClose, onChanged }: NodeCreateDialogProps) {
  const { t } = useI18n();
  const currentFolder = useWorkspaceStore((state) => state.currentFolder);
  const templates = useTemplatesStore((state) => state.templates);
  const scannedNodes = useNodesStore((state) => state.nodes);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [template, setTemplate] = useState<Template | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const relPath = useMemo(() => {
    if (!currentFolder) return '';
    return useNodesStore.getState().relPath(path, currentFolder);
  }, [currentFolder, path]);

  const parentRelPath = mode === 'create' ? relPath : parentOf(relPath);
  const targetLevel = (mode === 'create' ? depthOf(parentRelPath) + 1 : depthOf(relPath)) as Level;
  const selectedLayer = template?.layers[targetLevel] ?? null;

  useEffect(() => {
    if (!open || !currentFolder) return;
    void useTemplatesStore.getState().init(currentFolder).catch((error) => {
      useToastsStore.getState().error(String(error));
    });
    void useNodesStore.getState().scan(currentFolder).catch(() => undefined);
  }, [currentFolder, open]);

  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setNodeName('');
    setFieldValues({});
  }, [open, mode, path]);

  useEffect(() => {
    if (!open) return;
    if (targetLevel === 1) {
      const chosen = templates.find((item) => item.templateId === selectedTemplateId) ?? templates[0] ?? null;
      setSelectedTemplateId(chosen?.templateId ?? '');
      setTemplate(chosen);
      return;
    }

    const parentNode = useNodesStore.getState().nodeAtPath(parentRelPath);
    if (!parentNode) {
      setTemplate(null);
      return;
    }
    void useTemplatesStore.getState()
      .get(parentNode.node.templateId, parentNode.node.schemaVersion)
      .then(setTemplate)
      .catch(() => setTemplate(null));
  }, [open, parentRelPath, scannedNodes, selectedTemplateId, targetLevel, templates]);

  useEffect(() => {
    if (!selectedLayer) return;
    const defaults: Record<string, string | boolean> = {};
    for (const field of selectedLayer.fields) {
      defaults[field.key] = field.type === 'boolean' ? false : '';
    }
    setFieldValues(defaults);
  }, [selectedLayer]);

  function updateField(field: FieldDef, value: string | boolean) {
    setFieldValues((cur) => ({ ...cur, [field.key]: value }));
  }

  function buildFields(layer: TemplateLayer): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    for (const field of layer.fields) {
      fields[field.key] = coerceFieldValue(field, fieldValues[field.key] ?? (field.type === 'boolean' ? false : ''));
    }
    return fields;
  }

  async function submit() {
    if (!selectedLayer) return;
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await useNodesStore.getState().create({
          parentPath: parentRelPath,
          name: nodeName,
          templateLayer: selectedLayer,
          fields: buildFields(selectedLayer),
        });
      } else {
        await useNodesStore.getState().promote({
          path: relPath,
          templateLayer: selectedLayer,
          fields: buildFields(selectedLayer),
        });
      }
      useToastsStore.getState().success(mode === 'create' ? t('node.nodeCreated') : t('node.folderPromoted'));
      onChanged();
      onClose();
    } catch (error) {
      useToastsStore.getState().error(String(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const canSubmit = !!selectedLayer && (mode === 'promote' || nodeName.trim().length > 0);

  return (
    <div className="node-dialog__backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="node-dialog" role="dialog" aria-label={labelForMode(mode, t)}>
        <header className="node-dialog__header">
          <h3>{labelForMode(mode, t)} · L{targetLevel}</h3>
          <button type="button" onClick={onClose} title={t('node.close')}><Icon name="close" size={16} /></button>
        </header>

        <div className="node-dialog__body">
          {targetLevel === 1 && (
            <label>
              Template
              <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                {templates.map((item) => (
                  <option key={item.templateId} value={item.templateId}>
                    {displayTemplateName(item)} v{item.version}
                  </option>
                ))}
              </select>
            </label>
          )}

          {targetLevel > 1 && (
            <div className="node-dialog__inherited">
              {template ? `${displayTemplateName(template)} v${template.version}` : t('node.templateMissing')}
            </div>
          )}

          {mode === 'create' && (
            <label>
              Name
              <input value={nodeName} onChange={(event) => setNodeName(event.target.value)} autoFocus />
            </label>
          )}

          {selectedLayer && (
            <div className="node-dialog__fields">
              {selectedLayer.fields.map((field) => (
                <label key={field.key} className="node-dialog__field">
                  <span>{field.label}</span>
                  {field.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(fieldValues[field.key])}
                      onChange={(event) => updateField(field, event.target.checked)}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={String(fieldValues[field.key] ?? '')}
                      onChange={(event) => updateField(field, event.target.value)}
                    >
                      <option value=""></option>
                      {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={String(fieldValues[field.key] ?? '')}
                      onChange={(event) => updateField(field, event.target.value)}
                    />
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={String(fieldValues[field.key] ?? '')}
                      onChange={(event) => updateField(field, event.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <footer className="node-dialog__footer">
          <button type="button" onClick={onClose}>{t('node.cancel')}</button>
          <button type="button" className="primary-btn" disabled={!canSubmit || submitting} onClick={() => void submit()}>
            {labelForMode(mode, t)}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default NodeCreateDialog;
