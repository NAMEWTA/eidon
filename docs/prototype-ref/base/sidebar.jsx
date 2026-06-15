/* ============================================================
   EIDON 基座 v2 — Sidebar
   ActivityBar · FileTree · SearchPanel
   ============================================================ */
const { useState: useSt } = React;

// ─── Icon Button ─────────────────────────────────────────
function IconBtn({ icon, active, onClick, badge, title, style }) {
  const [hov, setHov] = useSt(false);
  return (
    <button title={title} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 40, height: 40, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, position: 'relative', transition: 'all .1s',
        background: active ? 'var(--accent-bg)' : hov ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--accent)' : hov ? 'var(--text-1)' : 'var(--text-2)',
        ...style,
      }}>
      <span dangerouslySetInnerHTML={{ __html: EidonIcons[icon] }} />
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: 5, right: 5, minWidth: 14, height: 14,
          background: 'oklch(0.72 0.14 55)', borderRadius: 10,
          fontSize: 9, fontWeight: 700, color: 'oklch(0.15 0.05 55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
        }}>{badge}</span>
      )}
    </button>
  );
}

// ─── Activity Bar ─────────────────────────────────────────
function ActivityBar({ activePanel, onPanel, issues }) {
  const total = Object.values(issues || {}).reduce((a, b) => a + b, 0);
  const panels = [
    { id: 'files',       icon: 'files',    title: '文件树 (⌘1)' },
    { id: 'search',      icon: 'search',   title: '搜索 (⌘F)' },
    { id: 'templates',   icon: 'template', title: '模板管理 (⌘T)' },
    { id: 'consistency', icon: 'shield',   title: '一致性面板', badge: total },
    { id: 'trash',       icon: 'trash',    title: '回收站' },
  ];
  return (
    <div style={{
      width: 48, background: 'var(--bg)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 8, paddingBottom: 8, gap: 2, flexShrink: 0, zIndex: 10,
    }}>
      {panels.map(p => (
        <IconBtn key={p.id} icon={p.icon} title={p.title}
          active={activePanel === p.id} badge={p.badge}
          onClick={() => onPanel(p.id)} />
      ))}
      <div style={{ flex: 1 }} />
      <IconBtn icon="settings" title="设置" active={activePanel === 'settings'}
        onClick={() => onPanel('settings')} />
    </div>
  );
}

// ─── Template Badge ───────────────────────────────────────
function TemplateBadge({ templateId, level, treeStyle }) {
  const tpl = getTemplate(templateId);
  if (!tpl) return (
    <div style={{ width: 14, height: 14, borderRadius: 2, background: 'var(--border)', flexShrink: 0 }} />
  );
  if (treeStyle === 'lines') {
    return (
      <div style={{
        width: 3, height: { 1: 18, 2: 14, 3: 11 }[level] || 12,
        background: tpl.color, borderRadius: 2, flexShrink: 0,
      }} />
    );
  }
  const sz = { 1: 20, 2: 16, 3: 13 }[level] || 14;
  return (
    <div style={{
      width: sz, height: sz,
      borderRadius: { 1: 4, 2: 3, 3: 2 }[level] || 3,
      background: tpl.color, flexShrink: 0, userSelect: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: { 1: 10, 2: 8.5, 3: 7 }[level] || 8,
      fontWeight: 700, color: 'rgba(255,255,255,0.95)',
      letterSpacing: '-0.3px',
    }}>
      {tpl.glyph}
    </div>
  );
}

// ─── File Row (within expanded L3) ──────────────────────
function FileRow({ file, nodeId, depth, selectedFileId, onSelectFile }) {
  const [hov, setHov] = useSt(false);
  const sel = selectedFileId === file.id;
  const modeColor = { bigFile: 'var(--warning)', readOnly: 'var(--danger)' }[file.sizeMode];
  const modeLabel = { bigFile: '大文件', readOnly: '只读' }[file.sizeMode];
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => onSelectFile(nodeId, file.id)}
      style={{
        paddingLeft: depth * 14 + 8, paddingRight: 8, height: 26,
        display: 'flex', alignItems: 'center', gap: 5,
        background: sel ? 'var(--accent-bg)' : hov ? 'var(--surface-2)' : 'transparent',
        cursor: 'pointer', borderRadius: 4,
      }}>
      <span style={{ color: 'var(--text-3)', flexShrink: 0, opacity: 0.7 }}
        dangerouslySetInnerHTML={{ __html: getFileIcon(file.type) }} />
      <span style={{
        fontSize: 12.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: sel ? 'var(--accent)' : 'var(--text-2)',
      }}>{file.name}</span>
      {modeLabel && (
        <span style={{
          fontSize: 9.5, fontWeight: 600, color: modeColor, flexShrink: 0,
          background: 'oklch(0.18 0.04 55)', borderRadius: 3, padding: '1px 4px',
        }}>{modeLabel}</span>
      )}
    </div>
  );
}

