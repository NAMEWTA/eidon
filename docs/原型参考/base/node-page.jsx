/* ============================================================
   EIDON 基座 v2 — Node Pages
   L1L2NodePage (3 layouts) · L3NodePage · ClutterBanner · FieldDisplay
   ============================================================ */
const { useState: useNPSt, useContext: useNPCtx } = React;

// ─── Field Display (read-only) ────────────────────────────
function FieldDisplay({ field, value }) {
  const typeIcon = {
    text: EidonIcons.type_text, textarea: EidonIcons.type_textarea,
    number: EidonIcons.type_number, date: EidonIcons.type_date,
    select: EidonIcons.type_select, boolean: EidonIcons.type_boolean,
  };

  const renderValue = () => {
    if (value === undefined || value === null || value === '') {
      return <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>—</span>;
    }
    if (field.type === 'boolean') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          color: value ? 'var(--success)' : 'var(--text-3)',
          fontSize: 12.5,
        }}>
          <span dangerouslySetInnerHTML={{ __html: value ? EidonIcons.check : '○' }} />
          {value ? '是' : '否'}
        </span>
      );
    }
    if (field.type === 'select') {
      return (
        <span style={{
          background: 'var(--surface-2)', borderRadius: 4,
          padding: '2px 8px', fontSize: 12.5, color: 'var(--text-1)',
          border: '1px solid var(--border)',
        }}>{value}</span>
      );
    }
    return <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{value}</span>;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: 12 }}>
      <span style={{ color: 'var(--text-3)', fontSize: 12.5, width: 90, flexShrink: 0, paddingTop: 2 }}>
        {field.key}
      </span>
      <div>{renderValue()}</div>
    </div>
  );
}

// ─── Clutter Banner（PRD §FR-CLEAN / ADR-008 乙：标记+用户必须点击整理）─
function ClutterBanner({ clutterFiles, onOrganize }) {
  if (!clutterFiles || clutterFiles.length === 0) return null;
  return (
    <div style={{
      background: 'oklch(0.22 0.07 55)', border: '1px solid oklch(0.40 0.12 55)',
      borderRadius: 8, padding: '10px 14px', marginBottom: 20,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ color: 'oklch(0.72 0.14 55)' }}
        dangerouslySetInnerHTML={{ __html: EidonIcons.warning }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'oklch(0.80 0.12 55)', marginBottom: 2 }}>
          本层有 {clutterFiles.length} 个待整理文件
        </div>
        <div style={{ fontSize: 12, color: 'oklch(0.60 0.08 55)' }}>
          {clutterFiles.map(s => s.name).join('、')}
        </div>
      </div>
      <button onClick={onOrganize} style={{
        background: 'oklch(0.55 0.14 55)', color: '#000', border: 'none',
        borderRadius: 5, padding: '5px 12px', fontSize: 12.5, fontWeight: 600,
        cursor: 'pointer', flexShrink: 0,
      }}>整理</button>
      <button style={{
        background: 'transparent', color: 'oklch(0.60 0.08 55)',
        border: '1px solid oklch(0.40 0.12 55)',
        borderRadius: 5, padding: '5px 12px', fontSize: 12.5,
        cursor: 'pointer', flexShrink: 0,
      }}>提升为节点</button>
    </div>
  );
}

// ─── Schema Outdated Banner ───────────────────────────────
function SchemaOutdatedBanner({ node }) {
  const [hov, setHov] = useNPSt(false);
  if (!isSchemaOutdated(node)) return null;
  const tpl = getTemplate(node.templateId);
  const cur = tpl?.currentVersionByLevel?.[node.level] || 1;
  const count = tpl?.nodeCountByVersion?.[node.level]?.[node.schemaVersion] || 0;
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', marginBottom: 20,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ color: 'var(--text-3)' }}
        dangerouslySetInnerHTML={{ __html: EidonIcons.upgrade }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 2 }}>
          使用模板 <code style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>v{node.schemaVersion}</code>，
          当前最新为 <code style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>v{cur}</code>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          改动只对新建节点生效；点击升级可获得新字段
        </div>
      </div>
      <button style={{
        background: 'transparent', color: 'var(--text-2)',
        border: '1px solid var(--border)', borderRadius: 5,
        padding: '5px 12px', fontSize: 12.5, cursor: 'pointer',
      }}>升级到 v{cur}</button>
    </div>
  );
}

