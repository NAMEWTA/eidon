/**
 * settings/kit —— 设置面板共享基元（对齐 HanaAgent，落地为 EIDON CSS 类）。
 *
 * 全部基于 settings.css 的 set-* / settings-* 类，替代各 AI 组件里散落的内联样式对象。
 * 纯 UI（仅依赖 React）；AI 区与非 AI 区设置都复用，统一观感与按钮区隔。
 */
import {
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/* ── 容器 ── */

/** 一个设置分区：标题 + 右上角 context 插槽（承载作用对象开关/选择器）+ 提示 + 内容。 */
export function SettingsSection({
  title,
  hint,
  context,
  children,
}: {
  title?: string;
  hint?: string;
  context?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="set-section">
      {(title || context) && (
        <div className="set-section__head">
          {title ? <h3 className="set-section__title">{title}</h3> : <span />}
          {context}
        </div>
      )}
      {hint && <p className="set-section__hint">{hint}</p>}
      {children}
    </section>
  );
}

/** 一行设置：左 label/hint，右 control。 */
export function SettingsRow({
  label,
  hint,
  control,
}: {
  label: ReactNode;
  hint?: string;
  control: ReactNode;
}) {
  return (
    <div className="set-row">
      <div className="set-row__label">
        <div>{label}</div>
        {hint && <div className="set-row__hint">{hint}</div>}
      </div>
      <div className="set-row__control">{control}</div>
    </div>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`set-card ${className}`.trim()}>{children}</div>;
}

/** 页顶状态 banner（如 AI 未配置提示）。 */
export function Banner({ warn, children }: { warn?: boolean; children: ReactNode }) {
  return <div className={`set-banner${warn ? ' is-warn' : ''}`}>{children}</div>;
}

/* ── 表单控件 ── */

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`settings-input ${className}`.trim()} {...rest} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`settings-textarea ${className}`.trim()} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`settings-select ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
}

/** 开关（受控）。`on === undefined` = 加载态（禁用）。 */
export function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean | undefined;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const isOn = on === true;
  const loading = on === undefined;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      disabled={disabled || loading}
      onClick={() => onChange(!isOn)}
      className={`set-toggle${isOn ? ' is-on' : ''}`}
      style={loading ? { opacity: 0.5 } : undefined}
    />
  );
}

/** 密钥输入框：默认隐藏，可点眼睛临时显示。`onReveal` 提供时点显示会异步取回已存明文。 */
export function KeyInput({
  value,
  onChange,
  onBlur,
  onReveal,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  onReveal?: () => Promise<string>;
  placeholder?: string;
}) {
  const [reveal, setReveal] = useState(false);
  async function toggle() {
    const next = !reveal;
    if (next && onReveal && !value) {
      try {
        const plain = await onReveal();
        if (plain) onChange(plain);
      } catch {
        /* swallow */
      }
    }
    setReveal(next);
  }
  return (
    <div className="pv-cred-field">
      <input
        className="settings-input"
        type={reveal ? 'text' : 'password'}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      <button type="button" className="pv-cred-icon-btn" onClick={() => void toggle()} title={reveal ? '隐藏' : '显示'}>
        {reveal ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

/* ── 顶部 TabBar ── */

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="set-tabbar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          className={`set-tabbar__tab${active === tab.id ? ' is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