// ─── Tree Node Row (recursive) ────────────────────────────
function TreeNodeRow({ node, depth, expandedNodes, selectedNodeId, onToggle, onSelect, selectedFileId, onSelectFile, treeStyle }) {
  const [hov, setHov] = useSt(false);
  const [ctxHov, setCtxHov] = useSt(false);
  const expanded = expandedNodes.has(node.id);
  const selected = selectedNodeId === node.id;
  const children = getNodeChildren(node.id);
  const files = node.level === 3 ? getNodeFiles(node.id) : [];
  const hasChildren = children.length > 0 || files.length > 0;
  const isOutdated = isSchemaOutdated(node);

  return (
    <div>
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        onClick={() => onSelect(node.id)}
        style={{
          paddingLeft: depth * 14 + 6, paddingRight: 4, height: 30,
          display: 'flex', alignItems: 'center', gap: 3,
          background: selected ? 'var(--accent-bg)' : hov ? 'var(--surface-2)' : 'transparent',
          cursor: 'pointer', borderRadius: 4, userSelect: 'none',
        }}>
        {/* Chevron */}
        <span onClick={hasChildren ? (e) => { e.stopPropagation(); onToggle(node.id); } : undefined}
          style={{
            width: 14, height: 14, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-3)', opacity: hasChildren ? 1 : 0,
          }}
          dangerouslySetInnerHTML={{ __html: expanded ? EidonIcons.chevDown : EidonIcons.chevRight }} />

        {/* Badge */}
        <TemplateBadge templateId={node.templateId} level={node.level} treeStyle={treeStyle} />

        {/* Name */}
        <span style={{
          fontSize: node.level === 1 ? 13.5 : 13,
          fontWeight: node.level === 1 ? 600 : 450,
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: selected ? 'var(--accent)' : node.flags?.orphan ? 'oklch(0.70 0.10 290)' : 'var(--text-1)',
        }}>{node.name}</span>

        {/* Right-side indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          {isOutdated && !hov && (
            <span style={{
              fontSize: 9.5, color: 'var(--text-3)', background: 'var(--surface-2)',
              borderRadius: 3, padding: '1px 4px', fontFamily: 'monospace',
              border: '1px solid var(--border)',
            }}>v{node.schemaVersion}</span>
          )}
          {node.clutterFiles?.length > 0 && (
            <span style={{
              background: 'oklch(0.58 0.14 55)', borderRadius: 10,
              minWidth: 16, height: 14, padding: '0 4px',
              fontSize: 9, fontWeight: 700, color: 'oklch(0.12 0.04 55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} title="待整理文件">{node.clutterFiles.length}</span>
          )}
          {node.flags?.outOfPlace && (
            <span style={{ color: 'oklch(0.74 0.13 55)', fontSize: 11 }} title="越界节点">⬦</span>
          )}
          {node.flags?.orphan && (
            <span style={{
              fontSize: 9.5, color: 'oklch(0.70 0.10 290)',
              background: 'oklch(0.20 0.05 290)', padding: '1px 5px',
              borderRadius: 3, fontWeight: 600,
            }}>孤儿</span>
          )}
          {/* Context menu on hover */}
          {hov && (
            <span onMouseEnter={() => setCtxHov(true)} onMouseLeave={() => setCtxHov(false)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 4, color: 'var(--text-2)',
                background: ctxHov ? 'var(--border)' : 'transparent',
              }}
              dangerouslySetInnerHTML={{ __html: EidonIcons.more }} />
          )}
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {children.map(child => (
            <TreeNodeRow key={child.id} node={child} depth={depth + 1}
              expandedNodes={expandedNodes} selectedNodeId={selectedNodeId}
              onToggle={onToggle} onSelect={onSelect}
              selectedFileId={selectedFileId} onSelectFile={onSelectFile}
              treeStyle={treeStyle} />
          ))}
          {files.map(file => (
            <FileRow key={file.id} file={file} nodeId={node.id} depth={depth + 1}
              selectedFileId={selectedFileId} onSelectFile={onSelectFile} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── File Tree ────────────────────────────────────────────
function FileTree({ expandedNodes, selectedNodeId, selectedFileId, onToggle, onSelect, onSelectFile, treeStyle }) {
  const roots = getRootNodes();
  // Regular roots, then orphans separately
  const regularRoots = roots.filter(n => !n.flags?.orphan);
  const orphans = roots.filter(n => n.flags?.orphan);

  return (
    <div style={{ padding: '6px 4px', overflowY: 'auto', flex: 1 }}>
      {/* Add L1 button */}
      <div style={{ padding: '0 4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)', flex: 1, fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
          工作区
        </span>
        <button onClick={() => {}}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 11.5, padding: '2px 6px', borderRadius: 4,
          }}
          title="新建 L1 节点（需先选择模板）">
          <span dangerouslySetInnerHTML={{ __html: EidonIcons.plus }} />
          <span>新建</span>
        </button>
      </div>

      {/* Regular nodes */}
      {regularRoots.map(node => (
        <TreeNodeRow key={node.id} node={node} depth={0}
          expandedNodes={expandedNodes} selectedNodeId={selectedNodeId}
          onToggle={onToggle} onSelect={onSelect}
          selectedFileId={selectedFileId} onSelectFile={onSelectFile}
          treeStyle={treeStyle} />
      ))}

      {/* Orphan section */}
      {orphans.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ padding: '0 6px 4px', fontSize: 11, color: 'oklch(0.60 0.09 290)', fontWeight: 600 }}>
            ── 孤儿节点 ─────────────
          </div>
          {orphans.map(node => (
            <TreeNodeRow key={node.id} node={node} depth={0}
              expandedNodes={expandedNodes} selectedNodeId={selectedNodeId}
              onToggle={onToggle} onSelect={onSelect}
              selectedFileId={selectedFileId} onSelectFile={onSelectFile}
              treeStyle={treeStyle} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Search Panel ─────────────────────────────────────────
function SearchPanel({ onSelectFile, onSelectNode }) {
  const [q, setQ] = useSt('');
  const results = q.length > 1 ? SEARCH_RESULTS.filter(r =>
    r.match.toLowerCase().includes(q.toLowerCase()) ||
    r.fileName.toLowerCase().includes(q.toLowerCase())
  ) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 8px 4px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--surface-2)', borderRadius: 6,
          border: '1px solid var(--border)', padding: '5px 8px',
        }}>
          <span style={{ color: 'var(--text-3)' }} dangerouslySetInnerHTML={{ __html: EidonIcons.search }} />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="搜索内容或标题…"
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              color: 'var(--text-1)', fontSize: 13, flex: 1,
            }} />
        </div>
        {q.length > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6, padding: '0 2px' }}>
            {results.length > 0 ? `${results.length} 个结果` : '未找到匹配'}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px' }}>
        {results.map((r, i) => (
          <div key={i} onClick={() => onSelectFile(r.nodeId, r.fileId)}
            style={{
              padding: '8px 8px', borderRadius: 6, cursor: 'pointer',
              marginBottom: 2,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 3 }}>
              {r.nodePath.join(' › ')}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-1)', fontWeight: 500, marginBottom: 3 }}>
              {r.fileName}
            </div>
            <div style={{
              fontSize: 11.5, color: 'var(--text-2)', fontStyle: 'italic',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {r.match}
            </div>
          </div>
        ))}
        {q.length <= 1 && (
          <div style={{ padding: '24px 12px', color: 'var(--text-3)', fontSize: 12.5, textAlign: 'center' }}>
            输入关键词开始搜索<br />
            <span style={{ fontSize: 11, marginTop: 6, display: 'block' }}>支持全文搜索 · 标题 · 字段值</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sidebar Container ────────────────────────────────────
function Sidebar({ activePanel, expandedNodes, selectedNodeId, selectedFileId,
  onToggle, onSelect, onSelectFile, treeStyle }) {
  const panelTitles = {
    files: '文件树',
    search: '搜索',
    templates: '模板管理',
    consistency: '一致性',
    trash: '回收站',
    settings: '设置',
  };

  return (
    <div style={{
      width: 260, background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        height: 38, display: 'flex', alignItems: 'center', padding: '0 12px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
          {panelTitles[activePanel] || activePanel}
        </span>
      </div>

      {/* Panel content */}
      {activePanel === 'files' && (
        <FileTree
          expandedNodes={expandedNodes} selectedNodeId={selectedNodeId}
          selectedFileId={selectedFileId}
          onToggle={onToggle} onSelect={onSelect} onSelectFile={onSelectFile}
          treeStyle={treeStyle} />
      )}
      {activePanel === 'search' && (
        <SearchPanel onSelectFile={onSelectFile} onSelectNode={onSelect} />
      )}
      {(activePanel === 'templates' || activePanel === 'consistency' || activePanel === 'trash' || activePanel === 'settings') && (
        <div style={{ padding: 12, color: 'var(--text-3)', fontSize: 12.5 }}>
          在右侧主区域查看
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ActivityBar, Sidebar, TemplateBadge });