// ─── Out-of-Place Banner ──────────────────────────────────
function OutOfPlaceBanner({ node }) {
  if (!node.flags?.outOfPlace) return null;
  const tpl = getTemplate(node.templateId);
  return (
    <div style={{
      background: 'oklch(0.20 0.06 55)', border: '1px solid oklch(0.38 0.10 55)',
      borderRadius: 8, padding: '10px 14px', marginBottom: 20,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ color: 'oklch(0.70 0.12 55)', fontSize: 16 }}>⬦</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'oklch(0.78 0.11 55)', marginBottom: 2 }}>
          越界节点 · {tpl?.name}「{getSchema(node.templateId, node.level, node.schemaVersion)?.levelName || 'L' + node.level}」
        </div>
        <div style={{ fontSize: 12, color: 'oklch(0.58 0.08 55)' }}>
          此节点所在位置与其模板预期不符，字段和内容保持原样不变
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button style={{
          background: 'transparent', color: 'oklch(0.60 0.08 55)',
          border: '1px solid oklch(0.38 0.10 55)', borderRadius: 5,
          padding: '5px 10px', fontSize: 12, cursor: 'pointer',
        }}>接受现状</button>
        <button style={{
          background: 'transparent', color: 'oklch(0.60 0.08 55)',
          border: '1px solid oklch(0.38 0.10 55)', borderRadius: 5,
          padding: '5px 10px', fontSize: 12, cursor: 'pointer',
        }}>移回原位</button>
      </div>
    </div>
  );
}

// ─── Child Node Card ──────────────────────────────────────
function ChildNodeCard({ node, onSelect, layout }) {
  const [hov, setHov] = useNPSt(false);
  const tpl = getTemplate(node.templateId);
  const schema = getSchema(node.templateId, node.level, node.schemaVersion);
  const children = getNodeChildren(node.id);
  const files = node.level === 3 ? getNodeFiles(node.id) : [];

  if (layout === 'list') {
    return (
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        onClick={() => onSelect(node.id)} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 7, cursor: 'pointer',
          background: hov ? 'var(--surface-2)' : 'transparent',
          border: '1px solid ' + (hov ? 'var(--border)' : 'transparent'),
        }}>
        <div style={{
          width: 16, height: 16, borderRadius: 3,
          background: tpl?.color || 'var(--border)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
        }}>{tpl?.glyph}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-1)' }}>{node.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
            {schema?.levelName} · {children.length + files.length} 项
          </div>
        </div>
        {node.flags?.outOfPlace && <span style={{ color: 'oklch(0.70 0.12 55)', fontSize: 12 }}>⬦</span>}
        {node.clutterFiles?.length > 0 && (
          <span style={{
            background: 'oklch(0.55 0.13 55)', borderRadius: 10, padding: '1px 6px',
            fontSize: 10, color: '#000', fontWeight: 700,
          }}>{node.clutterFiles.length}</span>
        )}
      </div>
    );
  }

  // Card layout (default for notebook and kanban)
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => onSelect(node.id)} style={{
        background: 'var(--surface)', border: '1px solid ' + (hov ? 'oklch(0.42 0.06 195)' : 'var(--border)'),
        borderRadius: 10, padding: 16, cursor: 'pointer',
        transition: 'border-color .15s, box-shadow .15s',
        boxShadow: hov ? '0 0 0 1px oklch(0.35 0.08 195)' : 'none',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 4,
          background: tpl?.color || 'var(--border)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
        }}>{tpl?.glyph}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>
            {schema?.levelName || 'L' + node.level}
          </div>
        </div>
        {node.flags?.outOfPlace && <span style={{ color: 'oklch(0.70 0.12 55)', fontSize: 12 }}>⬦</span>}
        {node.clutterFiles?.length > 0 && (
          <span style={{
            background: 'oklch(0.55 0.13 55)', borderRadius: 10, padding: '1px 6px',
            fontSize: 9.5, color: '#000', fontWeight: 700,
          }}>{node.clutterFiles.length}</span>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>
        {node.name}
      </div>
      {/* First 2 fields preview */}
      {schema?.fields?.slice(0, 2).map(f => (
        <div key={f.key} style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 3 }}>
          <span style={{ marginRight: 6 }}>{f.key}:</span>
          <span style={{ color: 'var(--text-2)' }}>
            {node.fields?.[f.key] !== undefined ? String(node.fields[f.key]) : '—'}
          </span>
        </div>
      ))}
      <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-3)', display: 'flex', gap: 10 }}>
        <span>{children.length > 0 ? `${children.length} 子节点` : ''}</span>
        <span>{files.length > 0 ? `${files.length} 文件` : ''}</span>
      </div>
    </div>
  );
}

