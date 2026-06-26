/**
 * EditorContextMenu —— 编辑器右键浮层菜单（纯展示）。
 *
 * 选区格式化（加粗/倾斜/删除线）、加入 AI 对话（选中文本 / 行·字符引用）、复制相对/绝对路径 + 行号。
 * 动作的具体落地（改文档 / 写剪贴板 / 投递 AI）由 Editor 实现并经 onAction 回调（持有 EditorView）。
 * 复用标签右键菜单的 `ctx-menu`/`ctx-item` 样式。
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { useI18n } from '../../i18n';

export type EditorMenuAction =
  | { type: 'format'; mark: 'bold' | 'italic' | 'strikethrough' }
  | { type: 'addToAi'; mode: 'text' | 'ref' }
  | { type: 'copyPath'; scope: 'rel' | 'abs' };

export function EditorContextMenu({
  x,
  y,
  hasSelection,
  onAction,
  onClose,
}: {
  x: number;
  y: number;
  hasSelection: boolean;
  onAction: (action: EditorMenuAction) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    const close = () => onClose();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const act = (action: EditorMenuAction) => {
    onAction(action);
    onClose();
  };

  return createPortal(
    <div className="ctx-menu" style={{ left: `${x}px`, top: `${y}px` }} onClick={(event) => event.stopPropagation()}>
      <button className="ctx-item" onClick={() => act({ type: 'format', mark: 'bold' })}>{t('editorMenu.bold')}</button>
      <button className="ctx-item" onClick={() => act({ type: 'format', mark: 'italic' })}>{t('editorMenu.italic')}</button>
      <button className="ctx-item" onClick={() => act({ type: 'format', mark: 'strikethrough' })}>{t('editorMenu.strikethrough')}</button>
      <div className="ctx-sep" />
      <button className="ctx-item" disabled={!hasSelection} onClick={() => act({ type: 'addToAi', mode: 'text' })}>
        {t('editorMenu.addToAiText')}
      </button>
      <button className="ctx-item" onClick={() => act({ type: 'addToAi', mode: 'ref' })}>{t('editorMenu.addToAiRef')}</button>
      <div className="ctx-sep" />
      <button className="ctx-item" onClick={() => act({ type: 'copyPath', scope: 'rel' })}>{t('editorMenu.copyRelPath')}</button>
      <button className="ctx-item" onClick={() => act({ type: 'copyPath', scope: 'abs' })}>{t('editorMenu.copyAbsPath')}</button>
    </div>,
    document.body,
  );
}

export default EditorContextMenu;
