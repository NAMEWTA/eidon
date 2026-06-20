import { useEffect, useMemo, useState } from 'react';

import type { FieldType, Level } from '@shared/contracts';
import type { Template, TemplateInput } from '@shared/models';
import { useNodesStore } from '../../stores/nodes';
import { useTemplatesStore } from '../../stores/templates';
import { useWorkspaceStore } from '../../stores/workspace';
import { useToastsStore } from '../../stores/toasts';
import { createBlankTemplateFieldDraft, type TemplateFieldDraft } from '../../lib/template-drafts';
import { deriveTemplateVisual, templateDisplayName } from '../../lib/template-visuals';
import { useI18n } from '../../i18n';
import { Icon } from '../shared/Icons';

const LEVELS: Level[] = [1, 2, 3];
const FIELD_TYPES: FieldType[] = ['text', 'textarea', 'number', 'date', 'select', 'boolean'];
const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: '文本',
  textarea: '多行文本',
  number: '数字',
  date: '日期',
  select: '单选',
  boolean: '布尔',
};

type FieldDraft = TemplateFieldDraft;

type TemplateDraft = { templateName: string } & Record<Level, { name: string; fields: FieldDraft[] }>;

const emptyDraft = (): TemplateDraft => ({
  templateName: '',
  1: { name: 'L1', fields: [] },
  2: { name: 'L2', fields: [] },
  3: { name: 'L3', fields: [] },
});

const draftFromTemplate = (template: Template): TemplateDraft => ({
  templateName: template.templateName,
  1: {
    name: template.layers[1].name,
    fields: template.layers[1].fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      optionsText: field.options?.join('\n') ?? '',
    })),
  },
  2: {
    name: template.layers[2].name,
    fields: template.layers[2].fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      optionsText: field.options?.join('\n') ?? '',
    })),
  },
  3: {
    name: template.layers[3].name,
    fields: template.layers[3].fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      optionsText: field.options?.join('\n') ?? '',
    })),
  },
});

const inputFromDraft = (draft: TemplateDraft): TemplateInput => ({
  templateName: draft.templateName.trim(),
  layers: {
    1: {
      name: draft[1].name.trim(),
      fields: draft[1].fields.map((field) => ({
        key: field.key.trim(),
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        options: field.type === 'select'
          ? field.optionsText.split(/[\n,]/).map((option) => option.trim()).filter(Boolean)
          : undefined,
      })),
    },
    2: {
      name: draft[2].name.trim(),
      fields: draft[2].fields.map((field) => ({
        key: field.key.trim(),
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        options: field.type === 'select'
          ? field.optionsText.split(/[\n,]/).map((option) => option.trim()).filter(Boolean)
          : undefined,
      })),
    },
    3: {
      name: draft[3].name.trim(),
      fields: draft[3].fields.map((field) => ({
        key: field.key.trim(),
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        options: field.type === 'select'
          ? field.optionsText.split(/[\n,]/).map((option) => option.trim()).filter(Boolean)
          : undefined,
      })),
    },
  },
});

function TypeBadge({ type }: { type: FieldType }) {
  return <span className={`template-manager__type template-manager__type--${type}`}>{FIELD_TYPE_LABELS[type]}</span>;
}

function templateName(template: Template): string {
  return templateDisplayName({
    templateName: template.templateName,
    l1Name: template.layers[1].name,
    l2Name: template.layers[2].name,
    l3Name: template.layers[3].name,
  });
}

function totalFields(template: Template): number {
  return LEVELS.reduce((sum, level) => sum + template.layers[level].fields.length, 0);
}

