/* ============================================================
   EIDON — Settings page (rendered in the main pane)
   Driven by category id from the LeftPane settings list.
   Categories: editor / appearance / workspace / snapshots / cleanup / keymap / lang / about
   ============================================================ */

function SettingsPage({ catId, tw, setTweak }) {
  window.useLang();
  const cat = window.SettingsCategories.find(c => c.id === catId) || window.SettingsCategories[0];
  return (
    <div className="settings-page">
      <div className="sp-main">
        <div className="sp-head">
          <span className="sp-glyph" dangerouslySetInnerHTML={{ __html: window.Icons[cat.icon] || window.Icons.doc }}></span>
          <h1>{t(cat.key)}</h1>
        </div>
        <p className="sp-sub">{t("settings.subtitle." + cat.id)}</p>

        <div className="sp-body">
          {cat.id === "editor"     && <EditorSettings tw={tw} setTweak={setTweak} />}
          {cat.id === "appearance" && <AppearanceSettings tw={tw} setTweak={setTweak} />}
          {cat.id === "workspace"  && <WorkspaceSettings />}
          {cat.id === "snapshots"  && <SnapshotsSettings />}
          {cat.id === "cleanup"    && <CleanupSettings />}
          {cat.id === "keymap"     && <KeymapSettings />}
          {cat.id === "lang"       && <LangSettings tw={tw} setTweak={setTweak} />}
          {cat.id === "about"      && <AboutSettings />}
        </div>
      </div>
    </div>
  );
}

