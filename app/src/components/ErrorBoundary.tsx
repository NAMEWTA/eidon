/**
 * ErrorBoundary — 顶层渲染异常兜底（class 组件，React 错误边界的唯一形态）。
 *
 * EIDON 是成熟的知识库笔记系统，单次渲染抛错绝不应让整窗白屏（React 默认会卸载整棵树）。
 * 此边界把任何渲染期异常收敛为可恢复面板：
 *  - getDerivedStateFromError：进入兜底渲染态；
 *  - componentDidCatch：console.error 打印 error + componentStack（定位抛错组件链的直接依据）；
 *  - 「重试」清空错误态、就地重新渲染；「重载窗口」整窗重载兜底；「复制详情」便于排错上报。
 */
import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 关键：componentStack 指明抛错组件链，是排查「移动后白屏」等渲染崩溃根因的直接依据。
    console.error('[EIDON ErrorBoundary] 渲染异常:', error);
    console.error('[EIDON ErrorBoundary] 组件栈:', info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private reset = (): void => {
    this.setState({ error: null, componentStack: null });
  };

  private reload = (): void => {
    window.location.reload();
  };

  private copyDetails = (): void => {
    const { error, componentStack } = this.state;
    const text = [
      `${error?.name ?? 'Error'}: ${error?.message ?? ''}`,
      error?.stack ?? '',
      '',
      'Component stack:',
      componentStack ?? '',
    ].join('\n');
    void navigator.clipboard?.writeText(text).catch(() => {});
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={overlay}>
        <div style={card}>
          <div style={title}>界面遇到一个错误</div>
          <p style={hint}>
            操作已中断，但你的数据仍在磁盘上、未保存的编辑也还在内存中。可先「重试」恢复界面；若仍异常再「重载窗口」。
          </p>
          <pre style={pre}>{error.name}: {error.message}</pre>
          {componentStack && <pre style={{ ...pre, maxHeight: 180 }}>{componentStack}</pre>}
          <div style={row}>
            <button style={primaryBtn} onClick={this.reset}>重试</button>
            <button style={btn} onClick={this.reload}>重载窗口</button>
            <button style={btn} onClick={this.copyDetails}>复制详情</button>
          </div>
        </div>
      </div>
    );
  }
}

// 内联样式走既有 CSS 变量主题，避免新增样式表依赖。
const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'var(--bg, #1e1e1e)',
  color: 'var(--text, #ddd)',
  zIndex: 99999,
};

const card: CSSProperties = {
  width: '100%',
  maxWidth: 560,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 20,
  border: '1px solid var(--border, #444)',
  borderRadius: 8,
  background: 'var(--bg-secondary, var(--bg, #252526))',
};

const title: CSSProperties = { fontSize: 16, fontWeight: 600 };

const hint: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted, #999)' };

const pre: CSSProperties = {
  margin: 0,
  padding: '8px 10px',
  maxHeight: 96,
  overflow: 'auto',
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  border: '1px solid var(--border, #444)',
  borderRadius: 6,
  background: 'var(--bg, #1e1e1e)',
  color: 'var(--text-muted, #aaa)',
};

const row: CSSProperties = { display: 'flex', gap: 8, marginTop: 4 };

const btn: CSSProperties = {
  padding: '6px 14px',
  fontSize: 13,
  border: '1px solid var(--border, #444)',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--text, #ddd)',
  cursor: 'pointer',
};

const primaryBtn: CSSProperties = {
  ...btn,
  border: '1px solid var(--accent, #4a9eff)',
  background: 'var(--accent, #4a9eff)',
  color: '#fff',
};
