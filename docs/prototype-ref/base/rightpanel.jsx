/* ============================================================
   EIDON 基座 v2 — Right Panel
   PropertiesPanel · OutlinePanel · HistoryPanel
   ============================================================ */
const { useState: useRPSt, useRef: useRPRef } = React;

// ─── Field Editor (6 types) ───────────────────────────────
function FieldEditor({ field, value, onChange }) {
  const base = {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 5, color: 'var(--text-1)', fontSize: 12.5, outline: 'none',
    width: '100%',
  };

  if (field.type === 'boolean') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          onClick={() => onChange(!value)}
          style={{
            width: 36, height: 20, borderRadius: 10,
            background: value ? 'var(--accent)' : 'var(--border)',
            cursor: 'pointer', position: 'relative', transition: 'background .2s',
          }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%', background: '#fff',
            position: 'absolute', top: 3, left: value ? 19 : 3,
            transition: 'left .2s',
          }} />
        </div>
        <span style={{ fontSize: 12.5, color: value ? 'var(--accent)' : 'var(--text-3)' }}>
          {value ? '是' : '否'}
        </span>
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        style={{
          ...base, padding: '5px 8px', cursor: 'pointer',
          appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='%238a929a' stroke-width='1.5'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
          backgroundSize: '10px', paddingRight: 28,
        }}>
        <option value="">— 未设置 —</option>
        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea value={value || ''} onChange={e => onChange(e.target.value)}
        rows={3} style={{ ...base, padding: '6px 8px', resize: 'vertical', lineHeight: 1.5 }} />
    );
  }

  if (field.type === 'number') {
    return (
      <input type="number" value={value || ''} onChange={e => onChange(Number(e.target.value))}
        style={{ ...base, padding: '5px 8px' }} />
    );
  }

  if (field.type === 'date') {
    return (
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder="YYYY-MM"
        style={{ ...base, padding: '5px 8px' }} />
    );
  }

  // text (default)
  return (
    <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
      style={{ ...base, padding: '5px 8px' }} />
  );
}

