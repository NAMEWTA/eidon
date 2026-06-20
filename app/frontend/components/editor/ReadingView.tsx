/**
 * ReadingView.tsx — 公开阅读模式。复用 Preview（skin=reading），
 * 浮动 ✕ 退出回上一个视图模式。样式见 styles/components.css。
 */
import { Preview } from './Preview';
import { Icon } from '../shared/Icons';
import { useTabsStore } from '../../stores/tabs';
import { useSettingsStore } from '../../stores/settings';
import { useI18n } from '../../i18n';
import { openPath } from '../../hooks/useFiles';

export function ReadingView() {
  const { t } = useI18n();
  const tab = useTabsStore((s) => s.activeTab());
  const exitReadingMode = useSettingsStore((s) => s.exitReadingMode);
  return (
    <div className="reading-view" data-reading-view>
      <button
        className="reading-view__close"
        title={t('reading.exitTooltip')}
        aria-label={t('reading.exit')}
        onClick={() => exitReadingMode()}
      >
        <Icon name="close" size={18} />
      </button>
      {tab ? (
        <div className="reading-view__doc">
          <Preview source={tab.content} filePath={tab.filePath} skin="reading" onOpenPath={openPath} />
        </div>
      ) : (
        <div className="reading-view__empty">{t('reading.empty')}</div>
      )}
    </div>
  );
}

export default ReadingView;