// ─── README Display ───────────────────────────────────────
function ReadmeDisplay({ text, onEdit }) {
  const [hov, setHov] = useNPSt(false);
  const lines = (text || '').split('\n');
  const html = lines.map(line => {
    if (line.startsWith('## ')) return `<h2 style="font-size:15px;font-weight:600;margin:0 0 8px;color:var(--text-1)">${line.slice(3)}</h2>`;
    if (line.startsWith('# ')) return `<h1 style="font-size:17px;font-weight:700;margin:0 0 10px;color:var(--text-1)">${line.slice(2)}</h1>`;
    if (line.startsWith('### ')) return `<h3 style="font-size:13px;font-weight:600;margin:0 0 6px;color:var(--text-1)">${line.slice(4)}</h3>`;
    if (line.startsWith('- ')) return `<div style="margin-bottom:4px;padding-left:12px;color:var(--text-2);font-size:13px">· ${line.slice(2)}</div>`;
    if (line.trim() === '') return '<div style="height:8px"></div>';
    return `<div style="color:var(--text-2);font-size:13px;margin-bottom:4px;line-height:1.6">${line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')}</div>`;
  }).join('');

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ position: 'relative' }}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {hov && (
        <button onClick={onEdit} style={{
          position: 'absolute', top: 0, right: 0,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 5, padding: '4px 10px', fontSize: 12, color: 'var(--text-2)',
          cursor: 'pointer',
        }}>编辑 README</button>
      )}
    </div>
  );
}

