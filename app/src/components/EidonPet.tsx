/**
 * EidonPet.tsx — 交互式像素宠物「小芽」。
 *
 * 渲染：单张精灵表 app/public/eidon-pet-sheet.png（scripts/generate-brand-icon.mjs 生成），
 *   行=形态、列=帧；由 .eidon-pet--<state> 类选行、CSS steps() 动画走帧（见 components.css）。
 *
 * 交互：
 *   - 跟随鼠标：mousemove（rAF 节流）→ follow 形态，按光标方位选「看左/看右」帧 + 身体轻微倾斜；
 *     停止移动 ~1.4s 回 idle。
 *   - 被点击：clicked 形态（跳起 + 爱心）~0.9s 后回 idle。
 *   - 久置睡眠：~90s 无鼠标移动/事件 → sleep（趴着休息）。
 *   - 事件表情：订阅 window 自定义事件，瞬时切换表情 ~2.2s 后回 idle：
 *       eidon:saved → received（收到新资料）
 *       eidon:remote-pulled → charging（充电中）
 *       eidon:open-global-search / eidon:open-cjk-proofread → focus（专注）
 *
 * 形态行序须与生成器 STATE_ORDER 及 components.css 保持一致。
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

type PetState =
  | 'idle' | 'follow' | 'clicked' | 'sleep'
  | 'happy' | 'thinking' | 'focus' | 'received' | 'charging';

const SLEEP_AFTER_MS = 90_000; // 久置 → 睡眠
const FOLLOW_RELAX_MS = 1400;  // 停止移动 → 回 idle
const TRANSIENT_MS = 2200;     // 事件表情时长
const CLICK_MS = 900;          // 点击表情时长

interface EidonPetProps {
  /** 无障碍标签（同时作为 tooltip）。 */
  label?: string;
}

export function EidonPet({ label = 'EIDON' }: EidonPetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PetState>('idle');
  const [lookFrame, setLookFrame] = useState(0);       // follow：0=看右 1=看左
  const [lean, setLean] = useState({ x: 0, y: 0 });    // follow：身体轻微倾斜

  // 最新 state 供事件回调读取（避免闭包过期）
  const stateRef = useRef(state);
  stateRef.current = state;

  // 计时器 / 锁
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relaxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exprTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lockedRef = useRef(false); // true 时表情正在播放，鼠标不抢占

  function clearTimer(r: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
    if (r.current) { clearTimeout(r.current); r.current = null; }
  }

  function scheduleSleep() {
    clearTimer(sleepTimer);
    sleepTimer.current = setTimeout(() => {
      if (!lockedRef.current) { setLean({ x: 0, y: 0 }); setState('sleep'); }
    }, SLEEP_AFTER_MS);
  }

  /** 播放一个瞬时表情，到时回 idle。 */
  function playExpression(s: PetState, ms = TRANSIENT_MS) {
    lockedRef.current = true;
    setLean({ x: 0, y: 0 });
    setState(s);
    clearTimer(exprTimer);
    exprTimer.current = setTimeout(() => {
      lockedRef.current = false;
      setState('idle');
      scheduleSleep();
    }, ms);
    scheduleSleep();
  }

  // 鼠标跟随 + 久置睡眠
  useEffect(() => {
    function onMove(e: MouseEvent) {
      scheduleSleep(); // 任何移动都唤醒/重置睡眠计时
      if (lockedRef.current) return; // 表情播放中，不抢占
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const clamp = (v: number) => Math.max(-2, Math.min(2, v / 40));
        setLookFrame(dx >= 0 ? 0 : 1);
        setLean({ x: clamp(dx), y: clamp(dy) });
        if (stateRef.current !== 'follow' && stateRef.current !== 'clicked') setState('follow');
        clearTimer(relaxTimer);
        relaxTimer.current = setTimeout(() => {
          if (!lockedRef.current && stateRef.current === 'follow') {
            setLean({ x: 0, y: 0 });
            setState('idle');
          }
        }, FOLLOW_RELAX_MS);
      });
    }
    document.addEventListener('mousemove', onMove);
    scheduleSleep();
    return () => {
      document.removeEventListener('mousemove', onMove);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      clearTimer(sleepTimer);
      clearTimer(relaxTimer);
      clearTimer(exprTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 应用事件 → 表情
  useEffect(() => {
    const onSaved = () => playExpression('received');
    const onPulled = () => playExpression('charging');
    const onFocus = () => playExpression('focus');
    const onReminder = () => playExpression('received'); // 提醒到点：复用「收到」表情提示
    window.addEventListener('eidon:saved', onSaved);
    window.addEventListener('eidon:remote-pulled', onPulled);
    window.addEventListener('eidon:open-global-search', onFocus);
    window.addEventListener('eidon:open-cjk-proofread', onFocus);
    window.addEventListener('eidon:reminder-due', onReminder);
    return () => {
      window.removeEventListener('eidon:saved', onSaved);
      window.removeEventListener('eidon:remote-pulled', onPulled);
      window.removeEventListener('eidon:open-global-search', onFocus);
      window.removeEventListener('eidon:open-cjk-proofread', onFocus);
      window.removeEventListener('eidon:reminder-due', onReminder);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClick() {
    playExpression('clicked', CLICK_MS);
  }

  // follow 形态用 inline 锁定静态帧 + 倾斜；其余形态交给 CSS 动画
  const style: CSSProperties = state === 'follow'
    ? {
        backgroundPositionX: `calc(var(--pet-cell) * ${-lookFrame})`,
        transform: `translate(${lean.x}px, ${lean.y}px)`,
      }
    : {};

  return (
    <div
      ref={ref}
      className={`eidon-pet eidon-pet--${state}`}
      style={style}
      onClick={handleClick}
      role="img"
      aria-label={label}
    />
  );
}
