/* ============================================================
   EIDON — Auxiliary screens
   - CommandPalette (⌘K)
   - TemplateEditor (replaces SchemaEditor)
   - Welcome
   ============================================================ */

function CommandPalette({ onClose, onPick }) {
  window.useLang();
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState(0);
  const items = window.CommandItems;

  const flat = React.useMemo(() => {
    const a = [];
    items.forEach(g => g.items.forEach(it => {
      if (!q || it.name.toLowerCase().includes(q.toLowerCase())) a.push({ ...it, group: g.group });
    }));
    return a;
  }, [q, items]);

  React.useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") { onClose(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => (s + 1) % flat.length); }
      else if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => (s - 1 + flat.length) % flat.length); }
      else if (e.key === "Enter") { onPick?.(flat[selected]); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [flat, selected, onClose, onPick]);

  return (
    <div className="cmd-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmd">
        <div className="cmd-input-row">
          <span style={{ color: "var(--clay)", display: "inline-flex" }}
                dangerouslySetInnerHTML={{ __html: window.Icons.search }}></span>
          <input autoFocus value={q} onChange={e => { setQ(e.target.value); setSelected(0); }}
                 placeholder={t("cmd.placeholder")} />
          <span className="kbd">⌘K</span>
        </div>
        <div className="cmd-results">
          {(() => {
            let idx = -1;
            return items.map((g, gi) => {
              const filteredItems = g.items.filter(it => !q || it.name.toLowerCase().includes(q.toLowerCase()));
              if (filteredItems.length === 0) return null;
              return (
                <div key={gi}>
                  <div className="cmd-group-label">{g.group}</div>
                  {filteredItems.map((it, i) => {
                    idx++;
                    const myIdx = idx;
                    return (
                      <div className="cmd-item" key={i}
                           data-active={myIdx === selected}
                           onMouseEnter={() => setSelected(myIdx)}
                           onClick={() => onPick?.(it)}>
                        <span className="ci-icon" style={{ color: "var(--ink-3)" }}
                              dangerouslySetInnerHTML={{ __html: window.Icons[it.icon] || window.Icons.doc }}></span>
                        <span className="ci-name">{it.name}</span>
                        {it.kbd && <kbd>{it.kbd}</kbd>}
                        {it.meta && !it.kbd && <span className="ci-meta">{it.meta}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}
          {flat.length === 0 && (
            <div style={{ padding: "20px", fontSize: 12.5, color: "var(--ink-3)", textAlign: "center", fontStyle: "italic" }}>
              {t("cmd.noResults", q)}
            </div>
          )}
        </div>
        <div className="cmd-foot">
          <div className="cmd-hints">
            <span><kbd>↑↓</kbd> {t("cmd.hint.nav")}</span>
            <span><kbd>↩</kbd> {t("cmd.hint.open")}</span>
            <span><kbd>⌘↩</kbd> {t("cmd.hint.openBeside")}</span>
            <span><kbd>esc</kbd> {t("cmd.hint.close")}</span>
          </div>
          <span>{t("cmd.results", flat.length)}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Template editor (replaces SchemaEditor)
// Three-level: L1 / L2 / L3, each with name + fields
// Field types: text / textarea / number / date / select / boolean only
// ─────────────────────────────────────────────
const FIELD_TYPES = ["text", "textarea", "number", "date", "select", "boolean"];

function fieldTypeDot(type) {
  return {
    text:     "var(--syn-com)",
    textarea: "var(--syn-com)",
    number:   "var(--syn-num)",
    select:   "var(--syn-fn)",
    boolean:  "var(--sage)",
    date:     "var(--syn-fn)",
  }[type] || "var(--ink-3)";
}

function TemplateLayerSection({ layer, levelLabel, subtitle }) {
  window.useLang();
  const [open, setOpen] = React.useState(true);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: open ? 10 : 0 }}
           onClick={() => setOpen(o => !o)}>
        <span dangerouslySetInnerHTML={{ __html: window.Icons.chev(open) }} />
        <span style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>{levelLabel}</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{layer.name}</span>
        <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{subtitle}</span>
      </div>
      {open && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "28px 160px 120px 1fr auto",
                        gap: 8, padding: "4px 8px", fontSize: 10.5, color: "var(--ink-4)",
                        letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>
            <span></span>
            <span>{t("te.column.name")}</span>
            <span>{t("te.column.type")}</span>
            <span>{t("te.column.desc")}</span>
            <span>{t("te.column.flags")}</span>
          </div>
          {layer.fields.map((f, i) => (
            <div className="field" key={i}>
              <span className="f-handle">⋮⋮</span>
              <span className="f-name">{f.name}</span>
              <span className="f-type">
                <span className="f-type-dot" style={{ background: fieldTypeDot(f.type) }}></span>
                {f.type}
              </span>
              <span className="f-desc">{f.desc || (f.options ? `options: ${f.options.join(" | ")}` : "—")}</span>
              <div className="f-flags">
                <span className="f-flag" data-on={!!f.required}>{t("te.flag.req")}</span>
                {f.default !== undefined && (
                  <span className="f-flag" data-on={true}>{t("te.flag.default")}: {String(f.default)}</span>
                )}
              </div>
            </div>
          ))}
          <div className="field-add">
            <span dangerouslySetInnerHTML={{ __html: window.Icons.plus }}></span>
            {t("te.addField")}
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateEditor({ template, onBack }) {
  window.useLang();
  if (!template) return null;

  const subtitles = [t("te.subL1"), t("te.subL2"), t("te.subL3")];
  const totalFields = template.levels.reduce((s, l) => s + l.fields.length, 0);

  const jsonPreview = JSON.stringify({
    id: template.id,
    name: template.name,
    version: template.version,
    levels: template.levels.map(l => ({
      level: l.level,
      name: l.name,
      fields: l.fields.map(f => ({
        name: f.name, type: f.type,
        ...(f.required ? { required: true } : {}),
        ...(f.options ? { options: f.options } : {}),
      }))
    }))
  }, null, 2);

  return (
    <div className="schema-editor">
      <div className="se-main">
        <h1>
          <span className="se-glyph" style={{ background: template.color }}>{template.glyph}</span>
          {template.name}
          <span style={{ fontFamily: "var(--f-mono)", fontSize: 13, color: "var(--ink-3)", marginLeft: 12, fontWeight: 400 }}>
            {t("te.title")} · {t("templates.version", template.version)} · {t("templates.fields", totalFields)}
          </span>
          {template.builtIn && (
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-3)", marginLeft: 8,
                          border: "1px solid var(--ink-4)", borderRadius: 3, padding: "2px 5px", fontWeight: 400 }}>
              {t("te.builtin")}
            </span>
          )}
        </h1>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 20 }}>
          {t("te.builtinNote")}
        </div>

        <div style={{ marginBottom: 20, padding: "10px 14px", background: "var(--paper-2)",
                      border: "1px solid var(--rule)", borderRadius: "var(--r-md)", fontSize: 12, color: "var(--ink-3)" }}>
          {t("te.types.head")}：
          <span style={{ fontFamily: "var(--f-mono)", color: "var(--ink-2)" }}> {FIELD_TYPES.join(" / ")}</span>
          <br />
          <span style={{ fontSize: 11, marginTop: 3, display: "block" }}>{t("te.types.note")}</span>
        </div>

        <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.14em",
                      textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>
          {t("te.three")}
        </div>

        {template.levels.map((layer, i) => (
          <TemplateLayerSection key={layer.level} layer={layer}
            levelLabel={`L${layer.level}`} subtitle={subtitles[i]} />
        ))}

        <div style={{ marginTop: 24, padding: "14px 0", borderTop: "1px solid var(--rule)" }}>
          <div style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.14em",
                        textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
            {t("te.lazy")}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 10 }}>
            {t("te.lazyNote")}
          </div>
          <button className="chip">
            <span dangerouslySetInnerHTML={{ __html: window.Icons.refresh }} style={{ marginRight: 6 }} />
            {t("te.upgrade")}
          </button>
        </div>

        <div style={{ marginTop: 20, padding: "14px 0", borderTop: "1px solid var(--rule)" }}>
          <button className="chip" style={{ color: "var(--red, #c44)" }}>
            <span dangerouslySetInnerHTML={{ __html: window.Icons.trash }} style={{ marginRight: 6 }} />
            {t("te.delete")}
          </button>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>{t("te.deleteNote")}</div>
        </div>
      </div>

      <div className="se-side">
        <h3>{t("te.versions")}</h3>
        <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 6 }}>
          {t("te.versionsNote")}
        </div>
        <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-3)" }}>
          {t("templates.version", template.version)} · 当前
        </div>

        <h3 style={{ marginTop: 18 }}>{t("te.bound")}</h3>
        <div style={{ fontFamily: "var(--f-mono)", fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.8 }}>
          {t("te.bindings", template.usedBy)}
        </div>

        <h3 style={{ marginTop: 18 }}>{t("te.preview")}</h3>
        <pre style={{ fontSize: 10.5, color: "var(--ink-2)", background: "var(--paper-2)",
                      border: "1px solid var(--rule)", borderRadius: "var(--r-md)",
                      padding: "8px 10px", overflow: "auto", maxHeight: 280, lineHeight: 1.5,
                      fontFamily: "var(--f-mono)" }}>
          {jsonPreview}
        </pre>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Welcome screen — base-oriented
// ─────────────────────────────────────────────
function Welcome({ onOpenDoc, onOpenCmd, onOpenWorkspace, onNewTemplate, onNewNode }) {
  window.useLang();
  const recentFiles = [
    { name: "实验1.md", meta: "实验记录 (L3) · 2 分钟前", id: "doc-exp1" },
    { name: "Survey 笔记.md", meta: "文献 (L3) · 昨天", id: "doc-survey-notes" },
    { name: "任务说明.md", meta: "三档降级 (L3) · 周日", id: "doc-tier" },
  ];
  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div>
          <div className="w-brand">{t("welcome.brand")}</div>
          <div className="w-tag">{t("brand.subtitle")} · v0.1.0</div>
          <div className="w-desc">{t("brand.welcome.desc")}</div>
          <div style={{ marginTop: 24, display: "flex", gap: 6, alignItems: "center", color: "var(--ink-3)", fontSize: 12, fontFamily: "var(--f-mono)" }}>
            <span dangerouslySetInnerHTML={{ __html: window.Icons.cloud }}></span>
            {t("brand.workspace.summary", 32)}
          </div>
        </div>
        <div className="welcome-cards">
          {recentFiles.map((r, i) => (
            <div className="welcome-card" key={i} onClick={() => onOpenDoc?.({ id: r.id, name: r.name })}>
              <div className="wc-icon" dangerouslySetInnerHTML={{ __html: window.Icons.doc }}></div>
              <div style={{ flex: 1 }}>
                <div className="wc-title">{r.name}</div>
                <div className="wc-meta">{r.meta}</div>
              </div>
            </div>
          ))}
          <div className="welcome-card" onClick={onOpenCmd}>
            <div className="wc-icon" dangerouslySetInnerHTML={{ __html: window.Icons.search }}></div>
            <div style={{ flex: 1 }}>
              <div className="wc-title">{t("welcome.cmd")}</div>
              <div className="wc-meta">{t("welcome.cmd.meta")}</div>
            </div>
            <kbd>⌘K</kbd>
          </div>
          <div className="welcome-card" onClick={onOpenWorkspace}>
            <div className="wc-icon" dangerouslySetInnerHTML={{ __html: window.Icons.folder }}></div>
            <div style={{ flex: 1 }}>
              <div className="wc-title">{t("welcome.openWs")}</div>
              <div className="wc-meta">{t("welcome.openWs.meta")}</div>
            </div>
          </div>
          <div className="welcome-card" onClick={onNewTemplate}>
            <div className="wc-icon" dangerouslySetInnerHTML={{ __html: window.Icons.template }}></div>
            <div style={{ flex: 1 }}>
              <div className="wc-title">{t("welcome.newTemplate")}</div>
              <div className="wc-meta">{t("welcome.newTemplate.meta")}</div>
            </div>
          </div>
          <div className="welcome-card" onClick={onNewNode}>
            <div className="wc-icon" dangerouslySetInnerHTML={{ __html: window.Icons.newfile }}></div>
            <div style={{ flex: 1 }}>
              <div className="wc-title">{t("welcome.newNode")}</div>
              <div className="wc-meta">{t("welcome.newNode.meta")}</div>
            </div>
            <kbd>⌘N</kbd>
          </div>
        </div>
        <div style={{ marginTop: 20, fontSize: 11.5, color: "var(--ink-4)", lineHeight: 1.6, fontFamily: "var(--f-mono)" }}>
          {t("welcome.principle")}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CommandPalette, TemplateEditor, Welcome });
