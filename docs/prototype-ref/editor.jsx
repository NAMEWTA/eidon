/* ============================================================
   EIDON — Editor surface
   - TabBar (tabs + tools)
   - Breadcrumbs (node path + tier badge + stats)
   - EditorArea (gutter + markdown body)
   - Minimap
   ============================================================ */

function TabBar({ tabs, activeId, onActivate, onClose, onSplit, onCommand }) {
  window.useLang();
  return (
    <div className="tabbar">
      {tabs.map(tab => (
        <div key={tab.id} className="tab"
             data-active={tab.id === activeId}
             data-modified={tab.modified}
             onClick={() => onActivate(tab.id)}>
          {tab.pinned && <span className="t-pin" dangerouslySetInnerHTML={{ __html: window.Icons.pin }}></span>}
          <span className="t-icon" dangerouslySetInnerHTML={{ __html: window.Icons.doc }}></span>
          <span className="t-name">{tab.name}</span>
          <button className="t-close"
                  onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                  dangerouslySetInnerHTML={{ __html: window.Icons.close }}></button>
        </div>
      ))}
      <div className="tab-add" title={t("tip.cmd")} onClick={() => onCommand?.()}>
        <span dangerouslySetInnerHTML={{ __html: window.Icons.plus }}></span>
      </div>
      <div className="tab-spacer"></div>
      <div className="tabbar-tools">
        <button className="icon-btn" title={t("tip.split")} onClick={onSplit}>
          <span dangerouslySetInnerHTML={{ __html: window.Icons.split }}></span>
        </button>
        <button className="icon-btn" title={t("tip.cmd")} onClick={onCommand}>
          <span dangerouslySetInnerHTML={{ __html: window.Icons.more }}></span>
        </button>
      </div>
    </div>
  );
}

// Editor tier badge — fluent / bigFile / readOnly (ADR-013，与计划 T-14.* 命名一致)
function TierBadge({ tier }) {
  window.useLang();
  if (tier === "fluent") return null;
  const label = tier === "bigFile" ? t("br.modeBig") : t("br.modeReadOnly");
  const color  = tier === "bigFile" ? "var(--clay)" : "var(--red, #c44)";
  return (
    <span style={{
      fontFamily: "var(--f-mono)", fontSize: 10, color,
      border: `1px solid ${color}`, borderRadius: 3, padding: "1px 5px", marginLeft: 6,
    }}>
      {label}
    </span>
  );
}

function Breadcrumbs({ path, editorTier, wordCount, headingCount, modifiedAt }) {
  window.useLang();
  return (
    <div className="breadcrumbs">
      {path.map((seg, i) => (
        <React.Fragment key={i}>
          <span className={"bc-seg" + (i === path.length - 1 ? " bc-last" : "")}>{seg}</span>
          {i < path.length - 1 && <span className="bc-sep">/</span>}
        </React.Fragment>
      ))}
      <TierBadge tier={editorTier} />
      <span style={{ flex: 1 }}></span>
      <div className="bc-right">
        <span className="bc-stat" title={t("status.saved")}>
          <span dangerouslySetInnerHTML={{ __html: window.Icons.cloud }}></span>
          {t("br.saved", modifiedAt)}
        </span>
        <span className="bc-stat">{t("br.words", wordCount)}</span>
        <span className="bc-stat">{t("br.headings", headingCount)}</span>
      </div>
    </div>
  );
}

// Plain markdown line renderer — no block cards, no structured frontmatter
function renderLine(l, i, activeOutlineId) {
  if (l.kind === "blank") {
    return <div key={i} className="line">&nbsp;</div>;
  }
  // prose / heading
  const headingClass = l.id ? " line-heading" : "";
  const isActive = l.id && l.id === activeOutlineId;
  return (
    <div key={i}
         className={"line eidon-prose" + headingClass + (isActive ? " active" : "")}
         id={l.id || undefined}
         dangerouslySetInnerHTML={{ __html: l.html }}>
    </div>
  );
}

