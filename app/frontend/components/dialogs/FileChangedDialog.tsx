/**
 * FileChangedDialog.tsx — 外部修改了脏标签的文件时的三选对话框。
 * 受控组件：reload / overwrite / cancel。复用 .ud* 样式（components.css）。
 */
import { useI18n } from '../../i18n';
import { Icon } from '../shared/Icons';

export interface FileChangedDialogProps {
  open: boolean;
  fileName: string;
  onReload: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
}

export function FileChangedDialog({ open, fileName, onReload, onOverwrite, onCancel }: FileChangedDialogProps) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="ud__backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ud" role="dialog">
        <button className="ud__close" onClick={onCancel} aria-label="Cancel"><Icon name="close" size={18} /></button>
        <div className="ud__icon"><Icon name="new-text" size={20} /></div>
        <h3 className="ud__title">{t('fileChanged.title')}</h3>
        <p className="ud__msg">
          <strong>{fileName}</strong> {t('fileChanged.message')}
        </p>
        <div className="ud__actions">
          <button className="ud__btn ud__btn--cancel" onClick={onCancel}>{t('fileChanged.dismiss')}</button>
          <button className="ud__btn ud__btn--discard" onClick={onReload}>{t('fileChanged.reload')}</button>
          <button className="ud__btn ud__btn--save" onClick={onOverwrite}>{t('fileChanged.overwrite')}</button>
        </div>
      </div>
    </div>
  );
}

export default FileChangedDialog;
