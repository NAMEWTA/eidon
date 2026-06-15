/* ============================================================
   EIDON — Main App
   ============================================================ */

const { useState, useEffect, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#b8552c",
  "uiFont": "IBM Plex Sans",
  "proseFont": "Instrument Serif",
  "monoFont": "IBM Plex Mono",
  "radius": "soft",
  "density": "normal",
  "leftWidth": 264,
  "rightWidth": 360,
  "showMinimap": true,
  "lang": "zh"
}/*EDITMODE-END*/;

function App() {
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  window.useLang();

  // sync lang tweak → global
  useEffect(() => { window.setLang(tw.lang || "zh"); }, [tw.lang]);

  const [leftView, setLeftView]   = useState("explorer");
  const [rightView, setRightView] = useState(null);

  const [tabs, setTabs] = useState([
    {
      id: "doc-exp1",
      name: "实验1.md",
      path: ["深度学习研究 (L1)", "小样本学习 (L2)", "实验记录 (L3)", "实验1.md"],
      modified: true,
      pinned: true,
      kind: "doc",
    },
    {
      id: "doc-survey-notes",
      name: "Survey 笔记.md",
      path: ["深度学习研究 (L1)", "小样本学习 (L2)", "文献 (L3)", "Survey 笔记.md"],
      kind: "doc",
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("doc-exp1");
  const [splitOpen, setSplitOpen] = useState(false);
  const [activeOutlineId, setActiveOutlineId] = useState("h-run");

  const [cmdOpen, setCmdOpen]             = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [activeSettingsId, setActiveSettingsId] = useState(null);

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // Keyboard ⌘K / ⌘\ / esc
  useEffect(() => {
    function onKey(e) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "k") { e.preventDefault(); setCmdOpen(o => !o); }
      else if (meta && e.key === "\\") { e.preventDefault(); setSplitOpen(s => !s); }
      else if (meta && e.key === "p") { e.preventDefault(); setCmdOpen(true); }
      else if (e.key === "Escape" && cmdOpen) setCmdOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cmdOpen]);

  // File map for opening docs by id
  const FILE_MAP = {
    "doc-exp1":         { name: "实验1.md",       path: ["深度学习研究 (L1)", "小样本学习 (L2)", "实验记录 (L3)", "实验1.md"],     modified: true },
    "doc-exp2":         { name: "实验2.md",        path: ["深度学习研究 (L1)", "小样本学习 (L2)", "实验记录 (L3)", "实验2.md"] },
    "doc-survey":       { name: "Survey.pdf",      path: ["深度学习研究 (L1)", "小样本学习 (L2)", "文献 (L3)", "Survey.pdf"] },
    "doc-survey-notes": { name: "Survey 笔记.md", path: ["深度学习研究 (L1)", "小样本学习 (L2)", "文献 (L3)", "Survey 笔记.md"] },
    "doc-tier":         { name: "任务说明.md",     path: ["EIDON 开发 (L1)", "编辑器 (L2)", "三档降级 (L3)", "任务说明.md"] },
  };

  function openDoc(doc) {
    if (!doc.id) return;
    setActiveTemplateId(null);
    if (!tabs.find(tab => tab.id === doc.id)) {
      const meta = FILE_MAP[doc.id] || { name: doc.name || "Untitled", path: [doc.name || "untitled"] };
      setTabs(prev => [...prev, { id: doc.id, ...meta, kind: "doc" }]);
    }
    setActiveTabId(doc.id);
  }

  function openTemplate(tpl) {
    setActiveTemplateId(tpl.id);
    setActiveSettingsId(null);
    const tabId = `template-${tpl.id}`;
    if (!tabs.find(tab => tab.id === tabId)) {
      setTabs(prev => [...prev, { id: tabId, name: `${tpl.name} · 模板`, path: [t("templates.title"), tpl.name], kind: "template", templateId: tpl.id }]);
    }
    setActiveTabId(tabId);
    setLeftView("templates");
  }

  function openSettings(cat) {
    setActiveSettingsId(cat.id);
    setActiveTemplateId(null);
    const tabId = `settings-${cat.id}`;
    if (!tabs.find(tab => tab.id === tabId)) {
      setTabs(prev => [...prev, { id: tabId, name: `${t(cat.key)} · ${t("settings.title")}`, path: [t("settings.title"), t(cat.key)], kind: "settings", catId: cat.id }]);
    }
    setActiveTabId(tabId);
  }

  function closeTab(id) {
    const idx = tabs.findIndex(tab => tab.id === id);
    const next = tabs.filter(tab => tab.id !== id);
    setTabs(next);
    if (activeTabId === id) {
      setActiveTabId(next.length ? next[Math.max(0, idx - 1)].id : null);
    }
  }

  function toggleRight(id) {
    setRightView(v => (v === id ? null : id));
  }

  const accentOklch = hexAccentToVars(tw.accent);
  const rootStyle = {
    "--clay":       accentOklch.base,
    "--clay-soft":  accentOklch.soft,
    "--clay-ink":   accentOklch.ink,
    "--left-w":     tw.leftWidth + "px",
    "--right-w":    tw.rightWidth + "px",
    "--f-sans":     `"${tw.uiFont}", "Inter", system-ui, sans-serif`,
    "--f-serif":    `"${tw.proseFont}", "Iowan Old Style", Georgia, serif`,
    "--f-mono":     `"${tw.monoFont}", ui-monospace, monospace`,
  };

  const isTemplate = activeTab?.kind === "template";
  const isSettings = activeTab?.kind === "settings";
  const activeTemplate = isTemplate ? window.Templates.find(tpl => tpl.id === activeTab.templateId) : null;

  // Consistency item count for StatusBar
  const ci = window.ConsistencyItems;
  const consistencyCount = Object.values(ci).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="app"
         style={rootStyle}
         data-density={tw.density}
         data-radius={tw.radius === "sharp" ? "sharp" : (tw.radius === "round" ? "round" : null)}
         data-right-open={!!rightView}>

      <div className="titlebar">
        <div className="tb-left">
          <div className="lights"><span></span><span></span><span></span></div>
          <span style={{ fontFamily: "var(--f-mono)", color: "var(--ink-3)" }}>{t("brand.path.workspace")}</span>
          <span className="kbd" style={{ marginLeft: 8 }}>main</span>
        </div>
        <div className="tb-mid">
          <span className="tb-crumb">
            <b>EIDON</b>
            <span style={{ color: "var(--ink-4)" }}>·</span>
            <span>{t("brand.crumb.kind")}</span>
          </span>
        </div>
        <div className="tb-right">
          <button className="icon-btn" title={t("tip.cmd")} onClick={() => setCmdOpen(true)}>
            <span dangerouslySetInnerHTML={{ __html: window.Icons.search }}></span>
          </button>
        </div>
      </div>

      <div className="workbench">
        <ActivityBar active={leftView} onSelect={setLeftView} />
        <LeftPane
          view={leftView}
          activeDocId={activeTabId}
          modifiedIds={new Set(tabs.filter(tab => tab.modified).map(tab => tab.id))}
          onOpenDoc={openDoc}
          activeTemplateId={activeTemplateId}
          onOpenTemplate={openTemplate}
          activeSettingsId={activeSettingsId}
          onOpenSettings={openSettings}
        />

        <div className="mainpane">
          <TabBar
            tabs={tabs}
            activeId={activeTabId}
            onActivate={setActiveTabId}
            onClose={closeTab}
            onSplit={() => setSplitOpen(s => !s)}
            onCommand={() => setCmdOpen(true)}
          />

          {!activeTab && (
            <Welcome
              onOpenDoc={openDoc}
              onOpenCmd={() => setCmdOpen(true)}
              onOpenWorkspace={() => {}}
              onNewTemplate={() => openTemplate(window.Templates[0])}
              onNewNode={() => openDoc({ id: "doc-exp1", name: "实验1.md" })}
            />
          )}

          {activeTab && !isTemplate && !isSettings && (
            <>
              <Breadcrumbs
                path={window.ActiveDoc.path}
                editorTier={window.ActiveDoc.editorTier}
                wordCount={window.ActiveDoc.wordCount}
                headingCount={window.ActiveDoc.headingCount}
                modifiedAt={window.ActiveDoc.modifiedAt}
              />
              <EditorArea
                doc={window.ActiveDoc}
                splitOpen={splitOpen}
                onCloseSplit={() => setSplitOpen(false)}
                activeOutlineId={activeOutlineId}
                showMinimap={tw.showMinimap && !splitOpen}
              />
            </>
          )}

          {activeTab && isTemplate && (
            <TemplateEditor template={activeTemplate} onBack={() => setActiveTabId("doc-exp1")} />
          )}

          {activeTab && isSettings && (
            <SettingsPage catId={activeTab.catId} tw={tw} setTweak={setTweak} />
          )}
        </div>

        {rightView && (
          <RightDrawer
            view={rightView}
            doc={window.ActiveDoc}
            onClose={() => setRightView(null)}
            onActiveOutline={setActiveOutlineId}
          />
        )}

        <RightActivityBar active={rightView} onToggle={toggleRight} />
      </div>

      <StatusBar
        modified={tabs.some(tab => tab.modified)}
        consistencyCount={consistencyCount}
      />

      {cmdOpen && (
        <CommandPalette
          onClose={() => setCmdOpen(false)}
          onPick={(item) => {
            setCmdOpen(false);
            if (!item) return;
            const n = item.name || "";
            if (n.includes("实验1.md"))           openDoc({ id: "doc-exp1" });
            else if (n.includes("Survey 笔记"))   openDoc({ id: "doc-survey-notes" });
            else if (n.includes("任务说明"))       openDoc({ id: "doc-tier" });
            else if (n.includes("模板：科研"))     openTemplate(window.Templates[0]);
            else if (n.includes("新建模板"))       openTemplate(window.Templates[0]);
            else if (n.includes("分屏"))           setSplitOpen(true);
            else if (n.includes("一致性"))        setLeftView("consistency");
          }}
        />
      )}

      <TweaksUI tw={tw} setTweak={setTweak} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Status bar
// ─────────────────────────────────────────────
function StatusBar({ modified, consistencyCount }) {
  window.useLang();
  return (
    <div className="statusbar">
      <span className="sb-item sb-sync"><span className="sb-dot"></span> {t("status.local")}</span>
      <span className="sb-item"><span dangerouslySetInnerHTML={{ __html: window.Icons.branch }}></span> {t("status.branch")}</span>
      <span className="sb-item">{t("status.line")}</span>
      <span className="sb-item">{t("status.encoding")}</span>
      <span className="sb-item">{t("status.version")}</span>
      <span className="sb-spacer"></span>
      <span className="sb-item" style={{ color: consistencyCount > 0 ? "var(--clay)" : "var(--ink-3)" }}>
        {t("status.consistency", consistencyCount)}
      </span>
      <span className="sb-item">{modified ? t("status.unsaved") : t("status.saved")}</span>
      <span className="sb-item">⌘K</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tweaks UI
// ─────────────────────────────────────────────
function TweaksUI({ tw, setTweak }) {
  window.useLang();
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label={t("tw.language") + " / Language"}>
        <TweakRadio label={t("tw.language")} value={tw.lang} onChange={(v) => setTweak("lang", v)}
          options={[{ value: "zh", label: "中文" }, { value: "en", label: "English" }]}
        />
      </TweakSection>

      <TweakSection label={t("tw.theme")}>
        <TweakColor label={t("tw.accent")} value={tw.accent} onChange={(v) => setTweak("accent", v)}
          options={[
            ["#b8552c", "#1a1714", "#faf7f2"],
            ["#7b6a55", "#1a1714", "#faf7f2"],
            ["#5c7d5a", "#1a1714", "#faf7f2"],
            ["#3b6b8a", "#1a1714", "#faf7f2"],
            ["#8b3c4a", "#1a1714", "#faf7f2"],
            ["#6b5e8b", "#1a1714", "#faf7f2"],
          ]}
        />
      </TweakSection>

      <TweakSection label={t("tw.type")}>
        <TweakSelect label={t("tw.uiFont")} value={tw.uiFont} onChange={(v) => setTweak("uiFont", v)}
          options={[
            { value: "IBM Plex Sans",    label: "IBM Plex Sans" },
            { value: "Geist",            label: "Geist" },
            { value: "JetBrains Mono",   label: "JetBrains Mono (mono UI)" },
            { value: "Inter",            label: "Inter" },
          ]}
        />
        <TweakSelect label={t("tw.proseFont")} value={tw.proseFont} onChange={(v) => setTweak("proseFont", v)}
          options={[
            { value: "Instrument Serif", label: "Instrument Serif" },
            { value: "Newsreader",       label: "Newsreader" },
            { value: "Fraunces",         label: "Fraunces" },
            { value: "IBM Plex Sans",    label: "IBM Plex Sans" },
          ]}
        />
        <TweakSelect label={t("tw.monoFont")} value={tw.monoFont} onChange={(v) => setTweak("monoFont", v)}
          options={[
            { value: "IBM Plex Mono",    label: "IBM Plex Mono" },
            { value: "JetBrains Mono",   label: "JetBrains Mono" },
            { value: "Fira Code",        label: "Fira Code" },
          ]}
        />
      </TweakSection>

      <TweakSection label={t("tw.layout")}>
        <TweakRadio label={t("tw.radius")} value={tw.radius} onChange={(v) => setTweak("radius", v)}
          options={[
            { value: "sharp", label: t("tw.radius.sharp") },
            { value: "soft",  label: t("tw.radius.soft") },
            { value: "round", label: t("tw.radius.round") },
          ]}
        />
        <TweakRadio label={t("tw.density")} value={tw.density} onChange={(v) => setTweak("density", v)}
          options={[
            { value: "compact", label: t("tw.density.compact") },
            { value: "normal",  label: t("tw.density.normal") },
            { value: "comfy",   label: t("tw.density.comfy") },
          ]}
        />
        <TweakSlider label={t("tw.leftWidth")} value={tw.leftWidth} onChange={(v) => setTweak("leftWidth", v)}
          min={200} max={420} step={1} unit="px" />
        <TweakToggle label={t("tw.minimap")} value={tw.showMinimap} onChange={(v) => setTweak("showMinimap", v)} />
      </TweakSection>
    </TweaksPanel>
  );
}

// ─────────────────────────────────────────────
// Color helpers
// ─────────────────────────────────────────────
function hexAccentToVars(hex) {
  const { r, g, b } = hexToRgb(hex);
  const hsl = rgbToHsl(r, g, b);
  return {
    base: `oklch(0.62 0.14 ${hsl.h})`,
    soft: `oklch(0.93 0.05 ${hsl.h})`,
    ink:  `oklch(0.42 0.13 ${hsl.h})`,
  };
}
function hexToRgb(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h, s, l = (mx + mn) / 2;
  if (mx === mn) { h = s = 0; }
  else {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    switch (mx) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function mountApp() {
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
}
if (window.Icons) mountApp();
else window.addEventListener("eidon-icons-ready", mountApp, { once: true });
