/* ============================================================
   EIDON 基座 v2 — Settings Page
   自动整理 · 大文件阈值 · Git 快照 · 离线状态 · 内置模板
   ============================================================ */
const { useState: useSetSt } = React;

function SettingRow({ label, desc, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 20, padding: '16px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 }}>{label}</div>
        {desc && <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, paddingTop: 2 }}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange, disabled }) {
  return (
    <div onClick={() => !disabled && onChange(!value)} style={{
      width: 44, height: 24, borderRadius: 12,
      background: value ? 'var(--accent)' : 'var(--border)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      position: 'relative', transition: 'background .2s',
      opacity: disabled ? 0.5 : 1,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: value ? 23 : 3, transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

function SectionTitle({ title }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
      textTransform: 'uppercase', letterSpacing: '0.6px',
      paddingTop: 24, paddingBottom: 8,
      borderBottom: '1px solid var(--border)', marginBottom: 0,
    }}>{title}</div>
  );
}

function SettingsPage() {
  const [autoOrganize, setAutoOrganize] = useSetSt(WorkspaceMeta.autoOrganize);
  const [fluentThreshold, setFluentThreshold] = useSetSt(WorkspaceMeta.largeFileThresholds.fluent);
  const [basicThreshold, setBasicThreshold] = useSetSt(WorkspaceMeta.largeFileThresholds.bigFile);
  const [snapshotsEnabled, setSnapshotsEnabled] = useSetSt(true);
  const [snapshotInterval, setSnapshotInterval] = useSetSt(30);
  const [binarySnapshots, setBinarySnapshots] = useSetSt(false);

  return (
    <div style={{ padding: '28px 36px', maxWidth: 720, margin: '0 auto', overflowY: 'auto' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>设置</h2>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-3)' }}>
        工作区：{WorkspaceMeta.path}
      </p>

      {/* ─ 工作区状态 ─ */}
      <SectionTitle title="工作区状态" />
      <div style={{
        display: 'flex', gap: 12, padding: '14px 0', flexWrap: 'wrap',
        borderBottom: '1px solid var(--border)',
      }}>
        {[
          { label: '已索引文件', value: WorkspaceMeta.filesIndexed, color: 'var(--text-1)' },
          { label: '结构节点', value: WorkspaceMeta.nodesCount, color: 'var(--text-1)' },
          { label: '网络状态', value: WorkspaceMeta.online ? '在线' : '离线', color: WorkspaceMeta.online ? 'var(--success)' : 'oklch(0.65 0.10 55)' },
          { label: '分支', value: WorkspaceMeta.branch, color: 'var(--accent)' },
          { label: '待写入', value: WorkspaceMeta.diskWritesQueued || 0, color: 'var(--text-1)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: '1 1 120px', background: 'var(--surface-2)', borderRadius: 8,
            padding: '10px 14px', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ─ 杂物整理 ─ */}
      <SectionTitle title="杂物整理（ADR-008）" />
      <SettingRow
        label="自动整理杂物"
        desc="开启后，打开工作区时自动把 L1/L2 层中的白名单外文件移入该层的「其他」L3 节点。默认关闭——「落下移动键的必须是你」。即便开启，也只移动不删除，并记入 activity.jsonl。">
        <Toggle value={autoOrganize} onChange={setAutoOrganize} />
      </SettingRow>
      {autoOrganize && (
        <div style={{
          background: 'oklch(0.18 0.05 55)', border: '1px solid oklch(0.35 0.10 55)',
          borderRadius: 7, padding: '10px 14px', margin: '8px 0 0',
          fontSize: 12.5, color: 'oklch(0.65 0.10 55)', lineHeight: 1.6,
        }}>
          ⚡ 自动整理已开启。这是你知情授权的自动化——EIDON 仍不会在你背后静默删除任何文件。
          每次移动均记录在 <code style={{ fontFamily: 'monospace', background: 'oklch(0.22 0.05 55)', padding: '1px 4px', borderRadius: 3 }}>activity.jsonl</code> 中。
        </div>
      )}

      {/* ─ 编辑器大文件策略（ADR-013） ─ */}
      <SectionTitle title="编辑器大文件策略（ADR-013）" />
      <SettingRow
        label="流畅档上限"
        desc="小于此值的文件使用全功能编辑（实时预览 + 高亮 + 快照）。">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" value={fluentThreshold} onChange={e => setFluentThreshold(Number(e.target.value))}
            min={0.5} max={5} step={0.5}
            style={{
              width: 64, background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '5px 8px', color: 'var(--text-1)', fontSize: 13, outline: 'none',
            }} />
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>MB</span>
        </div>
      </SettingRow>
      <SettingRow
        label="大文件档上限"
        desc="介于流畅档和此值之间的文件使用基础编辑（关闭实时预览）。超过此值进入只读档。">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" value={basicThreshold} onChange={e => setBasicThreshold(Number(e.target.value))}
            min={2} max={50} step={1}
            style={{
              width: 64, background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '5px 8px', color: 'var(--text-1)', fontSize: 13, outline: 'none',
            }} />
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>MB</span>
        </div>
      </SettingRow>
      <div style={{
        background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px',
        margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6,
        border: '1px solid var(--border)',
      }}>
        {[
          { label: '流畅档', range: `≤ ${fluentThreshold} MB`, desc: '全功能编辑 + 实时预览 + 快照', color: 'var(--success)' },
          { label: '大文件档', range: `${fluentThreshold}~${basicThreshold} MB`, desc: '基础编辑，关闭实时预览', color: 'var(--warning)' },
          { label: '只读档', range: `> ${basicThreshold} MB`, desc: '虚拟化只读预览，引导外部编辑器', color: 'var(--danger)' },
        ].map(({ label, range, desc, color }) => (
          <div key={label} style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
            <span style={{ color, fontWeight: 600, width: 60, flexShrink: 0 }}>{label}</span>
            <span style={{ color: 'var(--text-2)', width: 100, flexShrink: 0 }}>{range}</span>
            <span>{desc}</span>
          </div>
        ))}
        <div style={{ marginTop: 6, color: 'oklch(0.58 0.08 195)' }}>
          承诺：≥100MB 文件可只读预览不崩溃（放弃"100MB 可编辑"伪目标）
        </div>
      </div>

      {/* ─ 版本快照（ADR-009） ─ */}
      <SectionTitle title="版本快照（ADR-009 · Git-as-Snapshot）" />
      <SettingRow
        label="启用快照"
        desc="快照存于 .eidon/snapshots.git（私有 Git 仓库，不占工作区根 .git/）。可完整删除——只丢历史，当前文件安全。">
        <Toggle value={snapshotsEnabled} onChange={setSnapshotsEnabled} />
      </SettingRow>
      <SettingRow
        label="定时快照间隔"
        desc="内容有变时，每隔此时长触发一次快照 commit（稳定点策略）。">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" value={snapshotInterval} onChange={e => setSnapshotInterval(Number(e.target.value))}
            min={5} max={120} step={5} disabled={!snapshotsEnabled}
            style={{
              width: 64, background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '5px 8px', color: snapshotsEnabled ? 'var(--text-1)' : 'var(--text-3)',
              fontSize: 13, outline: 'none', opacity: snapshotsEnabled ? 1 : 0.5,
            }} />
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>秒</span>
        </div>
      </SettingRow>
      <SettingRow
        label="二进制文件快照"
        desc="PDF、图片等二进制文件默认不纳入快照（防止仓库膨胀）。开启后每个版本存完整副本。">
        <Toggle value={binarySnapshots} onChange={setBinarySnapshots} disabled={!snapshotsEnabled} />
      </SettingRow>

      {/* ─ 内置模板（ADR-010） ─ */}
      <SectionTitle title="内置模板（ADR-010）" />
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '14px 16px', margin: '8px 0 4px',
      }}>
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
          内置默认模板（档案/项目/资料）仅在工作区<strong style={{ color: 'var(--text-2)' }}>首次初始化</strong>时写入一次，此后：
        </p>
        {[
          '与用户自建模板完全平级，可编辑可删除，无"只读种子"',
          '删除后重新打开工作区不会自动重新写入（尊重你的删除决定）',
          'EIDON 版本升级不回溯已初始化工作区的内置模板',
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12.5, color: 'var(--text-2)' }}>
            <span style={{ color: 'oklch(0.65 0.12 145)', flexShrink: 0 }}>✓</span>
            <span>{item}</span>
          </div>
        ))}
        <button style={{
          marginTop: 8, background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 5, color: 'var(--text-2)', padding: '5px 14px', fontSize: 12,
          cursor: 'pointer',
        }}>前往模板管理 →</button>
      </div>

      {/* ─ 数据层 ─ */}
      <SectionTitle title="数据层（AX-1 · 真理源）" />
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '14px 16px', margin: '8px 0 4px',
      }}>
        {[
          { label: '真理源', value: 'Markdown + JSON（plain files）' },
          { label: 'SQLite', value: '运行时缓存，可删可重建（不影响数据）' },
          { label: 'JSONL', value: '事件日志，派生可丢弃' },
          { label: '快照仓库', value: '.eidon/snapshots.git（私有，可删）' },
          { label: '迁移', value: '拷贝整个文件夹即可，完全自包含' },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', width: 80, flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-2)', flex: 1 }}>{value}</span>
          </div>
        ))}
        <button style={{
          marginTop: 8, background: 'oklch(0.20 0.06 25)',
          border: '1px solid oklch(0.38 0.10 25)', borderRadius: 5,
          color: 'oklch(0.68 0.12 25)', padding: '6px 14px', fontSize: 12, cursor: 'pointer',
        }}>重建索引（删 SQLite 后重扫）</button>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}

Object.assign(window, { SettingsPage });
