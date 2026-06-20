/**
 * UnsavedDialog.tsx — 关闭含未保存内容的标签/窗口时的三选对话框。
 * 受控组件：App 持有 open/promise，按钮回调 resolve 'save'|'discard'|'cancel'。样式见 components.css。
 */
import { useI18n } from '../../i18n';
import { Icon } from '../shared/Icons';

export interface UnsavedDialogProps {
  open: boolean;
  fileName: string;
  mode: 'tab' | 'window';
  count?: number;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedDialog({ open, fileName, onSave, onDiscard, onCancel }: UnsavedDialogProps) {
  const { t } = useI18n();
  if (!open) return null;
  const msg = t('unsaved.message', { file: fileName }).replace(fileName + ' ', '').replace(fileName, '');
  return (
    <div className="ud__backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ud" role="dialog">
        <button className="ud__close" onClick={onCancel} aria-label="Cancel"><Icon name="close" size={18} /></button>
        <div className="ud__icon"><Icon name="warning" size={20} /></div>
        <h3 className="ud__title">{t('unsaved.title')}</h3>
        <p className="ud__msg">
          <strong>{fileName}</strong>: {msg}
        </p>
        <div className="ud__actions">
          <button className="ud__btn ud__btn--cancel" onClick={onCancel}>{t('unsaved.cancel')}</button>
          <button className="ud__btn ud__btn--discard" onClick={onDiscard}>{t('unsaved.dontSave')}</button>
          <button className="ud__btn ud__btn--save" onClick={onSave}>{t('unsaved.save')}</button>
        </div>
      </div>
    </div>
  );
}

export default UnsavedDialog;