function EditorArea({ doc, splitOpen, onCloseSplit, activeOutlineId, showMinimap }) {
  return (
    <div className="editor-host">
      <div className="editor-pane">
        <div className="editor-scroll">
          <div className="gutter">
            {doc.lines.map((l, i) => {
              const active = l.id && l.id === activeOutlineId;
              return (
                <div key={i} className={"ln" + (active ? " active" : "")}>{i + 1}</div>
              );
            })}
          </div>
          <div className="editor-body eidon-doc">
            {doc.lines.map((l, i) => renderLine(l, i, activeOutlineId))}
          </div>
        </div>
      </div>
      {splitOpen && (
        <div className="editor-pane">
          <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--rule)", background: "var(--paper-2)",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-3)" }}>
            <span>小样本学习 / 文献 / Survey 笔记.md</span>
            <button className="icon-btn" onClick={onCloseSplit} title={t("tip.closeSplit")}
                    style={{ width: 22, height: 22, borderRadius: 4, color: "var(--ink-3)" }}
                    dangerouslySetInnerHTML={{ __html: window.Icons.close }}></button>
          </div>
          <SplitDocContent />
        </div>
      )}
      {showMinimap && !splitOpen && <Minimap doc={doc} />}
    </div>
  );
}

function SplitDocContent() {
  // Alternative plain-Markdown document: Survey notes (no schema frontmatter, no block cards)
  const lines = [
    { kind: "prose", html: `<h1 id="h1">Survey 笔记 · Knowledge Graph 综述</h1>`, id: "h1" },
    { kind: "blank" },
    { kind: "prose", html: `<p style="font-family:var(--f-mono); font-size: var(--font-mono); color: var(--ink-3)">— 创建于 2026-04-18，L3 节点：文献（小样本学习 / 文献）</p>` },
    { kind: "blank" },
    { kind: "blank" },
    { kind: "prose", html: `<h2 id="h2-1">1. 三元组基础</h2>`, id: "h2-1" },
    { kind: "prose", html: `<p>主–谓–宾。使知识图谱可查询的原子结构。RDF 在 1999 年将其规范化；代价是每个事实必须分解为三元。</p>` },
    { kind: "blank" },
    { kind: "prose", html: `<blockquote>"A graph is a database with the schema pushed into the data."</blockquote>` },
    { kind: "blank" },
    { kind: "prose", html: `<h2 id="h2-2">2. 类型化图</h2>`, id: "h2-2" },
    { kind: "prose", html: `<p>属性图（Neo4j）与类型化 RDF（RDFS, OWL）。权衡：查询能力 vs. 创作摩擦。EIDON 处于<em>宽松</em>一端——模板描述，不做门控。</p>` },
    { kind: "blank" },
    { kind: "prose", html: `<h2 id="h2-3">3. 创作难题</h2>`, id: "h2-3" },
    { kind: "prose", html: `<p>难点不在存储，在<em>捕获</em>。三元组仓库为机器设计；人类一周内就会放弃。有趣的设计（Obsidian, Anytype, Logseq）都模糊了散文与结构的边界。</p>` },
    { kind: "blank" },
    { kind: "prose", html: `<p>参见 <em>Seeing Like a State</em> §metis 一节。</p>` },
  ];
  return (
    <div className="editor-scroll" style={{ flex: 1 }}>
      <div className="gutter">
        {lines.map((l, i) => <div key={i} className="ln">{i + 1}</div>)}
      </div>
      <div className="editor-body eidon-doc">
        {lines.map((l, i) => renderLine(l, i, null))}
      </div>
    </div>
  );
}

function Minimap({ doc }) {
  return (
    <div className="minimap">
      <div className="mm-viewport" style={{ top: 70 }}></div>
      {doc.lines.map((l, i) => {
        if (l.kind === "blank") return <div key={i} style={{ height: 4 }}></div>;
        let cls = "mm-line";
        if (l.id) cls += " heading";
        const width = l.id ? "40%" : (50 + (i * 7) % 50) + "%";
        return <div key={i} className={cls} style={{ width }}></div>;
      })}
    </div>
  );
}

Object.assign(window, { TabBar, Breadcrumbs, EditorArea });
