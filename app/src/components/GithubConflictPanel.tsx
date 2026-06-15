/**
 * GithubConflictPanel.tsx — 冲突解决面板（从 GithubConflictPanel.vue 迁移）。
 * 每个冲突文件一行三选（use mine / use GitHub / keep both）；解决后 Rust 重跑 git status，
 * 面板随冲突清空自动消失。
 */
import { useState } from 'react';
import { Icon } from './Icons';
import { useGithubSyncStore } from '../stores/githubSync';
import { useWorkspaceStore } from '../stores/workspace';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';

export function GithubConflictPanel() {
  const { t } = useI18n();
  const status = useGithubSyncStore((s) => s.status);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function resolve(file: string, choice: 'local' | 'remote' | 'both') {
    const folder = useWorkspaceStore.getState().currentFolder;
    if (!folder) return;
    setBusy((b) => ({ ...b, [file]: true }));
    try {
      await useGithubSyncStore.getState().resolveConflict(folder, file, choice);
      useToastsStore.getState().success(t('githubSync.conflictResolvedToast', { file }));
      window.dispatchEvent(new CustomEvent('eidon:remote-pulled'));
    } catch (e) {
      useToastsStore.getState().error(`${t('githubSync.conflictResolveFailed')}: ${e}`);
    } finally {
      setBusy((b) => {
        const { [file]: _drop, ...rest } = b;
        void _drop;
        return rest;
      });
    }
  }

  async function pushAfterResolve() {
    const folder = useWorkspaceStore.getState().currentFolder;
    if (!folder) return;
    try {
      await useGithubSyncStore.getState().push(folder);
      useToastsStore.getState().success(t('githubSync.pushedToast'));
    } catch (e) {
      useToastsStore.getState().error(`${t('githubSync.pushFailed')}: ${e}`);
    }
  }

  if (!status?.has_conflicts) return null;
  const conflicts = status.conflicts ?? [];
  return (
    <section className="ghc">
      <div className="ghc__header">
        <span className="ghc__icon"><Icon name="warning" size={14} /></span>
        <strong>{t('githubSync.conflictsHeading', { n: String(conflicts.length) })}</strong>
      </div>
      <p className="ghc__intro">{t('githubSync.conflictsIntro')}</p>
      <ul className="ghc__list">
        {conflicts.map((file) => (
          <li key={file} className="ghc__item">
            <div className="ghc__file" title={file}>{file}</div>
            <div className="ghc__actions">
              <button className="ghc__btn" disabled={!!busy[file]} onClick={() => resolve(file, 'local')}>
                {t('githubSync.useLocal')}
              </button>
              <button className="ghc__btn" disabled={!!busy[file]} onClick={() => resolve(file, 'remote')}>
                {t('githubSync.useRemote')}
              </button>
              <button className="ghc__btn" disabled={!!busy[file]} onClick={() => resolve(file, 'both')}>
                {t('githubSync.keepBoth')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {conflicts.length === 0 && (status.ahead ?? 0) > 0 && (
        <div className="ghc__push-row">
          <button className="ghc__btn ghc__btn--primary" onClick={pushAfterResolve}>
            {t('githubSync.pushAfterResolve')}
          </button>
        </div>
      )}
    </section>
  );
}

export default GithubConflictPanel;
