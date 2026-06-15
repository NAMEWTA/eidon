/* ============================================================
   EIDON 基座 v2 — Markdown Editor
   TabBar · Breadcrumbs · FileSizeBanner · MarkdownEditor
   ============================================================ */
const { useState: useEdSt, useEffect: useEdEff, useRef: useEdRef } = React;

// ─── Breadcrumbs ──────────────────────────────────────────
function Breadcrumbs({ nodeId, fileName }) {
  const path = getNodePath(nodeId);
  const items = fileName ? [...path, { name: fileName, isFile: true }] : path;
  return (
    <div style={{
      height: 32, display: 'flex', alignItems: 'center', padding: '0 16px',
      gap: 4, borderBottom: '1px solid var(--border)',
      background: 'var(--surface)', overflowX: 'auto',
      scrollbarWidth: 'none', flexShrink: 0,
    }}>
      <span style={{ fontSize: 11.5, color: 'var(--text-3)', flexShrink: 0 }}>
        {WorkspaceMeta.name}
      </span>
      {items.map((item, i) => {
        const tpl = item.templateId ? getTemplate(item.templateId) : null;
        return (
          <React.Fragment key={i}>
            <span style={{ color: 'var(--text-3)', fontSize: 11, flexShrink: 0 }}>/</span>
            <span style={{
              fontSize: 12, color: item.isFile ? 'var(--text-1)' : (tpl?.color || 'var(--text-2)'),
              fontWeight: item.isFile ? 500 : 400, flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              {item.isFile ? item.name : item.name}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────
function TabBar({ openTabs, activeTabId, onSelectTab, onCloseTab, onAddTab }) {
  return (
    <div style={{
      height: 38, display: 'flex', alignItems: 'stretch',
      background: 'var(--bg)', borderBottom: '1px solid var(--border)',
      overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0,
    }}>
      {openTabs.map(tab => {
        const active = tab.id === activeTabId;
        return (
          <div key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '0 14px', minWidth: 120, maxWidth: 200,
              background: active ? 'var(--surface)' : 'transparent',
              borderRight: '1px solid var(--border)',
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', flexShrink: 0, position: 'relative',
            }}>
            <span style={{ color: 'var(--text-3)', flexShrink: 0 }}
              dangerouslySetInnerHTML={{ __html: getFileIcon(tab.fileType) }} />
            <span style={{
              fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', flex: 1,
              color: active ? 'var(--text-1)' : 'var(--text-2)',
              fontWeight: active ? 500 : 400,
            }}>{tab.fileName}</span>
            {tab.isDirty && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
            )}
            <span onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
              style={{
                flexShrink: 0, width: 14, height: 14, borderRadius: 3,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-3)', fontSize: 10,
              }}
              dangerouslySetInnerHTML={{ __html: EidonIcons.close }} />
          </div>
        );
      })}
      {openTabs.length === 0 && (
        <div style={{
          padding: '0 16px', display: 'flex', alignItems: 'center',
          color: 'var(--text-3)', fontSize: 12.5, fontStyle: 'italic',
        }}>
          未打开文件
        </div>
      )}
    </div>
  );
}

// ─── File Size Banner ─────────────────────────────────────
function FileSizeBanner({ sizeMode, sizeMB }) {
  if (sizeMode === 'fluent') return null;
  const configs = {
    bigFile: {
      bg: 'oklch(0.20 0.07 55)', border: 'oklch(0.38 0.12 55)',
      color: 'oklch(0.78 0.13 55)',
      icon: '⚠',
      msg: `大文件档（${sizeMB?.toFixed(1) || '?'} MB）· 实时预览已关闭以保障性能`,
      hint: '如需全功能编辑，请将文件拆分至 2MB 以内',
    },
    readOnly: {
      bg: 'oklch(0.18 0.06 25)', border: 'oklch(0.36 0.10 25)',
      color: 'oklch(0.72 0.12 25)',
      icon: '🔒',
      msg: `只读预览（文件超过 10MB）· 不支持 EIDON 内编辑`,
      hint: '请使用外部编辑器（VS Code / Neovim 等）修改此文件',
    },
  };
  const c = configs[sizeMode];
  if (!c) return null;
  return (
    <div style={{
      padding: '8px 16px', background: c.bg, borderBottom: `1px solid ${c.border}`,
      display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
    }}>
      <span style={{ fontSize: 14 }}>{c.icon}</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: c.color }}>{c.msg}</span>
        <span style={{ fontSize: 11.5, color: 'oklch(0.55 0.06 55)', marginLeft: 8 }}>{c.hint}</span>
      </div>
    </div>
  );
}

// ─── Simple Markdown Preview ──────────────────────────────
function renderMarkdown(text) {
  return text
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:600;margin:16px 0 8px;color:var(--text-1)">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;font-weight:700;margin:20px 0 10px;color:var(--text-1)">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:800;margin:0 0 16px;color:var(--text-1)">$1</h1>')
    .replace(/^\| (.+) \|$/gm, (m) => {
      const cells = m.slice(2, -2).split(' | ');
      return '<div style="display:flex;gap:0;margin-bottom:1px">' + cells.map(c =>
        `<span style="flex:1;padding:5px 8px;background:var(--surface-2);border:1px solid var(--border);font-size:12.5px;color:var(--text-1)">${c.trim()}</span>`
      ).join('') + '</div>';
    })
    .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:16px 0"/>')
    .replace(/^\- \[x\] (.+)$/gm, '<div style="padding-left:16px;color:var(--text-3);font-size:13px;text-decoration:line-through;margin:3px 0">✓ $1</div>')
    .replace(/^\- \[ \] (.+)$/gm, '<div style="padding-left:16px;color:var(--text-2);font-size:13px;margin:3px 0">○ $1</div>')
    .replace(/^\- (.+)$/gm, '<div style="padding-left:14px;color:var(--text-2);font-size:13px;margin:3px 0">· $1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-1)">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:var(--surface-2);padding:1px 5px;border-radius:3px;font-family:\'JetBrains Mono\',monospace;font-size:12px;color:var(--accent)">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid var(--accent);padding-left:12px;color:var(--text-2);margin:10px 0;font-style:italic;font-size:13px">$1</blockquote>')
    .replace(/\n\n/g, '<div style="height:10px"></div>')
    .replace(/\n/g, '<br/>');
}

// ─── Markdown Editor ──────────────────────────────────────
function MarkdownEditor({ fileId, nodeId, fileName, sizeMode, sizeMB }) {
  const content = FILE_CONTENTS[fileId] || '# ' + fileName + '\n\n내용을 입력하세요...';
  const [text, setText] = useEdSt(content);
  const [mode, setMode] = useEdSt('split'); // edit | split | preview
  const [dirty, setDirty] = useEdSt(false);
  const [saved, setSaved] = useEdSt(false);

  const readonly = sizeMode === 'readOnly';
  const noPreview = sizeMode === 'bigFile';

  // Auto-save simulation
  useEdEff(() => {
    if (!dirty) return;
    const t = setTimeout(() => { setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }, 2000);
    return () => clearTimeout(t);
  }, [text, dirty]);

  const handleChange = (e) => { if (!readonly) { setText(e.target.value); setDirty(true); setSaved(false); } };

  const actualMode = readonly ? 'preview' : noPreview ? 'edit' : mode;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <FileSizeBanner sizeMode={sizeMode} sizeMB={sizeMB} />

      {/* Toolbar */}
      <div style={{
        height: 38, display: 'flex', alignItems: 'center', padding: '0 16px',
        gap: 8, borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-1)', flex: 1 }}>
          {fileName}
        </span>
        {/* Mode switcher */}
        {!readonly && !noPreview && (
          <div style={{
            display: 'flex', background: 'var(--surface-2)',
            borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)',
          }}>
            {[['edit', '编辑'], ['split', '分栏'], ['preview', '预览']].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} style={{
                border: 'none', padding: '4px 10px', fontSize: 12,
                background: actualMode === m ? 'var(--accent-bg)' : 'transparent',
                color: actualMode === m ? 'var(--accent)' : 'var(--text-2)',
                cursor: 'pointer', fontWeight: actualMode === m ? 600 : 400,
              }}>{label}</button>
            ))}
          </div>
        )}
        {/* Save status */}
        <div style={{ fontSize: 11.5, color: saved ? 'var(--success)' : dirty ? 'var(--warning)' : 'var(--text-3)' }}>
          {saved ? '✓ 已保存' : dirty ? '● 未保存' : '已同步'}
        </div>
        {/* Branch info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 11.5 }}>
          <span dangerouslySetInnerHTML={{ __html: EidonIcons.branch }} />
          <span>main</span>
        </div>
      </div>

      {/* Editor area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Edit pane */}
        {(actualMode === 'edit' || actualMode === 'split') && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            borderRight: actualMode === 'split' ? '1px solid var(--border)' : 'none',
            minWidth: 0,
          }}>
            <textarea
              value={text}
              onChange={handleChange}
              readOnly={readonly}
              spellCheck={false}
              style={{
                flex: 1, border: 'none', outline: 'none', resize: 'none',
                background: 'var(--bg)', color: 'var(--text-1)',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: 13.5, lineHeight: 1.7,
                padding: '24px 32px', overflowY: 'auto',
                tabSize: 2,
              }}
            />
          </div>
        )}

        {/* Preview pane */}
        {(actualMode === 'preview' || actualMode === 'split') && (
          <div style={{
            flex: 1, overflowY: 'auto', padding: '24px 40px',
            background: 'var(--surface)', minWidth: 0,
          }}>
            <div
              style={{ maxWidth: 680, color: 'var(--text-2)', lineHeight: 1.7, fontSize: 13.5 }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty Editor Placeholder ─────────────────────────────
function EditorPlaceholder({ onSelectNode }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-3)', gap: 16,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, opacity: 0.6,
      }}>⌘</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
          未打开文件
        </div>
        <div style={{ fontSize: 12.5 }}>
          从文件树选择一个 L3 节点，打开其中的文件
        </div>
      </div>
    </div>
  );
}

// ─── Editor Container ─────────────────────────────────────
function EditorContainer({ activeTab, openTabs, onSelectTab, onCloseTab }) {
  if (openTabs.length === 0 || !activeTab) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <TabBar openTabs={openTabs} activeTabId={null} onSelectTab={onSelectTab} onCloseTab={onCloseTab} />
        <EditorPlaceholder />
      </div>
    );
  }

  const { fileId, nodeId, fileName, fileType, sizeMode, sizeMB } = activeTab;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TabBar openTabs={openTabs} activeTabId={activeTab.id}
        onSelectTab={onSelectTab} onCloseTab={onCloseTab} />
      <Breadcrumbs nodeId={nodeId} fileName={fileName} />
      <MarkdownEditor
        fileId={fileId} nodeId={nodeId} fileName={fileName}
        sizeMode={sizeMode} sizeMB={sizeMB}
      />
    </div>
  );
}

Object.assign(window, { EditorContainer, Breadcrumbs });
