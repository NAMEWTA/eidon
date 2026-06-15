/* ============================================================
   EIDON — Right drawer
   Single panel; which feature is shown is driven by the
   right ActivityBar. No internal tab strip.
   ============================================================ */

function RightDrawer({ view, doc, onClose, onActiveOutline }) {
  window.useLang();
  if (!view) return null;
  const iconMap   = { outline: "outline", fields: "fields", history: "history" };
  const titleMap  = { outline: "right.outline", fields: "right.fields", history: "right.history" };
  return (
    <div className="rightdrawer">
      <div className="rd-header">
        <span className="rd-icon" dangerouslySetInnerHTML={{ __html: window.Icons[iconMap[view]] }}></span>
        <span className="rd-title">{t(titleMap[view])}</span>
        <button className="icon-btn" onClick={onClose} title={t("common.close")}
                style={{ width: 22, height: 22, color: "var(--ink-3)", marginLeft: "auto" }}
                dangerouslySetInnerHTML={{ __html: window.Icons.close }}></button>
      </div>
      <div className="rp-body">
        {view === "outline" && <OutlinePanel doc={doc} onActive={onActiveOutline} />}
        {view === "fields"  && <FieldsPanel doc={doc} />}
        {view === "history" && <HistoryPanel />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Outline
// ─────────────────────────────────────────────
function OutlinePanel({ doc, onActive }) {
  window.useLang();
  const headings = doc.outline || [];
  return (
    <>
      <div className="pane-header">
        <div className="pane-title">{t("outline.title")}</div>
        <div className="pane-actions">
          <button className="icon-btn" title={t("tip.headingsOnly")} dangerouslySetInnerHTML={{ __html: window.Icons.outline }}></button>
        </div>
      </div>
      {headings.length === 0 && (
        <div style={{ padding: "14px 14px", color: "var(--ink-3)", fontSize: 12 }}>{t("outline.empty")}</div>
      )}
      <div className="outline">
        {headings.map(h => (
          <div key={h.id} className="outline-row"
               data-active={h.active}
               style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
               onClick={() => onActive?.(h.id)}>
            <span className="or-tier">{`H${h.level}`}</span>
            <span style={{ flex: 1, fontFamily: h.level === 1 ? "var(--f-serif)" : "inherit", fontSize: h.level === 1 ? 15 : 13 }}>{h.text}</span>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 10.5, color: "var(--ink-4)" }}>L{h.line}</span>
          </div>
        ))}
      </div>
      <div className="tree-section"><span>{t("outline.wordcount")}</span></div>
      <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "1fr auto", gap: 4, fontSize: 12, color: "var(--ink-2)" }}>
        <span>{t("outline.prose")}</span>
        <span style={{ fontFamily: "var(--f-mono)", color: "var(--ink)" }}>{(doc.wordCount || 0).toLocaleString()}</span>
        <span>{t("outline.headings")}</span>
        <span style={{ fontFamily: "var(--f-mono)", color: "var(--ink)" }}>{doc.headingCount || 0}</span>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Node fields panel (replaces Properties)
// ─────────────────────────────────────────────
function fieldTypeIcon(type) {
  const icons = { text: "T", textarea: "¶", number: "#", select: "▾", boolean: "◉", date: "⌚" };
  return <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, width: 12, textAlign: "center" }}>{icons[type] || "·"}</span>;
}

function fieldTypeColor(type) {
  return {
    text:     "var(--ink-3)",
    textarea: "var(--ink-3)",
    number:   "var(--syn-num)",
    select:   "var(--syn-fn)",
    boolean:  "var(--sage)",
    date:     "var(--syn-fn)",
  }[type] || "var(--ink-3)";
}

function FieldValue({ field }) {
  const { type, value, options } = field;
  if (type === "text" || type === "textarea")
    return <span className="editable">{value}</span>;
  if (type === "number")
    return <span className="editable cell-num">{value}</span>;
  if (type === "boolean")
    return <span className="editable">{value ? "是" : "否"}</span>;
  if (type === "date")
    return <span className="editable cell-date">{value}</span>;
  if (type === "select")
    return (
      <span className="editable" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span style={{ width: 7, height: 7, borderRadius: 3, background: "var(--sage)" }}></span>
        {value}
      </span>
    );
  return <span>{String(value)}</span>;
}

