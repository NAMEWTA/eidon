/**
 * NewMarkdownDialog —— 「新建 Markdown 文件」名称输入框（顶栏 / 资源管理器统一入口）。
 *
 * 预填 `YYYY-MM-DD-.md`，聚焦时把光标停在扩展名前（即末尾「-」之后），等待用户补标题。
 * 确认后由调用方在目标 L3 建文件并立即写入 frontmatter（见 hooks/useFiles.createMarkdownAt）。
 * 复用 FileTree 名称框的 `.node-dialog`/`ftree__name-dialog` 样式，与资源管理器内的同款一致。
 */
import { useEffect, useState } from 'react';

import { Icon } from '../shared/Icons';
import { useI18n } from '../../i18n';

export function NewMarkdownDialog({
  open,
  defaultName,
  onConfirm,
  onClose,
}: {
  open: boolean;
  defaultName: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  if (!open) return null;

  const submit = () => {
    const clean = name.trim();
    if (clean) onConfirm(clean);
  };

  return (
    <div className="node-dialog__backdrop" onClick={onClose}>
      <div className="node-dialog ftree__name-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="ftree__move-head">
          <span className="ftree__move-title">{t('explorer.newFile')}</span>
          <button className="rs-pane-close" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="ftree__name-dialog-body">
          <input
            autoFocus
            value={name}
            spellCheck={false}
            onChange={(event) => setName(event.target.value)}
            onFocus={(event) => {
              // 光标停在扩展名前：日期文件名落在末尾「-」之后，等待补标题。
              const dot = name.lastIndexOf('.');
              const caret = dot > 0 ? dot : name.length;
              event.currentTarget.setSelectionRange(caret, caret);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
              if (event.key === 'Enter') submit();
            }}
          />
        </div>
        <div className="ftree__name-dialog-actions">
          <button onClick={onClose}>{t('explorer.nameDialogCancel')}</button>
          <button className="primary-btn" disabled={!name.trim()} onClick={submit}>
            {t('explorer.nameDialogConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewMarkdownDialog;