// ─── Properties Panel ─────────────────────────────────────
function PropertiesPanel({ nodeId }) {
  const node = getNode(nodeId);
  if (!node) return (
    <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 12.5, textAlign: 'center' }}>
      选择一个节点查看属性
    </div>
  );

  const [fields, setFields] = useRPSt(node.fields || {});
  const [saved, setSaved] = useRPSt(false);
  const tpl = getTemplate(node.templateId);
  const schema = getSchema(node.templateId, node.level, node.schemaVersion);
  const isOutdated = isSchemaOutdated(node);
  const currentSchema = getTemplateCurrentSchema(node.templateId, node.level);

  const handleChange = (key, val) => {
    setFields(f => ({ ...f, [key]: val }));
    setSaved(false);
  };

  const handleSave = () => setSaved(true);

  return (
    <div style={{ padding: '16px 14px', overflowY: 'auto', height: '100%' }}>
      {/* Node identity */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
        padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, background: tpl?.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.95)', flexShrink: 0,
        }}>{tpl?.glyph}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {schema?.levelName || 'L' + node.level} · {tpl?.name}
          </div>
        </div>
      </div>

      {/* Schema version indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14, padding: '6px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Schema</span>
          <span style={{
            fontSize: 11, background: isOutdated ? 'oklch(0.20 0.05 55)' : 'var(--surface-2)',
            color: isOutdated ? 'oklch(0.72 0.12 55)' : 'var(--text-3)',
            padding: '2px 6px', borderRadius: 4, fontWeight: 600,
            border: '1px solid ' + (isOutdated ? 'oklch(0.38 0.10 55)' : 'var(--border)'),
          }}>v{node.schemaVersion}</span>
          {isOutdated && (
            <>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>→</span>
              <span style={{ fontSize: 11, background: 'var(--accent-bg)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                v{currentSchema.version} 可用
              </span>
            </>
          )}
        </div>
        {isOutdated && (
          <button style={{
            fontSize: 11, background: 'transparent', color: 'var(--accent)',
            border: '1px solid var(--accent)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
          }}>升级</button>
        )}
      </div>

      {/* Fields */}
      {schema?.fields?.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {schema.fields.map(f => (
            <div key={f.key}>
              <label style={{
                display: 'block', fontSize: 11.5, fontWeight: 500,
                color: 'var(--text-2)', marginBottom: 5,
              }}>
                {f.key}
                {f.required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
              </label>
              <FieldEditor
                field={f}
                value={fields[f.key]}
                onChange={(val) => handleChange(f.key, val)}
              />
            </div>
          ))}
          <button onClick={handleSave} style={{
            background: saved ? 'oklch(0.25 0.08 145)' : 'var(--accent)',
            color: saved ? 'oklch(0.70 0.12 145)' : '#000',
            border: 'none', borderRadius: 6, padding: '8px', fontSize: 13,
            fontWeight: 600, cursor: 'pointer', marginTop: 4, transition: 'all .2s',
          }}>
            {saved ? '✓ 已保存' : '保存字段'}
          </button>
        </div>
      ) : (
        <div style={{ padding: '20px 0', color: 'var(--text-3)', fontSize: 12.5, textAlign: 'center' }}>
          此模板层无自定义字段
        </div>
      )}

      {/* Metadata section */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          节点元数据
        </div>
        {[
          ['ID', node.id],
          ['模板', tpl?.name || '—'],
          ['层级', 'L' + node.level],
          ['创建', node.createdAt],
          ['父节点', node.parentId || '— 工作区根'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', width: 55, flexShrink: 0 }}>{k}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-2)', fontFamily: k === 'ID' ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>
              {v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Outline Panel ────────────────────────────────────────
function OutlinePanel({ fileId }) {
  const content = FILE_CONTENTS[fileId] || '';
  const headings = content.split('\n')
    .map((line, i) => {
      const m = line.match(/^(#{1,3}) (.+)/);
      if (!m) return null;
      return { level: m[1].length, text: m[2], line: i };
    })
    .filter(Boolean);

  if (headings.length === 0) return (
    <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 12.5, textAlign: 'center' }}>
      {fileId ? '此文件无标题' : '打开一个文件查看大纲'}
    </div>
  );

  return (
    <div style={{ padding: '8px 4px', overflowY: 'auto' }}>
      {headings.map((h, i) => (
        <div key={i}
          style={{
            paddingLeft: (h.level - 1) * 14 + 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5,
            fontSize: 12.5, color: h.level === 1 ? 'var(--text-1)' : h.level === 2 ? 'var(--text-2)' : 'var(--text-3)',
            fontWeight: h.level === 1 ? 600 : 400,
            cursor: 'pointer', borderRadius: 4,
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          {h.text}
        </div>
      ))}
    </div>
  );
}

// ─── Diff View ────────────────────────────────────────────
function DiffView({ diff }) {
  const lines = diff.split('\n');
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
      lineHeight: 1.6, overflowX: 'auto',
    }}>
      {lines.map((line, i) => {
        const isAdd = line.startsWith('+') && !line.startsWith('+++');
        const isRem = line.startsWith('-') && !line.startsWith('---');
        const isHunk = line.startsWith('@');
        return (
          <div key={i} style={{
            padding: '1px 12px', whiteSpace: 'pre',
            background: isAdd ? 'oklch(0.18 0.07 145)' : isRem ? 'oklch(0.18 0.07 25)' : isHunk ? 'var(--surface-2)' : 'transparent',
            color: isAdd ? 'oklch(0.72 0.12 145)' : isRem ? 'oklch(0.68 0.12 25)' : isHunk ? 'oklch(0.65 0.10 280)' : 'var(--text-2)',
            borderLeft: isAdd ? '2px solid oklch(0.50 0.12 145)' : isRem ? '2px solid oklch(0.50 0.12 25)' : '2px solid transparent',
          }}>{line}</div>
        );
      })}
    </div>
  );
}

// ─── History Panel ────────────────────────────────────────
function HistoryPanel({ fileId }) {
  const [selectedSnap, setSelectedSnap] = useRPSt(null);
  const snaps = fileId ? SNAPSHOTS.filter(s => s.fileId === fileId) : [];
  const snap = selectedSnap || snaps[snaps.length - 1];

  if (snaps.length === 0) return (
    <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 12.5, textAlign: 'center' }}>
      {fileId ? '暂无版本记录' : '打开一个文件查看历史'}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Commit list */}
      <div style={{
        maxHeight: 200, overflowY: 'auto', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {[...snaps].reverse().map(s => (
          <div key={s.id}
            onClick={() => setSelectedSnap(s)}
            style={{
              padding: '8px 12px', cursor: 'pointer',
              background: snap?.id === s.id ? 'var(--accent-bg)' : 'transparent',
              borderBottom: '1px solid var(--border)',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}
            onMouseEnter={e => { if (snap?.id !== s.id) e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={e => { if (snap?.id !== s.id) e.currentTarget.style.background = 'transparent'; }}>
            {/* Commit dot */}
            <div style={{ marginTop: 5, flexShrink: 0 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: snap?.id === s.id ? 'var(--accent)' : 'var(--border)',
                border: '1px solid ' + (snap?.id === s.id ? 'var(--accent)' : 'var(--text-3)'),
              }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-1)', fontWeight: 500, marginBottom: 2 }}>
                {s.message}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', gap: 8 }}>
                <span>{s.timestamp}</span>
                <span style={{
                  fontFamily: 'monospace', background: 'var(--surface-2)',
                  padding: '0 4px', borderRadius: 3,
                }}>{s.shortHash}</span>
                <span style={{
                  background: s.trigger === '手动保存' ? 'var(--accent-bg)' : 'var(--surface-2)',
                  color: s.trigger === '手动保存' ? 'var(--accent)' : 'var(--text-3)',
                  padding: '0 4px', borderRadius: 3,
                }}>{s.trigger}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Diff area */}
      {snap && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Diff header */}
          <div style={{
            padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
            borderBottom: '1px solid var(--border)', flexShrink: 0,
            background: 'var(--surface)',
          }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', flex: 1 }}>
              {snap.shortHash} — {snap.message}
            </span>
            <span style={{ fontSize: 11, color: 'oklch(0.68 0.12 145)', background: 'oklch(0.18 0.05 145)', padding: '2px 6px', borderRadius: 3 }}>
              +{snap.linesAdded}
            </span>
            <span style={{ fontSize: 11, color: 'oklch(0.68 0.12 25)', background: 'oklch(0.18 0.05 25)', padding: '2px 6px', borderRadius: 3 }}>
              -{snap.linesRemoved}
            </span>
            <button style={{
              fontSize: 11.5, background: 'transparent', color: 'var(--text-2)',
              border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span dangerouslySetInnerHTML={{ __html: EidonIcons.restore }} />
              恢复此版本
            </button>
          </div>
          {/* Diff content */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
            <DiffView diff={SAMPLE_DIFF} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Right Panel Container ────────────────────────────────
function RightPanel({ selectedNodeId, selectedFileId, activeFileId }) {
  const [tab, setTab] = useRPSt('props');

  const tabs = [
    { id: 'outline', label: '大纲', icon: 'outline' },
    { id: 'props',   label: '属性', icon: 'props' },
    { id: 'history', label: '历史', icon: 'history' },
  ];

  return (
    <div style={{
      width: 272, background: 'var(--surface)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, height: 38, border: 'none', cursor: 'pointer',
              background: tab === t.id ? 'var(--surface-2)' : 'transparent',
              color: tab === t.id ? 'var(--text-1)' : 'var(--text-3)',
              borderBottom: '2px solid ' + (tab === t.id ? 'var(--accent)' : 'transparent'),
              fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
            <span dangerouslySetInnerHTML={{ __html: EidonIcons[t.icon] }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {tab === 'props' && <PropertiesPanel nodeId={selectedNodeId} />}
        {tab === 'outline' && <OutlinePanel fileId={activeFileId} />}
        {tab === 'history' && <HistoryPanel fileId={activeFileId || (selectedFileId)} />}
      </div>
    </div>
  );
}

Object.assign(window, { RightPanel });