function FieldsPanel({ doc }) {
  window.useLang();
  const node = doc?.node;

  if (!node) {
    return (
      <div style={{ padding: "14px", color: "var(--ink-3)", fontSize: 12 }}>
        {t("fields.notNode")}
      </div>
    );
  }

  const needsUpgrade = node.schemaVersion < node.latestSchemaVersion;

  return (
    <>
      <div className="pane-header">
        <div className="pane-title">{t("fields.title")}</div>
        <div className="pane-actions">
          <span style={{ fontSize: 10.5, color: "var(--ink-3)", fontFamily: "var(--f-mono)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="sc-glyph" style={{ background: "oklch(0.55 0.13 30)", width: 14, height: 14, borderRadius: 3, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 10 }}>
              {node.templateName?.[0] || "·"}
            </span>
            {node.templateName}
          </span>
        </div>
      </div>

      {/* Node identity */}
      <div className="props" style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 6, marginBottom: 4 }}>
        <div className="prop-row">
          <span className="pr-key" style={{ color: "var(--ink-3)" }}>{t("fields.template")}</span>
          <span className="pr-val" style={{ fontFamily: "var(--f-mono)", fontSize: 11 }}>{node.templateName}</span>
        </div>
        <div className="prop-row">
          <span className="pr-key" style={{ color: "var(--ink-3)" }}>{t("fields.level")}</span>
          <span className="pr-val" style={{ fontFamily: "var(--f-mono)", fontSize: 11 }}>L{node.level} · {node.type}</span>
        </div>
        <div className="prop-row">
          <span className="pr-key" style={{ color: "var(--ink-3)" }}>{t("fields.schemaVersion")}</span>
          <span className="pr-val" style={{ fontFamily: "var(--f-mono)", fontSize: 11 }}>v{node.schemaVersion}</span>
        </div>
      </div>

      {/* Warnings */}
      {node.orphanTemplate && (
        <div style={{ margin: "4px 10px 8px", padding: "6px 8px", background: "oklch(0.97 0.02 50)",
                      border: "1px solid oklch(0.85 0.06 50)", borderRadius: "var(--r-md)",
                      fontSize: 11.5, color: "oklch(0.45 0.10 50)", lineHeight: 1.5 }}>
          {t("fields.orphanTemplate")}
        </div>
      )}
      {needsUpgrade && (
        <div style={{ margin: "4px 10px 8px", padding: "6px 8px", background: "var(--paper-2)",
                      border: "1px solid var(--rule)", borderRadius: "var(--r-md)", fontSize: 11.5, color: "var(--ink-2)" }}>
          <div>{t("fields.upgrade")}</div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 3 }}>{t("fields.upgradeHint")}</div>
        </div>
      )}

      {/* Field values */}
      <div className="props">
        {Object.entries(node.fields).map(([k, v]) => (
          <div className="prop-row" key={k}>
            <span className="pr-key">
              <span style={{ color: fieldTypeColor(v.type), display: "inline-flex" }}>{fieldTypeIcon(v.type)}</span>
              {k}
            </span>
            <span className="pr-val"><FieldValue field={v} /></span>
          </div>
        ))}
      </div>

      {/* Node file links */}
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
        <button className="chip" style={{ justifyContent: "flex-start", gap: 6 }}>
          <span dangerouslySetInnerHTML={{ __html: window.Icons.pen }}></span>
          {t("fields.editReadme")}
        </button>
        <button className="chip" style={{ justifyContent: "flex-start", gap: 6, opacity: 0.5 }}>
          <span dangerouslySetInnerHTML={{ __html: window.Icons.doc }}></span>
          {t("fields.viewAgents")}
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// History
// ─────────────────────────────────────────────
function HistoryPanel() {
  window.useLang();
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [filter, setFilter] = React.useState("all");
  const entries = window.History.filter(h =>
    filter === "all" || h.kind === filter.replace("snaps", "snap").replace("edits", "edit")
  );
  return (
    <>
      <div className="pane-header">
        <div className="pane-title">{t("history.title")}</div>
        <div className="pane-actions">
          <button className="chip" data-on={filter === "all"}   onClick={() => setFilter("all")}>{t("history.all")}</button>
          <button className="chip" data-on={filter === "edits"} onClick={() => setFilter("edits")}>{t("history.edits")}</button>
          <button className="chip" data-on={filter === "snaps"} onClick={() => setFilter("snaps")}>{t("history.snaps")}</button>
        </div>
      </div>
      {entries.length === 0 && (
        <div style={{ padding: "14px", color: "var(--ink-3)", fontSize: 12 }}>{t("history.empty")}</div>
      )}
      <div className="history-list">
        <div style={{ position: "relative" }}>
          {entries.map((h, i) => (
            <div className="hist" key={i} data-kind={h.kind} data-active={i === activeIdx}
                 onClick={() => setActiveIdx(i)}>
              <span className="h-time">{h.time}</span>
              <span className="h-dot"></span>
              <span className="h-line"></span>
              <span className="h-body">
                <span className="h-msg">{h.msg}</span>
                <span className="h-meta">{h.meta}</span>
              </span>
            </div>
          ))}
        </div>
        {entries.length > 0 && (
          <>
            <div style={{ margin: "10px 8px 0", padding: "8px 10px", background: "var(--paper-2)",
                          border: "1px solid var(--rule)", borderRadius: "var(--r-md)" }}>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.14em",
                            textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>
                {t("history.diff")}
              </div>
              <div className="diff-line"><span className="dl-num">30</span><span>5 次种子的平均准确率为</span></div>
              <div className="diff-line del"><span className="dl-num">31</span><span>49.1% ± 0.6%</span></div>
              <div className="diff-line add"><span className="dl-num">31</span><span>49.3% ± 0.6%，与原论文一致。</span></div>
              <div className="diff-line"><span className="dl-num">32</span><span></span></div>
            </div>
            <div style={{ margin: "8px 8px 0", display: "flex", gap: 6 }}>
              <button className="chip" style={{ color: "var(--accent)" }}>
                <span dangerouslySetInnerHTML={{ __html: window.Icons.restore }} style={{ marginRight: 4 }} />
                {t("history.restore")}
              </button>
            </div>
            <div style={{ padding: "4px 10px 10px", fontSize: 11, color: "var(--ink-3)" }}>
              {t("history.restoreNote")}
            </div>
          </>
        )}
      </div>
    </>
  );
}

Object.assign(window, { RightDrawer, OutlinePanel, FieldsPanel, HistoryPanel });
