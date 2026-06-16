/**
 * HistorySettings.tsx — 「设置-同步」内的版本历史上限配置（见 ADR-0023）。
 *
 * 单文件历史显示上限（仅显示，不改写历史）+ 整仓最大提交数 / `.git` 最大体积
 * （超出自动修剪最旧提交，破坏性）。附 `.git` 体积显示 + 「立即压缩历史」手动按钮。
 */
import { useEffect, useState } from 'react';

import { useI18n } from '../i18n';
import { useSettingsStore } from '../stores/settings';
import { useWorkspaceStore } from '../stores/workspace';
import { useGitHistoryStore } from '../stores/gitHistory';
import { useToastsStore } from '../stores/toasts';
import { runHistoryPrune } from '../lib/history-prune';

const numInputStyle: React.CSSProperties = {
  width: '88px',
  padding: '6px 8px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  borderRadius: '4px',
};
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' };
const labelStyle: React.CSSProperties = { flex: 1, fontSize: '13px', color: 'var(--text)' };
const hintStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--text-faint)', marginTop: '4px' };

function fmtMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function HistorySettings() {
  const { t } = useI18n();
  const maxVersions = useSettingsStore((s) => s.historyMaxVersionsPerFile);
  const maxCommits = useSettingsStore((s) => s.historyMaxCommits);
  const maxSizeMb = useSettingsStore((s) => s.historyMaxGitSizeMb);
  const folder = useWorkspaceStore((s) => s.currentFolder);
  const initialized = useGitHistoryStore((s) => s.isInitialized());
  const [sizeBytes, setSizeBytes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshSize() {
    if (!folder) {
      setSizeBytes(null);
      return;
    }
    setSizeBytes(await useGitHistoryStore.getState().repoSize(folder));
  }

  // 打开设置或工作区/初始化态变化时刷新体积。
  useEffect(() => {
    void refreshSize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, initialized]);

  async function pruneNow() {
    if (!folder || busy) return;
    if (maxCommits <= 0 && maxSizeMb <= 0) {
      useToastsStore.getState().info(t('settings.history.noLimits'));
      return;
    }
    setBusy(true);
    try {
      await runHistoryPrune(folder);
      await refreshSize();
      useToastsStore.getState().success(t('settings.history.pruned'));
    } catch (e) {
      useToastsStore.getState().error(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={rowStyle}>
        <span style={labelStyle}>{t('settings.history.maxVersionsPerFile')}</span>
        <input
          type="number" min="5" max="2000" step="1"
          value={maxVersions}
          onChange={(e) => useSettingsStore.getState().setHistoryMaxVersionsPerFile(+e.target.value)}
          style={numInputStyle}
        />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>{t('settings.history.maxCommits')}</span>
        <input
          type="number" min="0" max="100000" step="10"
          value={maxCommits}
          onChange={(e) => useSettingsStore.getState().setHistoryMaxCommits(+e.target.value)}
          style={numInputStyle}
        />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>{t('settings.history.maxSizeMb')}</span>
        <input
          type="number" min="0" max="100000" step="10"
          value={maxSizeMb}
          onChange={(e) => useSettingsStore.getState().setHistoryMaxGitSizeMb(+e.target.value)}
          style={numInputStyle}
        />
      </div>
      <p style={hintStyle}>{t('settings.history.limitsHint')}</p>

      <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {t('settings.history.gitSize')}: {sizeBytes === null ? '—' : `${fmtMb(sizeBytes)} MB`}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => void refreshSize()} disabled={!folder}>{t('settings.history.refreshSize')}</button>
          <button onClick={() => void pruneNow()} disabled={!folder || busy}>
            {busy ? t('settings.history.pruning') : t('settings.history.pruneNow')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default HistorySettings;
