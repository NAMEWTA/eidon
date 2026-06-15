/**
 * SessionRestoreDialog.tsx — 跨设备会话恢复对话框（从 SessionRestoreDialog.vue 迁移）。
 * 监听 `eidon:session-restore-available`；Restore 打开兄弟会话的标签并切换 active，
 * Keep mine 关闭。逻辑（rel_path 解析、applySession）逐字保留。
 */
import { useEffect, useRef, useState } from 'react';
import { useCloudSyncStore, type SessionPayload, type SiblingSession } from '../stores/cloudSync';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useWorkspaceStore } from '../stores/workspace';
import { openPath } from '../composables/useFiles';
import { useI18n } from '../i18n';

function resolveSessionTabPath(sib: { file_path: string | null; rel_path?: string | null }): string | null {
  const root = useWorkspaceStore.getState().currentFolder || '';
  if (sib.rel_path && root) {
    const sep = /^[a-zA-Z]:[\\/]/.test(root) ? '\\' : '/';
    const cleanRoot = root.replace(/[\\/]+$/, '');
    const cleanRel = sib.rel_path.replace(/^[\\/]+/, '').replace(/[\\/]/g, sep);
    return `${cleanRoot}${sep}${cleanRel}`;
  }
  return sib.file_path;
}

async function applySession(payload: SessionPayload) {
  const tabs = useTabsStore.getState();
  const havePath = new Set(tabs.tabs.map((t) => t.filePath).filter(Boolean) as string[]);
  for (const sib of payload.tabs) {
    const path = resolveSessionTabPath(sib);
    if (!path) continue;
    if (havePath.has(path)) continue;
    try {
      await openPath(path);
    } catch (e) {
      console.warn('failed to open from sibling session', path, e);
    }
  }
  const target = payload.tabs[payload.active_index];
  if (target) {
    const targetPath = resolveSessionTabPath(target);
    if (targetPath) {
      const localTab = useTabsStore.getState().tabs.find((t) => t.filePath === targetPath);
      if (localTab) useTabsStore.getState().activate(localTab.id);
    }
  }
}

export function SessionRestoreDialog() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [sibling, setSibling] = useState<SiblingSession | null>(null);
  const [restoring, setRestoring] = useState(false);
  const folderRef = useRef<string | null>(null);
  const siblingRef = useRef<SiblingSession | null>(null);
  siblingRef.current = sibling;

  useEffect(() => {
    const onAvailable = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (!detail.sibling || !detail.folder) return;
      setSibling(detail.sibling);
      folderRef.current = detail.folder;
      setVisible(true);
    };
    window.addEventListener('eidon:session-restore-available', onAvailable);
    return () => window.removeEventListener('eidon:session-restore-available', onAvailable);
  }, []);

  function timeAgoLabel(epoch: number): string {
    const dt = Date.now() / 1000 - epoch;
    if (dt < 60) return t('cloudSync.agoSec', { n: String(Math.floor(dt)) });
    if (dt < 3600) return t('cloudSync.agoMin', { n: String(Math.floor(dt / 60)) });
    if (dt < 86400) return t('cloudSync.agoHour', { n: String(Math.floor(dt / 3600)) });
    return t('cloudSync.agoDay', { n: String(Math.floor(dt / 86400)) });
  }

  async function restore() {
    const folder = folderRef.current;
    const sib = siblingRef.current;
    if (!folder || !sib) return;
    setRestoring(true);
    try {
      const payload = await useCloudSyncStore.getState().loadSession(folder, sib.device_id);
      if (!payload) {
        useToastsStore.getState().warning(t('cloudSync.siblingMissing'));
        setVisible(false);
        return;
      }
      await applySession(payload);
      useToastsStore.getState().success(t('cloudSync.restoredToast', { device: sib.device_label }));
    } catch (e) {
      useToastsStore.getState().error(String(e));
    } finally {
      setRestoring(false);
      setVisible(false);
    }
  }

  if (!visible) return null;
  return (
    <div className="srd__backdrop" onClick={(e) => e.target === e.currentTarget && setVisible(false)}>
      <div className="srd" role="dialog" aria-modal="true">
        <h3 className="srd__title">{t('cloudSync.restoreTitle')}</h3>
        <p className="srd__lead">
          {t('cloudSync.restoreLead', {
            device: sibling?.device_label ?? '?',
            ago: sibling ? timeAgoLabel(sibling.saved_at) : '',
            tabs: String(sibling?.tab_count ?? 0),
          })}
        </p>
        <div className="srd__actions">
          <button className="srd__btn" disabled={restoring} onClick={() => setVisible(false)}>
            {t('cloudSync.keepMineBtn')}
          </button>
          <button className="srd__btn srd__btn--primary" disabled={restoring} onClick={restore}>
            {restoring ? t('cloudSync.restoring') : t('cloudSync.restoreBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionRestoreDialog;
