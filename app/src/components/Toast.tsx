/**
 * Toast.tsx — 通知堆叠（从 Toast.vue 迁移）。订阅 toasts.items 渲染；点击复制消息。
 * 触发/堆叠/自动消失逻辑全在 toasts store（不变）；样式见 styles/components.css。
 * Vue transition-group 的入场动画以 CSS @keyframes 复刻；离场随 store 移除即消失。
 */
import { useToastsStore, type Toast as ToastItem } from '../stores/toasts';
import { Icon } from './Icons';

// Toast 类型 → lucide 图标 name（经 <Icon> 渲染）。
const icons: Record<string, string> = {
  success: 'check',
  error: 'close',
  info: 'info',
  warning: 'warning',
};

function onToastClick(t: ToastItem) {
  navigator.clipboard.writeText(t.message).catch(() => {});
}

export function Toast() {
  const items = useToastsStore((s) => s.items);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`} onClick={() => onToastClick(t)}>
          <span className="toast__icon"><Icon name={icons[t.kind]} size={15} /></span>
          <span className="toast__msg">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export default Toast;