export function TemplateManager() {
  const { t } = useI18n();
  const currentFolder = useWorkspaceStore((state) => state.currentFolder);
  const templates = useTemplatesStore((state) => state.templates);
  const invalidTemplates = useTemplatesStore((state) => state.invalidTemplates);
  const loading = useTemplatesStore((state) => state.loading);
  const scannedNodes = useNodesStore((state) => state.nodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [draft, setDraft] = useState<TemplateDraft>(() => emptyDraft());
  const [versions, setVersions] = useState<number[]>([]);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const selected = useMemo(
    () => (mode === 'existing' ? templates.find((template) => template.templateId === selectedId) ?? null : null),
    [mode, selectedId, templates],
  );
  const selectedUsedNodes = useMemo(
    () => selected
      ? scannedNodes
        .filter((node) => node.node.templateId === selected.templateId)
        .sort((a, b) => a.node.level - b.node.level || a.path.localeCompare(b.path))
      : [],
    [scannedNodes, selected],
  );

  useEffect(() => {
    if (!currentFolder) return;
    void useTemplatesStore.getState().init(currentFolder).catch((error) => {
      useToastsStore.getState().error(String(error));
    });
    void useNodesStore.getState().scan(currentFolder).catch(() => undefined);
  }, [currentFolder]);

  const usedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of scannedNodes) {
      counts.set(node.node.templateId, (counts.get(node.node.templateId) ?? 0) + 1);
    }
    return counts;
  }, [scannedNodes]);

  useEffect(() => {
    if (mode === 'existing' && !selectedId && templates[0]) {
      setSelectedId(templates[0].templateId);
      return;
    }
    if (mode === 'new') return;
    if (!selected) {
      setSelectedId(null);
      setDraft(emptyDraft());
      setVersions([]);
      return;
    }
    if (selectedId !== selected.templateId) setSelectedId(selected.templateId);
    setDraft(draftFromTemplate(selected));
    void useTemplatesStore.getState().versions(selected.templateId).then(setVersions).catch(() => setVersions([selected.version]));
  }, [mode, selected, selectedId, templates]);

  function patchLayer(level: Level, patch: Partial<TemplateDraft[Level]>) {
    setDraft((cur) => ({ ...cur, [level]: { ...cur[level], ...patch } }));
  }

  function patchField(level: Level, index: number, patch: Partial<FieldDraft>) {
    setDraft((cur) => ({
      ...cur,
      [level]: {
        ...cur[level],
        fields: cur[level].fields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
      },
    }));
  }

  function addField(level: Level) {
    patchLayer(level, {
      fields: [
        ...draft[level].fields,
        createBlankTemplateFieldDraft(),
      ],
    });
  }

  function removeField(level: Level, index: number) {
    patchLayer(level, { fields: draft[level].fields.filter((_, i) => i !== index) });
  }

  function validateDraft(): string | null {
    const problems: string[] = [];
    if (!draft.templateName.trim()) problems.push(t('templates.nameRequired'));
    for (const level of LEVELS) {
      if (!draft[level].name.trim()) problems.push(`L${level} name is required`);
      const keys = new Set<string>();
      draft[level].fields.forEach((field, index) => {
        const label = `L${level} field ${index + 1}`;
        const key = field.key.trim();
        if (!key) problems.push(`${label}: key is required`);
        if (!field.label.trim()) problems.push(`${label}: label is required`);
        if (key && keys.has(key)) problems.push(`${label}: duplicate key "${key}"`);
        if (key) keys.add(key);
        if (
          field.type === 'select' &&
          field.optionsText.split(/[\n,]/).map((option) => option.trim()).filter(Boolean).length === 0
        ) {
          problems.push(`${label}: select fields require at least one option`);
        }
      });
    }
    return problems.length > 0 ? problems.slice(0, 4).join('\n') : null;
  }

  async function createNew() {
    const problem = validateDraft();
    if (problem) {
      setValidationMessage(problem);
      useToastsStore.getState().error(problem);
      return;
    }
    setValidationMessage(null);
    try {
      const created = await useTemplatesStore.getState().create(inputFromDraft(draft));
      setSelectedId(created.templateId);
      setMode('existing');
      useToastsStore.getState().success(t('templates.created'));
    } catch (error) {
      useToastsStore.getState().error(String(error));
    }
  }

  async function saveVersion() {
    if (mode === 'new' || !selected) return createNew();
    const problem = validateDraft();
    if (problem) {
      setValidationMessage(problem);
      useToastsStore.getState().error(problem);
      return;
    }
    setValidationMessage(null);
    try {
      const updated = await useTemplatesStore.getState().edit(selected.templateId, inputFromDraft(draft));
      setSelectedId(updated.templateId);
      useToastsStore.getState().success(t('templates.saved', { version: updated.version }));
    } catch (error) {
      useToastsStore.getState().error(String(error));
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    const ok = window.confirm(t('templates.confirmDelete', { name: templateName(selected) }));
    if (!ok) return;
    try {
      await useTemplatesStore.getState().delete(selected.templateId);
      setSelectedId(null);
      setMode('existing');
      useToastsStore.getState().success(t('templates.deleted'));
    } catch (error) {
      useToastsStore.getState().error(String(error));
    }
  }

  async function deleteInvalid(templateId: string) {
    const ok = window.confirm(t('templates.confirmDeleteInvalid', { id: templateId }));
    if (!ok) return;
    try {
      await useTemplatesStore.getState().delete(templateId);
      useToastsStore.getState().success(t('templates.invalidDeleted'));
    } catch (error) {
      useToastsStore.getState().error(String(error));
    }
  }

  function selectNode(nodeId: string) {
    window.dispatchEvent(new CustomEvent('eidon:select-structure-node', { detail: { nodeId } }));
  }

  async function upgradeNode(node: typeof selectedUsedNodes[number]) {
    if (!selected) return;
    const layer = selected.layers[node.node.level];
    try {
      await useNodesStore.getState().upgradeSchema({ path: node.path, templateLayer: layer });
      useToastsStore.getState().success(t('templates.schemaUpgraded', { version: layer.schemaVersion }));
    } catch (error) {
      useToastsStore.getState().error(String(error));
    }
  }

  const activeName = selected ? templateName(selected) : (draft.templateName.trim() || '新模板');
  const activeVisual = deriveTemplateVisual({
    templateId: selected?.templateId ?? 'new-template',
    name: activeName,
  });
  const activeUsedCount = selected ? usedCounts.get(selected.templateId) ?? 0 : 0;

  if (!currentFolder) {
    return (
      <section className="template-manager">
        <h3 className="template-manager__heading">{t('templates.heading')}</h3>
        <p className="setting-hint">{t('templates.noWorkspace')}</p>
      </section>
    );
  }

  return (
    <section className="template-manager">
      <div className="template-manager__top">
        <div>
          <h3 className="template-manager__heading">{t('templates.heading')}</h3>
          <p className="setting-hint">
            {t('templates.description')}
          </p>
        </div>
        <div className="template-manager__actions">
          <button type="button" onClick={() => { setMode('new'); setSelectedId(null); setVersions([]); setDraft(emptyDraft()); }}>
            <Icon name="new" size={14} /> {t('templates.newTemplate')}
          </button>
          <button type="button" onClick={() => void saveVersion()} disabled={loading}>
            <Icon name="save" size={14} /> {mode === 'new' ? t('templates.createTemplate') : t('templates.saveNewVersion')}
          </button>
        </div>
      </div>

      <div className="template-manager__typebar" aria-label="field types">
        <span>{t('templates.fieldTypes')}</span>
        {FIELD_TYPES.map((type) => <TypeBadge key={type} type={type} />)}
      </div>

      <div className="template-manager__layout">
        <div className="template-manager__list">
          {templates.map((template) => {
            const name = templateName(template);
            const visual = deriveTemplateVisual({ templateId: template.templateId, name });
            const usedCount = usedCounts.get(template.templateId) ?? 0;
            const active = template.templateId === selected?.templateId;
            return (
              <button
                key={template.templateId}
                type="button"
                className={`template-manager__card${active ? ' template-manager__card--active' : ''}`}
                onClick={() => { setMode('existing'); setSelectedId(template.templateId); }}
              >
                <span className="template-manager__card-strip" style={{ background: visual.color }} />
                <span className="template-manager__card-head">
                  <span className="template-manager__glyph" style={{ background: visual.color }}>{visual.glyph}</span>
                  <span className="template-manager__card-title">
                    <strong>{name}</strong>
                    <small>v{template.version} · {usedCount > 0 ? t('templates.usedCount', { count: usedCount }) : t('templates.unused')}</small>
                  </span>
                </span>
                <span className="template-manager__levels">
                  {LEVELS.map((level) => (
                    <span key={level}>
                      <b>L{level}</b>
                      <em>{template.layers[level].name}</em>
                      <small>{t('templates.fieldsCount', { count: template.layers[level].fields.length })}</small>
                    </span>
                  ))}
                </span>
                <span className="template-manager__card-foot">{t('templates.totalFields', { count: totalFields(template) })} · ID {template.templateId}</span>
              </button>
            );
          })}
          {templates.length === 0 && <p className="setting-hint">{t('templates.noTemplates')}</p>}
          {invalidTemplates.map((template) => (
            <div key={template.templateId} className="template-manager__invalid">
              <span>{t('templates.invalidTemplate')}</span>
              <small>{template.templateId} · {template.reason}</small>
              <button type="button" className="template-manager__danger" onClick={() => void deleteInvalid(template.templateId)}>
                <Icon name="trash" size={13} /> {t('templates.delete')}
              </button>
            </div>
          ))}
        </div>

        <div className="template-manager__editor">
          <div className="template-manager__editor-head">
            <span className="template-manager__glyph template-manager__glyph--large" style={{ background: activeVisual.color }}>
              {activeVisual.glyph}
            </span>
            <div>
              <h4>{mode === 'new' ? t('templates.newTemplate') : activeName}</h4>
              <p>
                {selected ? t('templates.idLabel', { id: selected.templateId }) + ' · ' + t('templates.currentVersion', { version: selected.version }) : t('templates.newTemplateHint')}
                {versions.length > 0 ? ` · ${t('templates.versions', { versions: versions.join(', ') })}` : ''}
              </p>
            </div>
            {selected && (
              <button type="button" className="template-manager__danger" onClick={() => void deleteSelected()}>
                <Icon name="trash" size={13} /> {t('templates.deleteTemplate')}
              </button>
            )}
          </div>

          {selected && activeUsedCount > 0 && (
            <div className="template-manager__notice">
              {t('templates.usedByNodes', { count: activeUsedCount, version: selected.version + 1 })}
            </div>
          )}

          {selected && (
            <section className="template-manager__used">
              <div className="template-manager__used-head">
                <span>{t('templates.nodesUsing')}</span>
                <small>{selectedUsedNodes.length > 0 ? t('templates.nodesUsingCount', { count: selectedUsedNodes.length }) : t('templates.noNodes')}</small>
              </div>
              {selectedUsedNodes.length > 0 ? (
                <div className="template-manager__used-list">
                  {selectedUsedNodes.map((node) => {
                    const latestLayer = selected.layers[node.node.level];
                    const canUpgrade = node.node.schemaVersion < latestLayer.schemaVersion;
                    return (
                      <button
                        key={node.node.id}
                        type="button"
                        className="template-manager__used-row"
                        onClick={() => selectNode(node.node.id)}
                        title={node.path}
                      >
                        <span className="template-manager__used-path">
                          <b>L{node.node.level}</b>
                          <span>{node.path}</span>
                        </span>
                        <span className={canUpgrade ? 'template-manager__used-version template-manager__used-version--stale' : 'template-manager__used-version'}>
                          schema v{node.node.schemaVersion}
                          {canUpgrade ? ` → v${latestLayer.schemaVersion}` : ''}
                        </span>
                        <span
                          role="button"
                          aria-disabled={!canUpgrade}
                          className={canUpgrade ? 'template-manager__upgrade' : 'template-manager__upgrade template-manager__upgrade--disabled'}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (canUpgrade) void upgradeNode(node);
                          }}
                        >
                          {canUpgrade ? t('templates.upgradeSchema') : t('templates.upToDate')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="template-manager__used-empty">{t('templates.noNodesYet')}</div>
              )}
            </section>
          )}

          {validationMessage && (
            <pre className="template-manager__error">{validationMessage}</pre>
          )}

          <label className="template-manager__name-row">
            <span>{t('templates.templateName')}</span>
            <input
              value={draft.templateName}
              onChange={(event) => setDraft((cur) => ({ ...cur, templateName: event.target.value }))}
              placeholder={t('templates.templateNamePlaceholder')}
              autoComplete="off"
            />
          </label>

          {LEVELS.map((level) => (
            <div key={level} className="template-manager__level">
              <div className="template-manager__level-head">
                <span className="template-manager__level-badge" style={{ background: activeVisual.color }}>L{level}</span>
                <label>
                  <span>{t('templates.layerName', { level })}</span>
                  <input
                    value={draft[level].name}
                    onChange={(event) => patchLayer(level, { name: event.target.value })}
                    autoComplete="off"
                  />
                </label>
              </div>
              <div className="template-manager__fields">
                {draft[level].fields.map((field, index) => (
                  <div key={`${level}-${index}`} className="template-manager__field">
                    <span className="template-manager__drag" aria-hidden="true">::</span>
                    <input
                      value={field.key}
                      onChange={(event) => patchField(level, index, { key: event.target.value })}
                      placeholder={t('templates.fieldKey')}
                      autoComplete="off"
                    />
                    <input
                      value={field.label}
                      onChange={(event) => patchField(level, index, { label: event.target.value })}
                      placeholder={t('templates.fieldLabel')}
                      autoComplete="off"
                    />
                    <select
                      value={field.type}
                      onChange={(event) => patchField(level, index, { type: event.target.value as FieldType })}
                    >
                      {FIELD_TYPES.map((type) => <option key={type} value={type}>{FIELD_TYPE_LABELS[type]}</option>)}
                    </select>
                    {field.type === 'select' && (
                      <textarea
                        value={field.optionsText}
                        onChange={(event) => patchField(level, index, { optionsText: event.target.value })}
                        placeholder={'选项 A\n选项 B\n选项 C'}
                        rows={3}
                      />
                    )}
                    {field.type !== 'select' && <span className="template-manager__options-spacer" />}
                    <label className="template-manager__check">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) => patchField(level, index, { required: event.target.checked })}
                      />
                      {t('templates.required')}
                    </label>
                    <button type="button" title={t('templates.removeField')} onClick={() => removeField(level, index)}>
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                ))}
                {draft[level].fields.length === 0 && (
                  <div className="template-manager__empty-fields">{t('templates.noFields')}</div>
                )}
              </div>
              <button type="button" className="template-manager__add" onClick={() => addField(level)}>
                <Icon name="insert" size={13} /> {t('templates.addField')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TemplateManager;
