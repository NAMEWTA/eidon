/* ============================================================
   EIDON — Sidebar components
   - ActivityBar (column 1) — left, navigation
   - RightActivityBar (column right) — feature drawer triggers
   - LeftPane (column 2) — Explorer / Search / Templates / Trash / Consistency / Settings
   ============================================================ */

const { useState, useMemo } = React;

function Icon({ name }) {
  const svg = window.Icons[name];
  if (!svg) return null;
  return React.createElement("span", {
    className: "i",
    style: { display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 0 },
    dangerouslySetInnerHTML: { __html: svg },
  });
}

// ─────────────────────────────────────────────
// Left activity bar
// ─────────────────────────────────────────────
function ActivityBar({ active, onSelect }) {
  window.useLang();
  const items = [
    { id: "explorer",    icon: "folder",      tip: t("tip.explorer") },
    { id: "search",      icon: "search",      tip: t("tip.search") },
    { id: "templates",   icon: "template",    tip: t("tip.templates") },
    { id: "trash",       icon: "trash",       tip: t("tip.trash") },
    { id: "consistency", icon: "consistency", tip: t("tip.consistency") },
  ];
  const bottom = [
    { id: "settings", icon: "settings", tip: t("tip.settings") },
  ];
  return (
    <div className="activitybar">
      <div className="ab-avatar">E</div>
      <div className="ab-divider"></div>
      {items.map(it => (
        <button key={it.id}
          className="ab-btn"
          data-active={active === it.id}
          onClick={() => onSelect(it.id)}
          title={it.tip}>
          <Icon name={it.icon} />
        </button>
      ))}
      <div className="ab-spacer"></div>
      {bottom.map(it => (
        <button key={it.id}
          className="ab-btn"
          data-active={active === it.id}
          onClick={() => onSelect(it.id)}
          title={it.tip}>
          <Icon name={it.icon} />
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Right activity bar — opens drawer panels
// ─────────────────────────────────────────────
function RightActivityBar({ active, onToggle }) {
  window.useLang();
  const items = [
    { id: "outline", icon: "outline", tip: t("tip.outline") },
    { id: "fields",  icon: "fields",  tip: t("tip.fields") },
    { id: "history", icon: "history", tip: t("tip.history") },
  ];
  return (
    <div className="activitybar activitybar-right">
      {items.map(it => (
        <button key={it.id}
          className="ab-btn"
          data-active={active === it.id}
          onClick={() => onToggle(it.id)}
          title={it.tip}>
          <Icon name={it.icon} />
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// File tree row — node / folder / file
// ─────────────────────────────────────────────
function FileRow({ node, depth, activeId, modifiedIds, onOpen }) {
  const [open, setOpen] = useState(node.open ?? false);

  // Anomaly badges for nodes
  function NodeBadges({ node }) {
    const badges = [];
    if (node.orphan)      badges.push({ key: "orphan",      label: t("ex.badge.orphan"),      cls: "tr-badge tr-badge-warn" });
    if (node.outOfPlace)  badges.push({ key: "outOfPlace",  label: t("ex.badge.outOfPlace"),  cls: "tr-badge tr-badge-warn" });
    if (node.clutter)     badges.push({ key: "clutter",     label: t("ex.badge.clutter"),     cls: "tr-badge tr-badge-info" });
    if (node.clutterHome) badges.push({ key: "clutterHome", label: "·",                       cls: "tr-badge tr-badge-muted" });
    if (node.orphanTemplate)   badges.push({ key: "orphanTemplate",   label: t("ex.badge.orphanTemplate"),   cls: "tr-badge tr-badge-warn" });
    return badges.map(b => (
      <span key={b.key} className={b.cls}>{b.label}</span>
    ));
  }

  // Icon for file based on kind
  function fileIcon(kind) {
    if (kind === "image") return window.Icons.image;
    return window.Icons.doc;
  }

  if (node.type === "node") {
    const levelBadge = node.level ? `L${node.level}` : null;
    return (
      <>
        <div className="tree-row"
             style={{ paddingLeft: 4 + depth * 12 }}
             data-active={false}
             onClick={() => setOpen(!open)}>
          <span className="tr-chev" dangerouslySetInnerHTML={{ __html: window.Icons.chev(open) }}></span>
          <span className="tr-icon">
            <span dangerouslySetInnerHTML={{ __html: open ? window.Icons.folderOpen : window.Icons.nodeFolder }} />
          </span>
          <span className="tr-name">{node.name}</span>
          {levelBadge && <span className="tr-badge tr-badge-level">{levelBadge}</span>}
          <NodeBadges node={node} />
        </div>
        {open && node.children && (
          <div className="tree-children">
            {node.children.map((c, i) => (
              <FileRow key={c.id || i} node={c} depth={depth + 1}
                       activeId={activeId} modifiedIds={modifiedIds} onOpen={onOpen} />
            ))}
          </div>
        )}
      </>
    );
  }

  if (node.type === "folder") {
    return (
      <>
        <div className="tree-row"
             style={{ paddingLeft: 4 + depth * 12 }}
             onClick={() => setOpen(!open)}>
          <span className="tr-chev" dangerouslySetInnerHTML={{ __html: window.Icons.chev(open) }}></span>
          <span className="tr-icon">
            <span dangerouslySetInnerHTML={{ __html: open ? window.Icons.folderOpen : window.Icons.folder }} />
          </span>
          <span className="tr-name">{node.name}</span>
        </div>
        {open && node.children && (
          <div className="tree-children">
            {node.children.map((c, i) => (
              <FileRow key={c.id || i} node={c} depth={depth + 1}
                       activeId={activeId} modifiedIds={modifiedIds} onOpen={onOpen} />
            ))}
          </div>
        )}
      </>
    );
  }

  // type === "file"
  const isActive = node.id === activeId;
  const isModified = modifiedIds?.has(node.id) || node.modified;
  const clutterStyle = node.clutter ? { opacity: 0.65 } : {};
  return (
    <div className="tree-row"
         style={{ paddingLeft: 4 + depth * 12, ...clutterStyle }}
         data-active={isActive}
         data-modified={isModified}
         onClick={() => onOpen?.(node)}>
      <span className="tr-chev"></span>
      <span className="tr-icon" dangerouslySetInnerHTML={{ __html: fileIcon(node.kind) }}></span>
      <span className="tr-name">{node.name}</span>
      {node.badge && <span className="tr-badge">{node.badge}</span>}
      {node.clutter && <span className="tr-badge tr-badge-info">{t("ex.badge.clutter")}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Explorer
// ─────────────────────────────────────────────
function ExplorerView({ activeId, modifiedIds, onOpen }) {
  window.useLang();
  const openEditors = [
    { id: "doc-exp1",         name: "实验1.md",         path: "实验记录" },
    { id: "doc-survey-notes", name: "Survey 笔记.md",   path: "文献" },
  ];
  return (
    <>
      <div className="pane-header">
        <div className="pane-title">{t("ex.title")} · <span className="pt-em">{t("ex.workspaceName")}</span></div>
        <div className="pane-actions">
          <button className="icon-btn" title={t("tip.newnode")}    dangerouslySetInnerHTML={{ __html: window.Icons.newfile }}></button>
          <button className="icon-btn" title={t("tip.refresh")}    dangerouslySetInnerHTML={{ __html: window.Icons.refresh }}></button>
          <button className="icon-btn" title={t("tip.collapseAll")} dangerouslySetInnerHTML={{ __html: window.Icons.collapse }}></button>
        </div>
      </div>
      <div className="tree-section"><span>{t("ex.openEditors")}</span><span className="ts-count">{openEditors.length}</span></div>
      <div className="tree" style={{ marginTop: -4 }}>
        {openEditors.map(e => (
          <div key={e.id} className="tree-row"
               data-active={activeId === e.id}
               data-modified={modifiedIds?.has(e.id)}
               onClick={() => onOpen?.({ id: e.id, name: e.name })}>
            <span className="tr-chev"></span>
            <span className="tr-icon" dangerouslySetInnerHTML={{ __html: window.Icons.doc }}></span>
            <span className="tr-name">{e.name} <em>{e.path}</em></span>
          </div>
        ))}
      </div>
      <div className="tree-section"><span>{t("ex.tree")}</span><span className="ts-count">32</span></div>
      <div className="tree">
        {window.FileTree.map((n, i) => (
          <FileRow key={n.id || i} node={n} depth={0}
                   activeId={activeId} modifiedIds={modifiedIds} onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────
function SearchView({ onOpen }) {
  window.useLang();
  const [q, setQ] = useState("小样本");
  const [filterCase, setFilterCase] = useState(false);
  const [filterWord, setFilterWord] = useState(false);
  const [filterRegex, setFilterRegex] = useState(false);

  const hits = window.SampleSearchHits[q] || [];
  const grouped = useMemo(() => {
    const m = {};
    hits.forEach(h => { (m[h.file] ||= []).push(h); });
    return m;
  }, [hits]);

  return (
    <>
      <div className="pane-header">
        <div className="pane-title">{t("search.title")}</div>
        <div className="pane-actions">
          <button className="icon-btn" title={t("tip.replace")} dangerouslySetInnerHTML={{ __html: window.Icons.pen }}></button>
          <button className="icon-btn" title={t("tip.refresh")} dangerouslySetInnerHTML={{ __html: window.Icons.refresh }}></button>
        </div>
      </div>
      <div className="search-input-wrap">
        <div className="search-input">
          <span style={{ color: "var(--ink-3)" }} dangerouslySetInnerHTML={{ __html: window.Icons.search }}></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("search.placeholder")} />
          <span style={{ color: "var(--ink-4)", fontSize: 10 }}>{t("search.hits", hits.length)}</span>
        </div>
        <div className="search-input" style={{ background: "var(--paper-2)" }}>
          <span style={{ color: "var(--ink-4)" }}>↳</span>
          <input placeholder={t("search.replace")} />
        </div>
      </div>
      <div className="search-toolbar">
        <button className="chip" data-on={filterCase} onClick={() => setFilterCase(!filterCase)}>Aa</button>
        <button className="chip" data-on={filterWord} onClick={() => setFilterWord(!filterWord)}>\\b</button>
        <button className="chip" data-on={filterRegex} onClick={() => setFilterRegex(!filterRegex)}>.*</button>
      </div>

      {Object.entries(grouped).map(([file, items]) => (
        <div key={file}>
          <div className="search-group"><span>{file}</span><span>{items.length}</span></div>
          {items.map((h, i) => (
            <div className="search-hit" key={i} onClick={() => onOpen?.({ id: "doc-exp1", line: h.line })}>
              <div className="sh-path">{h.line ? `L${h.line}` : "字段"}</div>
              <div className="sh-snippet" dangerouslySetInnerHTML={{ __html: h.snippet }}></div>
            </div>
          ))}
        </div>
      ))}
      {hits.length === 0 && (
        <div style={{ padding: "20px 14px", fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-3)" }}>
          {t("search.noResults", q)}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────
function TemplatesView({ activeTemplateId, onOpenTemplate }) {
  window.useLang();
  const totalFields = (tpl) => tpl.levels.reduce((s, l) => s + l.fields.length, 0);
  return (
    <>
      <div className="pane-header">
        <div className="pane-title">{t("templates.title")}</div>
        <div className="pane-actions">
          <button className="icon-btn" title={t("tip.newtemplate")} dangerouslySetInnerHTML={{ __html: window.Icons.plus }}></button>
        </div>
      </div>
      <div style={{ padding: "0 12px 6px", fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
        {t("templates.intro")}
      </div>
      {window.Templates.map(tpl => (
        <div key={tpl.id} className="schema-card" data-active={activeTemplateId === tpl.id}
             onClick={() => onOpenTemplate?.(tpl)}>
          <div className="sc-name">
            <span className="sc-glyph" style={{ background: tpl.color }}>{tpl.glyph}</span>
            <span>{tpl.name}</span>
            {tpl.builtIn && (
              <span style={{ marginLeft: 6, fontSize: 10, color: "var(--ink-3)", border: "1px solid var(--ink-4)", borderRadius: 3, padding: "0 3px" }}>
                {t("templates.builtin")}
              </span>
            )}
            <span style={{ marginLeft: "auto", color: "var(--ink-3)", fontSize: 11, fontFamily: "var(--f-mono)" }}>
              {t("templates.version", tpl.version)}
            </span>
          </div>
          <div className="sc-meta">
            {tpl.levels.map(l => (
              <span key={l.level} style={{ marginRight: 8 }}>
                <span style={{ opacity: 0.5, fontSize: 10 }}>{`L${l.level}`} </span>{l.name}
              </span>
            ))}
          </div>
          <div className="sc-meta" style={{ marginTop: 2 }}>
            {t("templates.fields", totalFields(tpl))} · {t("templates.usedBy", tpl.usedBy)}
          </div>
        </div>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────
// Trash
// ─────────────────────────────────────────────
function TrashView() {
  window.useLang();
  const [confirming, setConfirming] = useState(null);

  function RestoreNote({ note }) {
    if (!note) return null;
    return (
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.4 }}>
        ⚠ {t(`trash.${note}`)}
      </div>
    );
  }

  return (
    <>
      <div className="pane-header">
        <div className="pane-title">{t("trash.title")}</div>
      </div>
      <div style={{ padding: "0 12px 6px", fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
        {t("trash.intro")}
      </div>
      {window.TrashItems.length === 0 && (
        <div style={{ padding: "20px 14px", color: "var(--ink-3)", fontSize: 11.5 }}>
          {t("trash.empty")}
        </div>
      )}
      {window.TrashItems.map(item => (
        <div key={item.deletionId} className="schema-card">
          <div className="sc-name">
            <span dangerouslySetInnerHTML={{ __html: window.Icons.trash }} style={{ color: "var(--ink-3)", marginRight: 6 }} />
            <span>{item.name}</span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-3)" }}>
              {t("trash.daysLeft", item.daysLeft)}
            </span>
          </div>
          <div className="sc-meta">
            {t("trash.origin")}: {item.origin.join(" / ")}
          </div>
          <div className="sc-meta">{t("trash.template")}: {item.templateName}</div>
          <div className="sc-meta">{t("trash.deletedAt")}: {item.deletedAt}</div>
          <RestoreNote note={item.restoreNote} />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button className="chip" style={{ color: "var(--accent)" }}
                    dangerouslySetInnerHTML={{ __html: window.Icons.restore + " " + t("trash.restore") }} />
            {confirming === item.deletionId
              ? (
                <button className="chip" style={{ color: "var(--red, #e55)" }}
                        onClick={() => setConfirming(null)}>
                  {t("trash.purgeConfirm")}
                </button>
              ) : (
                <button className="chip" onClick={() => setConfirming(item.deletionId)}>
                  {t("trash.purge")}
                </button>
              )
            }
          </div>
        </div>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────
// Consistency
// ─────────────────────────────────────────────
function ConsistencyView() {
  window.useLang();
  const cats = [
    { key: "outOfPlace",   icon: "warning" },
    { key: "clutter",      icon: "warning" },
    { key: "orphan",       icon: "warning" },
    { key: "disconnected", icon: "consistency" },
    { key: "repair",       icon: "consistency" },
  ];
  const [open, setOpen] = useState({ outOfPlace: true, clutter: true, orphan: true });
  const items = window.ConsistencyItems;
  const totalCount = cats.reduce((s, c) => s + (items[c.key]?.length || 0), 0);

  return (
    <>
      <div className="pane-header">
        <div className="pane-title">{t("consistency.title")}</div>
        <div className="pane-actions">
          <span style={{ fontSize: 11, color: totalCount > 0 ? "var(--accent)" : "var(--ink-3)", fontFamily: "var(--f-mono)" }}>
            {totalCount > 0 ? totalCount : "✓"}
          </span>
        </div>
      </div>
      <div style={{ padding: "0 12px 6px", fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
        {t("consistency.intro")}
      </div>
      {totalCount === 0 && (
        <div style={{ padding: "20px 14px", color: "var(--ink-3)", fontSize: 11.5 }}>
          {t("consistency.empty")}
        </div>
      )}
      {cats.map(cat => {
        const catItems = items[cat.key] || [];
        if (catItems.length === 0) return null;
        const isOpen = open[cat.key] ?? false;
        return (
          <div key={cat.key}>
            <div className="tree-section" style={{ cursor: "pointer" }}
                 onClick={() => setOpen(o => ({ ...o, [cat.key]: !o[cat.key] }))}>
              <span dangerouslySetInnerHTML={{ __html: window.Icons.chev(isOpen) }} style={{ marginRight: 4 }} />
              <span>{t(`consistency.cat.${cat.key}`)}</span>
              <span className="ts-count">{catItems.length}</span>
            </div>
            {isOpen && catItems.map(item => (
              <div key={item.id} className="schema-card" style={{ margin: "0 8px 4px" }}>
                <div className="sc-name">
                  <span dangerouslySetInnerHTML={{ __html: window.Icons[cat.icon] }} style={{ color: "var(--ink-3)", marginRight: 6 }} />
                  <span>{item.name}</span>
                </div>
                <div className="sc-meta">{item.path.join(" / ")}</div>
                <div className="sc-meta" style={{ marginTop: 2, color: "var(--ink-3)", lineHeight: 1.4 }}>{item.note}</div>
                {cat.key === "disconnected" && (
                  <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 4, lineHeight: 1.4 }}>
                    {t("consistency.softnote")}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {item.actions.map((a, i) => (
                    <button key={i} className="chip">{a}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────
// Settings — category list in LeftPane
// ─────────────────────────────────────────────
window.SettingsCategories = [
  { id: "editor",      icon: "doc",         key: "settings.cat.editor" },
  { id: "appearance",  icon: "template",    key: "settings.cat.appearance" },
  { id: "workspace",   icon: "folder",      key: "settings.cat.workspace" },
  { id: "snapshots",   icon: "branch",      key: "settings.cat.snapshots" },
  { id: "cleanup",     icon: "consistency", key: "settings.cat.cleanup" },
  { id: "keymap",      icon: "fields",      key: "settings.cat.keymap" },
  { id: "lang",        icon: "search",      key: "settings.cat.lang" },
  { id: "about",       icon: "info",        key: "settings.cat.about" },
];

function SettingsCategoryList({ activeId, onPick }) {
  window.useLang();
  const [q, setQ] = useState("");
  const cats = window.SettingsCategories.filter(c =>
    !q || t(c.key).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="pane-header">
        <div className="pane-title">{t("settings.title")}</div>
      </div>
      <div className="search-input-wrap" style={{ margin: "0 12px 10px" }}>
        <div className="search-input">
          <span style={{ color: "var(--ink-3)" }} dangerouslySetInnerHTML={{ __html: window.Icons.search }}></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("settings.searchPlaceholder")} />
        </div>
      </div>
      <div className="settings-cats">
        {cats.map(c => (
          <button key={c.id}
                  className="settings-cat"
                  data-active={activeId === c.id}
                  onClick={() => onPick(c)}>
            <span className="sc-icon" dangerouslySetInnerHTML={{ __html: window.Icons[c.icon] || window.Icons.doc }}></span>
            <span className="sc-label">{t(c.key)}</span>
            <span className="sc-chev" dangerouslySetInnerHTML={{ __html: window.Icons.chev(false) }}></span>
          </button>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// LeftPane wrapper — picks view
// ─────────────────────────────────────────────
function LeftPane({ view, activeDocId, modifiedIds, onOpenDoc,
                    activeTemplateId, onOpenTemplate,
                    activeSettingsId, onOpenSettings }) {
  return (
    <div className="leftpane">
      <div className="pane-body">
        {view === "explorer"     && <ExplorerView activeId={activeDocId} modifiedIds={modifiedIds} onOpen={onOpenDoc} />}
        {view === "search"       && <SearchView onOpen={onOpenDoc} />}
        {view === "templates"    && <TemplatesView activeTemplateId={activeTemplateId} onOpenTemplate={onOpenTemplate} />}
        {view === "trash"        && <TrashView />}
        {view === "consistency"  && <ConsistencyView />}
        {view === "settings"     && <SettingsCategoryList activeId={activeSettingsId} onPick={onOpenSettings} />}
      </div>
    </div>
  );
}

Object.assign(window, {
  Icon, ActivityBar, RightActivityBar, LeftPane, SettingsCategoryList,
});
