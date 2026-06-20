/**
 * BacklinksPanel.tsx — 反向链接面板。
 * 以 active 文档 stem 为目标查 backlinks；点击跳转并 outline-goto 定位行。
 */
import { useEffect, useState } from 'react';
import { Icon } from '../shared/Icons';
import { useTabsStore } from '../../stores/tabs';
import { useWorkspaceIndexStore, type BacklinkRef } from '../../stores/workspaceIndex';
import { openPath } from '../../hooks/useFiles';
import { useI18n } from '../../i18n';

export function BacklinksPanel({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  const activeFileName = useTabsStore((s) => s.activeTab()?.fileName);
  const ready = useWorkspaceIndexStore((s) => s.ready);
  const entriesLen = useWorkspaceIndexStore((s) => s.entries.length);
  const [refs, setRefs] = useState<BacklinkRef[]>([]);
  const [loading, setLoading] = useState(false);

  const activeStem = activeFileName ? activeFileName.replace(/\.[^.]+$/, '') : null;

  useEffect(() => {
    let alive = true;
    async function reload() {
      if (!activeStem) {
        setRefs([]);
        return;
      }
      setLoading(true);
      try {
        const r = await useWorkspaceIndexStore.getState().backlinksFor(activeStem);
        if (alive) setRefs(r);
      } finally {
        if (alive) setLoading(false);
      }
    }
    reload();
    return () => {
      alive = false;
    };
  }, [activeStem, entriesLen]);

  async function openBacklink(ref: BacklinkRef) {
    await openPath(ref.fromPath);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('eidon:outline-goto', { detail: { line: ref.line, paneId: undefined } }));
    }, 200);
  }

  return (
    <div className="backlinks">
      <header className="backlinks__head">
        <span className="backlinks__title">{t('backlinks.heading')}</span>
        {!loading && <span className="backlinks__count">{refs.length}</span>}
        {onClose && <button className="rs-pane-close" type="button" title={t('rightSidebar.hidePane')} onClick={onClose}><Icon name="close" size={16} /></button>}
      </header>
      {loading ? (
        <div className="backlinks__empty">{t('backlinks.loading')}</div>
      ) : !ready ? (
        <div className="backlinks__empty">{t('backlinks.openFolder')}</div>
      ) : !activeStem ? (
        <div className="backlinks__empty">{t('backlinks.noActive')}</div>
      ) : refs.length === 0 ? (
        <div className="backlinks__empty">{t('backlinks.noResults')}</div>
      ) : (
        <ul className="backlinks__list">
          {refs.map((r, i) => (
            <li key={`${r.fromPath}-${r.line}-${i}`} className="backlinks__item">
              <button className="backlinks__row" onClick={() => openBacklink(r)}>
                <div className="backlinks__file">{r.fromName}</div>
                <div className="backlinks__loc">L{r.line}</div>
                {r.context.length > 0 && <pre className="backlinks__ctx">{r.context.join('\n')}</pre>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default BacklinksPanel;
