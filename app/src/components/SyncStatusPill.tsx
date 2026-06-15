/**
 * SyncStatusPill.tsx — 状态栏 GitHub 同步快捷 pill（从 SyncStatusPill.vue 迁移）。
 * 未 link 时隐藏；把 SyncStatus 浓缩为单字形 + 点击动作（push/pull/解决冲突/提示）。
 * 逻辑（mode/tooltip/fmtAgo/onClick）逐字保留。
 */
import { useMemo } from 'react';
import { Icon } from './Icons';
import { useGithubSyncStore } from '../stores/githubSync';
import { useGithubSync } from '../composables/useGithubSync';
import { useWorkspaceStore } from '../stores/workspace';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';

interface Mode {
  glyph: string;
  label: string;
  action: 'push' | 'pull' | 'noop' | 'open-conflicts' | 'busy';
  tone: 'ok' | 'warn' | 'err' | 'busy';
}

export function SyncStatusPill() {
  const { t } = useI18n();
  const ops = useGithubSync();
  const status = useGithubSyncStore((s) => s.status);
  const pushing = useGithubSyncStore((s) => s.pushing);
  const pulling = useGithubSyncStore((s) => s.pulling);

  const fmtAgo = (ts: number | null | undefined): string => {
    if (!ts) return t('githubSync.never') || 'never';
    const dt = Date.now() / 1000 - ts;
    if (dt < 60) return t('githubSync.agoSec', { n: String(Math.floor(dt)) }) || `${Math.floor(dt)}s ago`;
    if (dt < 3600) return t('githubSync.agoMin', { n: String(Math.floor(dt / 60)) }) || `${Math.floor(dt / 60)}m ago`;
    if (dt < 86400) return t('githubSync.agoHour', { n: String(Math.floor(dt / 3600)) }) || `${Math.floor(dt / 3600)}h ago`;
    return t('githubSync.agoDay', { n: String(Math.floor(dt / 86400)) }) || `${Math.floor(dt / 86400)}d ago`;
  };

  const mode = useMemo<Mode>(() => {
    const s = status;
    if (!s) return { glyph: '·', label: '', action: 'noop', tone: 'ok' };
    if (pushing || pulling) return { glyph: '↻', label: t('githubSync.pillBusy') || 'Syncing…', action: 'busy', tone: 'busy' };
    if (s.has_conflicts) {
      return {
        glyph: `⚠${s.conflicts.length}`,
        label: t('githubSync.pillConflicts', { n: String(s.conflicts.length) }) || `${s.conflicts.length} conflict(s) — click to resolve`,
        action: 'open-conflicts',
        tone: 'err',
      };
    }
    if (s.behind > 0) {
      return { glyph: `↓${s.behind}`, label: t('githubSync.pillBehind', { n: String(s.behind) }) || `${s.behind} to pull — click to pull now`, action: 'pull', tone: 'warn' };
    }
    if (s.ahead > 0) {
      return { glyph: `↑${s.ahead}`, label: t('githubSync.pillAhead', { n: String(s.ahead) }) || `${s.ahead} to push — click to push now`, action: 'push', tone: 'warn' };
    }
    if (s.dirty) {
      return { glyph: '●', label: t('githubSync.pillDirty') || 'Uncommitted local changes — save with ⌘S', action: 'noop', tone: 'warn' };
    }
    return { glyph: '✓', label: t('githubSync.pillClean') || 'In sync with GitHub', action: 'noop', tone: 'ok' };
  }, [status, pushing, pulling, t]);

  if (!status?.linked) return null;

  const repo = status.remote_url.replace(/^https?:\/\/[^/]+\//, '').replace(/\.git$/, '');
  const tooltipLines = [
    `${mode.label}`,
    `→ ${repo}`,
    `${t('githubSync.lastPush') || 'Last push'}: ${fmtAgo(status.last_push_at)}`,
    `${t('githubSync.lastPull') || 'Last pull'}: ${fmtAgo(status.last_pull_at)}`,
  ];
  if (status.encrypted) tooltipLines.push(`🔒 ${t('githubSync.pillEncrypted') || 'End-to-end encrypted'}`);
  const tooltip = tooltipLines.join('\n');

  async function onClick() {
    switch (mode.action) {
      case 'push':
        await ops.pushNow();
        break;
      case 'pull':
        await ops.pullNow();
        break;
      case 'open-conflicts':
        window.dispatchEvent(new CustomEvent('eidon:open-history-panel'));
        break;
      case 'busy':
        useToastsStore.getState().info(t('githubSync.pillBusy') || 'Syncing — please wait');
        break;
      case 'noop':
      default:
        if (useGithubSyncStore.getState().status?.dirty) {
          useToastsStore.getState().info(t('githubSync.pillDirty') || 'Save first to push.');
        } else {
          useToastsStore.getState().success(t('githubSync.upToDate') || 'Already up to date.');
        }
        break;
    }
    const folder = useWorkspaceStore.getState().currentFolder;
    if (folder) await useGithubSyncStore.getState().refreshStatus(folder);
  }

  return (
    <button className={`sync-pill sync-pill--${mode.tone}`} title={tooltip} onClick={onClick}>
      <span className="sync-pill__cloud">{status.encrypted ? <Icon name="lock" size={12} /> : <Icon name="cloud" size={12} />}</span>
      <span className="sync-pill__glyph">{mode.glyph}</span>
    </button>
  );
}

export default SyncStatusPill;