// ── Generic row primitives ──
function SpSection({ title, children }) {
  return (
    <section className="sp-section">
      <h3>{title}</h3>
      <div className="sp-rows">{children}</div>
    </section>
  );
}
function SpRow({ k, v, hint, kind, onChange, options, value, min, max, step, unit }) {
  return (
    <div className="sp-row">
      <div className="sp-row-l">
        <div className="sp-key">{k}</div>
        {hint && <div className="sp-hint">{hint}</div>}
      </div>
      <div className="sp-row-r">
        {kind === "toggle" && (
          <button className="toggle" data-on={!!value} onClick={() => onChange?.(!value)}></button>
        )}
        {kind === "text" && (
          <input className="sp-input" value={value || ""} onChange={e => onChange?.(e.target.value)} />
        )}
        {kind === "number" && (
          <input className="sp-input sp-num" type="number" min={min} max={max} step={step}
                 value={value || 0} onChange={e => onChange?.(Number(e.target.value))} />
        )}
        {kind === "select" && (
          <select className="sp-select" value={value} onChange={e => onChange?.(e.target.value)}>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {kind === "segmented" && (
          <div className="sp-segmented">
            {options.map(o => (
              <button key={o.value} data-active={value === o.value}
                      onClick={() => onChange?.(o.value)}>{o.label}</button>
            ))}
          </div>
        )}
        {kind === "slider" && (
          <div className="sp-slider">
            <input type="range" min={min} max={max} step={step}
                   value={value} onChange={e => onChange?.(Number(e.target.value))} />
            <span className="sp-slider-val">{value}{unit || ""}</span>
          </div>
        )}
        {kind === "static" && <span className="sp-static">{v}</span>}
      </div>
    </div>
  );
}

// ── Editor ──
function EditorSettings({ tw, setTweak }) {
  const [s, setS] = React.useState({
    fontSize: 13, lineHeight: 22, wordWrap: true, vim: false, autosave: true,
    tabSize: 2, gutter: true, fluentMax: 2, bigMax: 10,
  });
  const set = (k) => (v) => setS(prev => ({ ...prev, [k]: v }));
  return (
    <>
      <SpSection title={t("settings.section.editor")}>
        <SpRow k={t("settings.k.fontSize")}    kind="slider" value={s.fontSize}    onChange={set("fontSize")}    min={11} max={20} step={1} unit="px" />
        <SpRow k={t("settings.k.lineHeight")}  kind="slider" value={s.lineHeight}  onChange={set("lineHeight")}  min={18} max={32} step={1} unit="px" />
        <SpRow k={t("settings.k.tabSize")}     kind="number" value={s.tabSize}     onChange={set("tabSize")}     min={1} max={8} />
        <SpRow k={t("settings.k.wordWrap")}    kind="toggle" value={s.wordWrap}    onChange={set("wordWrap")} />
        <SpRow k={t("settings.k.vim")}         kind="toggle" value={s.vim}         onChange={set("vim")} hint="Vim 操作模式 / Vim-style modal editing" />
        <SpRow k={t("settings.k.autosave")}    kind="toggle" value={s.autosave}    onChange={set("autosave")} />
        <SpRow k={t("settings.k.minimap")}     kind="toggle" value={tw.showMinimap} onChange={(v) => setTweak("showMinimap", v)} />
        <SpRow k={t("settings.k.gutter")}      kind="toggle" value={s.gutter}      onChange={set("gutter")} />
      </SpSection>
      <SpSection title="三档降级阈值（ADR-013）">
        <SpRow k={t("settings.k.fluentMax")}  kind="slider" value={s.fluentMax}  onChange={set("fluentMax")}  min={1} max={10} step={1} unit=" MB" />
        <SpRow k={t("settings.k.bigMax")}     kind="slider" value={s.bigMax}     onChange={set("bigMax")}     min={5} max={50} step={5} unit=" MB"
               hint={t("settings.k.readOnlyHint")} />
      </SpSection>
    </>
  );
}

// ── Appearance ──
function AppearanceSettings({ tw, setTweak }) {
  return (
    <SpSection title={t("settings.section.appearance")}>
      <SpRow k={t("settings.k.theme")} kind="segmented" value="light"
        options={[{value:"light",label:"亮色 / Light"},{value:"dark",label:"暗色 / Dark"},{value:"auto",label:"跟随系统"}]}
        onChange={() => {}} />
      <SpRow k={t("settings.k.accent")}   kind="static" v={tw.accent} hint="在右下角 Tweaks 中切换" />
      <SpRow k={t("settings.k.density")}  kind="segmented" value={tw.density}
        options={[{value:"compact",label:t("tw.density.compact")},{value:"normal",label:t("tw.density.normal")},{value:"comfy",label:t("tw.density.comfy")}]}
        onChange={(v) => setTweak("density", v)} />
      <SpRow k={t("settings.k.radius")}   kind="segmented" value={tw.radius}
        options={[{value:"sharp",label:t("tw.radius.sharp")},{value:"soft",label:t("tw.radius.soft")},{value:"round",label:t("tw.radius.round")}]}
        onChange={(v) => setTweak("radius", v)} />
      <SpRow k={t("settings.k.uiFont")}   kind="select" value={tw.uiFont}
        options={[{value:"IBM Plex Sans",label:"IBM Plex Sans"},{value:"Geist",label:"Geist"},{value:"Inter",label:"Inter"}]}
        onChange={(v) => setTweak("uiFont", v)} />
      <SpRow k={t("settings.k.proseFont")} kind="select" value={tw.proseFont}
        options={[{value:"Instrument Serif",label:"Instrument Serif"},{value:"Newsreader",label:"Newsreader"},{value:"Fraunces",label:"Fraunces"}]}
        onChange={(v) => setTweak("proseFont", v)} />
      <SpRow k={t("settings.k.monoFont")} kind="select" value={tw.monoFont}
        options={[{value:"IBM Plex Mono",label:"IBM Plex Mono"},{value:"JetBrains Mono",label:"JetBrains Mono"},{value:"Fira Code",label:"Fira Code"}]}
        onChange={(v) => setTweak("monoFont", v)} />
    </SpSection>
  );
}

// ── Workspace ──
function WorkspaceSettings() {
  const [openOnStart, setOpenOnStart] = React.useState(true);
  return (
    <>
      <SpSection title={t("settings.section.workspace")}>
        <SpRow k={t("settings.k.location")} kind="static" v={t("brand.path.workspace")} />
        <SpRow k={t("settings.k.openOnStart")} kind="toggle" value={openOnStart} onChange={setOpenOnStart} />
      </SpSection>
      <SpSection title={t("settings.k.recent")}>
        <div style={{ padding: "0 0 8px" }}>
          {window.RecentWorkspaces.map((ws, i) => (
            <div className="sp-row" key={i} style={{ alignItems: "flex-start" }}>
              <div className="sp-row-l">
                <div className="sp-key" style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>{ws.path}</div>
                <div className="sp-hint">{t("brand.workspace.summary", ws.nodes)} · {ws.lastOpened}</div>
              </div>
              <div className="sp-row-r">
                {ws.active
                  ? <span className="sp-static" style={{ color: "var(--accent)" }}>当前</span>
                  : <button className="chip">{t("tip.openWorkspace")}</button>
                }
              </div>
            </div>
          ))}
        </div>
      </SpSection>
    </>
  );
}

// ── Snapshots ──
function SnapshotsSettings() {
  const [s, setS] = React.useState({ interval: 300, binary: false, gc: true });
  const set = (k) => (v) => setS(prev => ({ ...prev, [k]: v }));
  return (
    <SpSection title={t("settings.section.snapshots")}>
      <SpRow k={t("settings.k.snapshotInterval")} kind="slider" value={s.interval} onChange={set("interval")} min={30} max={3600} step={30} unit=" s"
             hint="失焦、切文件、显式 ⌘S 均会在此间隔后触发稳定点快照（autosave 仅落盘不 commit）。" />
      <SpRow k={t("settings.k.snapshotBinary")}   kind="toggle" value={s.binary}   onChange={set("binary")} hint="PNG / PDF 等二进制文件纳入 .eidon/snapshots.git（会增大仓库体积）。" />
      <SpRow k={t("settings.k.snapshotGc")}        kind="toggle" value={s.gc}       onChange={set("gc")} />
    </SpSection>
  );
}

// ── Cleanup ──
function CleanupSettings() {
  const [autoTidy, setAutoTidy] = React.useState(false);
  return (
    <SpSection title={t("settings.section.cleanup")}>
      <SpRow k={t("settings.k.autoTidy")} kind="toggle" value={autoTidy} onChange={setAutoTidy}
             hint={t("settings.k.autoTidyHint")} />
    </SpSection>
  );
}

// ── Keymap ──
function KeymapSettings() {
  const keys = [
    { k: "命令面板 / Command palette",     v: "⌘K" },
    { k: "快速打开 / Quick open",          v: "⌘P" },
    { k: "分屏 / Split editor",            v: "⌘\\" },
    { k: "创建版本快照 / Snapshot",        v: "⌘S" },
    { k: "全局搜索 / Find in workspace",   v: "⌘⇧F" },
    { k: "新建 L1 节点 / New L1 node",     v: "⌘N" },
    { k: "打开一致性面板 / Consistency",   v: "⌘⇧C" },
  ];
  return (
    <SpSection title={t("settings.section.keymap")}>
      {keys.map((row, i) => (
        <div className="sp-row" key={i}>
          <div className="sp-row-l"><div className="sp-key">{row.k}</div></div>
          <div className="sp-row-r"><kbd className="sp-kbd">{row.v}</kbd></div>
        </div>
      ))}
    </SpSection>
  );
}

// ── Language ──
function LangSettings({ tw, setTweak }) {
  return (
    <SpSection title={t("settings.section.lang")}>
      <SpRow k={t("settings.k.lang")} kind="segmented" value={tw.lang}
        options={[{value:"zh",label:"中文"},{value:"en",label:"English"}]}
        onChange={(v) => setTweak("lang", v)} />
      <SpRow k={t("settings.k.region")} kind="select" value="zh-CN"
        options={[{value:"zh-CN",label:"中国大陆 (zh-CN)"},{value:"zh-TW",label:"台灣 (zh-TW)"},{value:"en-US",label:"United States (en-US)"},{value:"en-GB",label:"United Kingdom (en-GB)"}]}
        onChange={() => {}} />
      <SpRow k={t("settings.k.firstDay")} kind="segmented" value="mon"
        options={[{value:"sun",label:"周日"},{value:"mon",label:"周一"}]}
        onChange={() => {}} />
    </SpSection>
  );
}

// ── About ──
function AboutSettings() {
  return (
    <div className="sp-about">
      <div className="sp-about-brand">EIDON</div>
      <div className="sp-about-tag">{t("brand.subtitle")}</div>
      <div className="sp-about-grid">
        <div><span>{t("settings.k.version")}</span><b>0.1.0 · 基座</b></div>
        <div><span>{t("settings.k.build")}</span><b>2026.05.27 · step1</b></div>
        <div><span>{t("settings.k.platform")}</span><b>macOS 15 · arm64</b></div>
        <div><span>{t("settings.k.license")}</span><b>EIDON Personal · 永久</b></div>
      </div>
      <div style={{ padding: "12px 0 4px", fontSize: 12, color: "var(--ink-3)", lineHeight: 1.6 }}>
        {t("brand.welcome.desc")}
      </div>
      <div className="sp-about-foot">
        © 2025–2026 EIDON · Local-First Structured Knowledge IDE
      </div>
    </div>
  );
}

Object.assign(window, { SettingsPage });