// ─── L1 / L2 Node Page ────────────────────────────────────
function L1L2NodePage({ node, onSelectNode, layout, tweaks }) {
  const [organized, setOrganized] = useNPSt(false);
  const tpl = getTemplate(node.templateId);
  const schema = getSchema(node.templateId, node.level, node.schemaVersion);
  const children = getNodeChildren(node.id);
  const clutterFiles = organized ? [] : (node.clutterFiles || []);

  const fieldRows = schema?.fields?.map(f => ({ field: f, value: node.fields?.[f.key] })) || [];

  // ── NOTEBOOK layout ───────────────────────────────
  if (layout === 'notebook') {
    return (
      <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>
        {/* Hero header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 10,
            background: tpl?.color, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 22, fontWeight: 800,
            color: 'rgba(255,255,255,0.95)', flexShrink: 0,
          }}>{tpl?.glyph}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: tpl?.color, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {schema?.levelName || 'L' + node.level}
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.2 }}>
              {node.name}
            </h1>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', flexShrink: 0, paddingTop: 4 }}>
            创建于 {node.createdAt}
          </div>
        </div>

        {/* Banners */}
        <ClutterBanner clutterFiles={clutterFiles} onOrganize={() => setOrganized(true)} />
        <OutOfPlaceBanner node={node} />
        <SchemaOutdatedBanner node={node} />

        {/* Fields row */}
        {fieldRows.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 28,
          }}>
            {fieldRows.map(({ field, value }) => (
              <div key={field.key} style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', minWidth: 120,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{field.key}</div>
                <FieldDisplay field={field} value={value} />
              </div>
            ))}
          </div>
        )}

        {/* README */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 24, marginBottom: 28,
        }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            README
          </div>
          <ReadmeDisplay text={node.readme} onEdit={() => {}} />
        </div>

        {/* Child nodes */}
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {children.length > 0 ? `${schema?.fields ? getSchema(node.templateId, node.level + 1, 1)?.levelName || 'L' + (node.level + 1) : 'L' + (node.level + 1)}（${children.length}）` : '暂无子节点'}
          </span>
          <button style={{
            border: 'none', background: 'transparent', color: 'var(--text-3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 12,
            padding: '2px 6px', borderRadius: 4,
          }}>
            <span dangerouslySetInnerHTML={{ __html: EidonIcons.plus }} />新建
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {children.map(child => (
            <ChildNodeCard key={child.id} node={child} onSelect={onSelectNode} layout="card" />
          ))}
        </div>
      </div>
    );
  }

  // ── DIRECTORY layout ──────────────────────────────
  if (layout === 'directory') {
    return (
      <div style={{ display: 'flex', height: '100%' }}>
        {/* Left fields panel */}
        <div style={{
          width: 240, borderRight: '1px solid var(--border)',
          padding: '24px 16px', overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 7, background: tpl?.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.95)', flexShrink: 0,
            }}>{tpl?.glyph}</div>
            <div>
              <div style={{ fontSize: 10.5, color: tpl?.color, fontWeight: 600, textTransform: 'uppercase' }}>
                {schema?.levelName}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{node.name}</div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <SchemaOutdatedBanner node={node} />
            {fieldRows.map(({ field, value }) => (
              <FieldDisplay key={field.key} field={field} value={value} />
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 8 }}>{node.createdAt} 创建</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              模板：{tpl?.name} v{node.schemaVersion}
            </div>
          </div>
        </div>
        {/* Right content */}
        <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          <ClutterBanner clutterFiles={clutterFiles} onOrganize={() => setOrganized(true)} />
          <OutOfPlaceBanner node={node} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 14 }}>
            README
          </div>
          <ReadmeDisplay text={node.readme} onEdit={() => {}} />
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 12 }}>
              子节点 ({children.length})
            </div>
            {children.map(child => (
              <ChildNodeCard key={child.id} node={child} onSelect={onSelectNode} layout="list" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── KANBAN layout ─────────────────────────────────
  return (
    <div style={{ padding: '20px 24px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, background: tpl?.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
        }}>{tpl?.glyph}</div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>{node.name}</h2>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4 }}>{schema?.levelName}</span>
        <div style={{ flex: 1 }} />
        <ClutterBanner clutterFiles={clutterFiles} onOrganize={() => setOrganized(true)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {children.map(child => (
          <ChildNodeCard key={child.id} node={child} onSelect={onSelectNode} layout="card" />
        ))}
        {children.length === 0 && (
          <div style={{
            padding: '32px 20px', textAlign: 'center', color: 'var(--text-3)',
            border: '2px dashed var(--border)', borderRadius: 10, fontSize: 13,
          }}>
            暂无子节点<br />
            <button style={{
              marginTop: 8, background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-2)', borderRadius: 5, padding: '4px 12px',
              fontSize: 12, cursor: 'pointer',
            }}>+ 新建</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── L3 Node Page (File List) ─────────────────────────────
function L3NodePage({ node, onOpenFile, selectedFileId }) {
  const tpl = getTemplate(node.templateId);
  const schema = getSchema(node.templateId, node.level, node.schemaVersion);
  const files = getNodeFiles(node.id);

  const modeStyle = (mode) => ({
    fluent:  { color: 'var(--success)', label: '全功能',   bg: 'oklch(0.18 0.05 145)' },
    bigFile: { color: 'var(--warning)', label: '大文件档', bg: 'oklch(0.18 0.05 55)' },
    readOnly:{ color: 'var(--danger)',  label: '只读档',   bg: 'oklch(0.18 0.05 25)' },
  })[mode] || { color: 'var(--text-3)', label: '', bg: 'transparent' };

  return (
    <div style={{ padding: '28px 36px', maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: tpl?.color, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 18, fontWeight: 700,
          color: 'rgba(255,255,255,0.95)', flexShrink: 0,
        }}>{tpl?.glyph}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: tpl?.color, marginBottom: 3, textTransform: 'uppercase' }}>
            {schema?.levelName || 'L3'}
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-1)' }}>{node.name}</h1>
        </div>
        <button style={{
          border: 'none', background: 'var(--surface-2)', color: 'var(--text-2)',
          borderRadius: 6, padding: '6px 14px', fontSize: 12.5, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span dangerouslySetInnerHTML={{ __html: EidonIcons.plus }} />
          新建文件
        </button>
      </div>

      <OutOfPlaceBanner node={node} />
      <SchemaOutdatedBanner node={node} />

      {/* README */}
      {node.readme && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: 'var(--text-2)',
        }}>
          {node.readme.replace(/^#+\s*/gm, '').split('\n')[0]}
        </div>
      )}

      {/* Files */}
      <div style={{ marginBottom: 8, fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        文件（{files.length}）
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {files.map(file => {
          const ms = modeStyle(file.sizeMode);
          const sel = selectedFileId === file.id;
          return (
            <div key={file.id} onClick={() => onOpenFile(node.id, file.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                background: sel ? 'var(--accent-bg)' : 'var(--surface)',
                border: '1px solid ' + (sel ? 'var(--accent)' : 'var(--border)'),
                transition: 'all .1s',
              }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'var(--surface)'; }}>
              <span style={{ color: 'var(--text-3)' }}
                dangerouslySetInnerHTML={{ __html: getFileIcon(file.type) }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-1)' }}>{file.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                  {formatSize(file.sizeKB)}
                </div>
              </div>
              {file.sizeMode !== 'fluent' && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: ms.color,
                  background: ms.bg, borderRadius: 4, padding: '3px 8px',
                }}>{ms.label}</span>
              )}
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
                {sel ? '✦ 打开中' : '打开 →'}
              </span>
            </div>
          );
        })}
        {files.length === 0 && (
          <div style={{
            padding: '40px 20px', textAlign: 'center',
            border: '2px dashed var(--border)', borderRadius: 10,
            color: 'var(--text-3)', fontSize: 13,
          }}>
            此节点暂无内容文件<br />
            <span style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              L3 是唯一可直接存放 Markdown / 图片 / PDF 的层
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Node Page Dispatcher ─────────────────────────────────
function NodePage({ selectedNodeId, selectedFileId, onSelectNode, onOpenFile, layout }) {
  if (!selectedNodeId) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-3)', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>⌘</div>
        <div style={{ fontSize: 14 }}>选择一个节点开始</div>
        <div style={{ fontSize: 12 }}>或按 ⌘K 快速跳转</div>
      </div>
    );
  }
  const node = getNode(selectedNodeId);
  if (!node) return null;

  if (node.level <= 2) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', height: '100%' }}>
        <L1L2NodePage node={node} onSelectNode={onSelectNode} layout={layout} />
      </div>
    );
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto', height: '100%' }}>
      <L3NodePage node={node} onOpenFile={onOpenFile} selectedFileId={selectedFileId} />
    </div>
  );
}

Object.assign(window, { NodePage, TemplateBadge, FieldDisplay });
