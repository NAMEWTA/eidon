/* ============================================================
   EIDON 基座 v2 — Template Editor
   TemplateManager · TemplateEditorView · FieldEditor
   ============================================================ */
const { useState: useTESt } = React;

// ─── Field Type Badge ─────────────────────────────────────
function TypeBadge({ type }) {
  const colors = {
    text: 'var(--text-3)', textarea: 'var(--text-3)',
    number: 'oklch(0.65 0.10 195)', date: 'oklch(0.65 0.10 280)',
    select: 'oklch(0.65 0.10 145)', boolean: 'oklch(0.65 0.10 55)',
  };
  const labels = {
    text: '文本', textarea: '多行文本', number: '数字',
    date: '日期', select: '单选', boolean: '布尔',
  };
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, color: colors[type] || 'var(--text-3)',
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace',
    }}>{labels[type] || type}</span>
  );
}

// ─── Single Field Row (in editor) ─────────────────────────
function FieldRow({ field, index, onRemove, onChange }) {
  const [hov, setHov] = useTESt(false);
  const [editingOptions, setEditingOptions] = useTESt(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
        background: hov ? 'var(--surface-2)' : 'transparent',
        borderRadius: 6, marginBottom: 2,
      }}>
      <span style={{ color: 'var(--text-3)', cursor: 'grab', paddingTop: 8 }}
        dangerouslySetInnerHTML={{ __html: EidonIcons.drag || '⠿' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <input
            value={field.key} onChange={e => onChange({ ...field, key: e.target.value })}
            placeholder="字段名称"
            style={{
              flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '4px 8px', color: 'var(--text-1)', fontSize: 12.5, outline: 'none',
            }} />
          <select value={field.type} onChange={e => onChange({ ...field, type: e.target.value, options: undefined })}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '4px 8px', color: 'var(--text-2)', fontSize: 12, outline: 'none', cursor: 'pointer',
            }}>
            {['text', 'textarea', 'number', 'date', 'select', 'boolean'].map(t => (
              <option key={t} value={t}>{
                { text: '文本', textarea: '多行文本', number: '数字', date: '日期', select: '单选', boolean: '布尔' }[t]
              }</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-3)', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!field.required} onChange={e => onChange({ ...field, required: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }} />
            必填
          </label>
          {hov && (
            <button onClick={onRemove} style={{
              background: 'transparent', border: 'none', color: 'var(--danger)',
              cursor: 'pointer', padding: '0 4px', fontSize: 13,
            }} title="删除字段">✕</button>
          )}
        </div>
        {/* Select options */}
        {field.type === 'select' && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 4 }}>选项（每行一个）：</div>
            <textarea
              value={(field.options || []).join('\n')}
              onChange={e => onChange({ ...field, options: e.target.value.split('\n').filter(Boolean) })}
              rows={3}
              placeholder="选项A&#10;选项B&#10;选项C"
              style={{
                width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 5, padding: '6px 8px', color: 'var(--text-1)', fontSize: 12,
                outline: 'none', resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box',
              }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single Level Editor ──────────────────────────────────
function LevelEditor({ level, levelName, levelSchema, onChangeName, onChangeFields, templateColor }) {
  const [fields, setFields] = useTESt(levelSchema?.fields || []);

  const handleFieldChange = (i, field) => {
    const next = fields.map((f, idx) => idx === i ? field : f);
    setFields(next); onChangeFields(next);
  };
  const handleRemove = (i) => {
    const next = fields.filter((_, idx) => idx !== i);
    setFields(next); onChangeFields(next);
  };
  const handleAdd = () => {
    const next = [...fields, { key: '新字段', type: 'text', required: false }];
    setFields(next); onChangeFields(next);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Level header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
        paddingBottom: 10, borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 5, background: templateColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)', flexShrink: 0,
        }}>L{level}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>第 {level} 层名称</div>
          <input value={levelName} onChange={e => onChangeName(e.target.value)}
            placeholder={`第${level}层名称`}
            style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '5px 10px', color: 'var(--text-1)',
              fontSize: 13.5, fontWeight: 600, outline: 'none', width: '100%', boxSizing: 'border-box',
            }} />
        </div>
      </div>
      {/* Fields */}
      <div style={{ marginBottom: 8 }}>
        {fields.map((field, i) => (
          <FieldRow key={i} field={field} index={i}
            onRemove={() => handleRemove(i)}
            onChange={(f) => handleFieldChange(i, f)} />
        ))}
      </div>
      <button onClick={handleAdd} style={{
        background: 'transparent', border: '1px dashed var(--border)',
        borderRadius: 5, padding: '5px 12px', fontSize: 12, color: 'var(--text-3)',
        cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      }}>
        <span dangerouslySetInnerHTML={{ __html: EidonIcons.plus }} />
        添加字段
      </button>
    </div>
  );
}

// ─── Template Detail View ─────────────────────────────────
function TemplateDetailView({ tpl, onBack, isNew }) {
  const [name, setName] = useTESt(tpl.name);
  const [glyph, setGlyph] = useTESt(tpl.glyph);
  const [color, setColor] = useTESt(tpl.color);
  const [levelNames, setLevelNames] = useTESt({
    1: tpl.versions?.[1]?.[1]?.levelName || 'L1',
    2: tpl.versions?.[1]?.[2]?.levelName || tpl.versions?.[2]?.[2]?.levelName || 'L2',
    3: tpl.versions?.[1]?.[3]?.levelName || 'L3',
  });
  const [saved, setSaved] = useTESt(false);

  const usedNodes = NODES.filter(n => n.templateId === tpl.id);
  const curV = Math.max(...Object.keys(tpl.versions || { 1: 1 }).map(Number));

  const colorOptions = [
    'oklch(0.68 0.14 35)', 'oklch(0.62 0.12 235)', 'oklch(0.58 0.04 80)',
    'oklch(0.65 0.14 145)', 'oklch(0.65 0.12 280)', 'oklch(0.65 0.12 310)',
  ];

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {/* Back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: '1px solid var(--border)', borderRadius: 5,
          color: 'var(--text-2)', padding: '4px 10px', fontSize: 12, cursor: 'pointer',
        }}>← 返回</button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-1)', flex: 1 }}>
          {isNew ? '新建模板' : `编辑：${tpl.name}`}
        </h2>
        {!isNew && (
          <span style={{ fontSize: 11.5, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 4 }}>
            当前版本 v{curV}
          </span>
        )}
        {tpl.builtin && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 4 }}>
            内置模板
          </span>
        )}
      </div>

      {/* Usage notice if editing existing used template */}
      {!isNew && usedNodes.length > 0 && (
        <div style={{
          background: 'oklch(0.20 0.06 195)', border: '1px solid oklch(0.38 0.10 195)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 20,
          fontSize: 12.5, color: 'oklch(0.72 0.10 195)', lineHeight: 1.6,
        }}>
          ⚠ 已有 <strong>{usedNodes.length} 个节点</strong>使用此模板。保存后将生成新版本 v{curV + 1}，
          改动<strong>只对新建节点生效</strong>；已有节点保持旧版（v{curV}），
          可一键批量升级。
        </div>
      )}

      {/* Basic info */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          基本信息
        </div>
        <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
          {/* Glyph */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginBottom: 5 }}>标识字</label>
            <input value={glyph} onChange={e => setGlyph(e.target.value.slice(0, 1))}
              maxLength={1} style={{
                width: 48, height: 48, textAlign: 'center', fontSize: 20, fontWeight: 700,
                background: color, color: '#fff', border: 'none', borderRadius: 8,
                outline: 'none', cursor: 'pointer',
              }} />
          </div>
          {/* Name */}
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginBottom: 5 }}>模板名称</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="科研、开发、生活…"
              style={{
                width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 5, padding: '8px 10px', color: 'var(--text-1)',
                fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box',
              }} />
          </div>
        </div>
        {/* Color */}
        <div>
          <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginBottom: 8 }}>标识色</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {colorOptions.map(c => (
              <div key={c} onClick={() => setColor(c)} style={{
                width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer',
                border: '2px solid ' + (color === c ? 'var(--text-1)' : 'transparent'),
                transition: 'border .1s',
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Three level editors */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          三层结构定义
        </div>
        {[1, 2, 3].map(lv => {
          const verSet = tpl.versions?.[1]?.[lv] || tpl.versions?.[2]?.[lv] || { levelName: 'L' + lv, fields: [] };
          const lvName = levelNames[lv];
          return (
            <LevelEditor key={lv} level={lv}
              levelName={lvName}
              levelSchema={verSet}
              templateColor={color}
              onChangeName={(n) => setLevelNames(prev => ({ ...prev, [lv]: n }))}
              onChangeFields={() => {}}
            />
          );
        })}
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
          color: 'var(--text-2)', padding: '8px 20px', fontSize: 13, cursor: 'pointer',
        }}>取消</button>
        <button onClick={() => { setSaved(true); setTimeout(() => { setSaved(false); onBack(); }, 1500); }} style={{
          background: saved ? 'oklch(0.30 0.10 145)' : 'var(--accent)',
          color: saved ? 'oklch(0.70 0.12 145)' : '#000',
          border: 'none', borderRadius: 6, padding: '8px 24px', fontSize: 13,
          fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
        }}>
          {saved ? '✓ 已保存' : isNew ? '创建模板' : `保存（生成 v${curV + 1}）`}
        </button>
      </div>
    </div>
  );
}

// ─── Template Card (list item) ────────────────────────────
function TemplateCard({ tpl, onEdit, onDelete }) {
  const [hov, setHov] = useTESt(false);
  const usedNodes = NODES.filter(n => n.templateId === tpl.id);
  const curV = Math.max(...Object.keys(tpl.versions || { 1: 1 }).map(Number));

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--surface)', border: '1px solid ' + (hov ? 'oklch(0.40 0.08 195)' : 'var(--border)'),
        borderRadius: 12, overflow: 'hidden', transition: 'border-color .15s',
      }}>
      {/* Color strip */}
      <div style={{ height: 4, background: tpl.color }} />
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: tpl.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: 'rgba(255,255,255,0.95)',
          }}>{tpl.glyph}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{tpl.name}</span>
              {tpl.builtin && (
                <span style={{ fontSize: 10.5, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 3 }}>
                  内置
                </span>
              )}
              <span style={{ fontSize: 10.5, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>
                v{curV}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{tpl.desc}</div>
          </div>
        </div>

        {/* Level names */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[1, 2, 3].map(lv => {
            const schema = getSchema(tpl.id, lv, tpl.currentVersionByLevel?.[lv] || 1);
            return (
              <div key={lv} style={{
                flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '5px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2 }}>L{lv}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)' }}>
                  {schema?.levelName || '—'}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                  {schema?.fields?.length || 0} 字段
                </div>
              </div>
            );
          })}
        </div>

        {/* Stats + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-3)', flex: 1 }}>
            {usedNodes.length > 0 ? `${usedNodes.length} 个节点` : '暂未使用'} · 创建于 {tpl.createdAt}
          </span>
          <button onClick={() => onEdit(tpl)} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 5, color: 'var(--text-1)', padding: '5px 12px', fontSize: 12, cursor: 'pointer',
          }}>编辑</button>
          {/* ADR-010 / PRD §FR-TPL-2：内置与用户模板平级，均可删；删除已被使用的模板 → 相关节点 flags.orphanTemplate=true */}
          <button onClick={() => onDelete(tpl.id, usedNodes.length)} style={{
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 5, color: 'var(--danger)', padding: '5px 12px', fontSize: 12, cursor: 'pointer',
          }} title={usedNodes.length > 0
            ? `已被 ${usedNodes.length} 个节点使用，删除后这些节点变为孤儿模板节点（flags.orphanTemplate=true，合法存在，字段裸键值保留）`
            : '删除此模板'}>
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Template Manager ─────────────────────────────────────
function TemplateManager() {
  const [editing, setEditing] = useTESt(null);
  const [isNew, setIsNew] = useTESt(false);
  const [templates, setTemplates] = useTESt([...TEMPLATES]);

  const handleNew = () => {
    setEditing({
      id: 'new-' + Date.now(), name: '新模板', glyph: '新', color: 'oklch(0.65 0.12 280)',
      builtin: false, desc: '',
      currentVersionByLevel: { 1: 1, 2: 1, 3: 1 },
      versions: { 1: {
        1: { levelName: 'L1', fields: [] },
        2: { levelName: 'L2', fields: [] },
        3: { levelName: 'L3', fields: [] },
      }},
    });
    setIsNew(true);
  };

  if (editing) {
    return <TemplateDetailView tpl={editing} isNew={isNew} onBack={() => { setEditing(null); setIsNew(false); }} />;
  }

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-1)', flex: 1 }}>
          模板管理
        </h2>
        <button onClick={handleNew} style={{
          background: 'var(--accent)', border: 'none', borderRadius: 6,
          color: '#000', padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span dangerouslySetInnerHTML={{ __html: EidonIcons.plus }} />
          新建模板
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 0, marginBottom: 20, lineHeight: 1.6 }}>
        每套模板定义三层节点的名称与字段。<strong style={{ color: 'var(--text-2)' }}>新建 L1 节点时选择模板</strong>，一旦选定无法更换。
        编辑已用模板会生成新版本，老节点不受影响。
      </p>

      {/* Info box: 6 field types */}
      <div style={{
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: 'var(--text-3)',
        display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-2)', marginRight: 4 }}>第一步字段类型：</span>
        {['text', 'textarea', 'number', 'date', 'select', 'boolean'].map(t => (
          <TypeBadge key={t} type={t} />
        ))}
        <span style={{ marginLeft: 4 }}>· relation / tags / 货币等第二步再加</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
        {templates.map(tpl => (
          <TemplateCard key={tpl.id} tpl={tpl}
            onEdit={(t) => { setEditing(t); setIsNew(false); }}
            onDelete={(id, usedCount) => {
              const msg = usedCount > 0
                ? `已有 ${usedCount} 个节点使用此模板。删除后它们将变为「孤儿模板节点」（合法存在，字段裸键值保留，不删值）。继续？`
                : '删除此模板？';
              if (window.confirm(msg)) setTemplates(prev => prev.filter(t => t.id !== id));
            }} />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { TemplateManager });
