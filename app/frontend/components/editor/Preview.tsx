/**
 * Preview.tsx — markdown 渲染面命令式包装器。
 *
 * 渲染面像素保真（强约束，ADR-0010）：HTML 由 markdown-it（lib/markdown）生成并经
 * dangerouslySetInnerHTML 注入；Mermaid 渲染 / 图片放大浮层 / 链接拦截在 effect 中
 * 以命令式 API 协调，不依赖 React 渲染。样式见全局 styles/preview.css（逐字保留）。
 *
 * 注：PreviewSearch 浮层为独立组件，随 Phase 3 接线；此处先完成渲染面本身。
 */
import { useMemo, useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import mermaid from 'mermaid';
import { openUrl } from '@bridge/ipc/opener';
import { renderMarkdown, extractImageRoot } from '../../lib/markdown';
import { rewriteImageUrls } from '../../lib/image-resolve';
import { openImageOverlay, type OverlayStrings } from '../../lib/image-overlay';
import { useI18n } from '../../i18n';
import { useSettingsStore } from '../../stores/settings';
import { PreviewSearch, type PreviewSearchHandle } from './PreviewSearch';

export interface PreviewHandle {
  scrollToLine(line: number): void;
  openSearch(): void;
}

export interface PreviewProps {
  source: string;
  filePath?: string;
  skin?: 'default' | 'reading';
  /** 相对路径链接的打开回调（既有实现直接调 files.openPath；由 App/PaneContent 注入）。 */
  onOpenPath?: (path: string) => void;
}

let mermaidIdSeq = 0;

export const Preview = forwardRef<PreviewHandle, PreviewProps>(function Preview(props, ref) {
  const skin = props.skin ?? 'default';
  const hostRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<PreviewSearchHandle | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const { t } = useI18n();
  const previewFitWidth = useSettingsStore((s) => s.previewFitWidth);
  const codeBlockLineNumbers = useSettingsStore((s) => s.codeBlockLineNumbers);
  const theme = useSettingsStore((s) => s.theme);
  const onOpenPathRef = useRef(props.onOpenPath);
  onOpenPathRef.current = props.onOpenPath;
  // filePath 也用 latest-ref：链接点击监听以 [] 挂载一次，闭包会冻结首帧的 props.filePath，
  // 切换当前笔记后会用旧目录解析相对路径。
  const filePathRef = useRef(props.filePath);
  filePathRef.current = props.filePath;

  const html = useMemo(() => {
    const source = props.source || '';
    return rewriteImageUrls(renderMarkdown(source), extractImageRoot(source), props.filePath);
  }, [props.source, props.filePath]);

  // mermaid 主题随 settings.theme（首次 + 变化）。
  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme === 'dark' ? 'dark' : 'default' });
  }, [theme]);

  function overlayStrings(): OverlayStrings {
    return {
      close: t('overlay.close'),
      zoomIn: t('overlay.zoomIn'),
      zoomOut: t('overlay.zoomOut'),
      resetZoom: t('overlay.resetZoom'),
      image: t('overlay.image'),
      diagram: t('overlay.diagram'),
    };
  }

  async function processMermaid() {
    const host = hostRef.current;
    if (!host) return;
    const blocks = host.querySelectorAll('pre > code.language-mermaid');
    for (const block of Array.from(blocks)) {
      const pre = block.parentElement as HTMLElement | null;
      if (!pre || pre.dataset.rendered === '1') continue;
      const code = (block.textContent || '').trim();
      const id = `mmd-${++mermaidIdSeq}`;
      try {
        const { svg } = await mermaid.render(id, code);
        const wrap = document.createElement('div');
        wrap.className = 'mermaid-block';
        wrap.innerHTML = svg;
        pre.replaceWith(wrap);
      } catch (e) {
        const err = document.createElement('pre');
        err.className = 'mermaid-error';
        err.textContent = `Mermaid error: ${(e as Error).message}`;
        pre.replaceWith(err);
      }
    }
  }

  function attachImageOverlayHandlers() {
    const host = hostRef.current;
    if (!host) return;
    const images = host.querySelectorAll('img');
    for (const img of Array.from(images)) {
      if ((img as HTMLElement).dataset.overlayBound === '1') continue;
      (img as HTMLElement).dataset.overlayBound = '1';
      img.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        openImageOverlay({
          source: img,
          title: img.alt || img.getAttribute('src') || undefined,
          strings: overlayStrings(),
        });
      });
    }
    const blocks = host.querySelectorAll('.mermaid-block');
    for (const block of Array.from(blocks)) {
      if ((block as HTMLElement).dataset.overlayBound === '1') continue;
      (block as HTMLElement).dataset.overlayBound = '1';
      block.addEventListener('click', ((e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const svg = block.querySelector('svg');
        if (!svg) return;
        openImageOverlay({ source: svg, strings: overlayStrings() });
      }) as EventListener);
    }
  }

  function handleLinkClick(e: MouseEvent) {
    const anchor = (e.target as HTMLElement).closest('a');
    if (!anchor) return;
    if (anchor.classList.contains('md-wikilink')) {
      const target = anchor.getAttribute('data-wikilink-target') || '';
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('eidon:wiki-open', { detail: { target } }));
      }
      return;
    }
    const href = anchor.getAttribute('href');
    if (!href) return;
    if (href.startsWith('#')) return;
    e.preventDefault();
    e.stopPropagation();
    if (/^(https?|mailto|tel):/i.test(href)) {
      openUrl(href).catch((err) => console.warn('[Preview] openUrl failed:', href, err));
      return;
    }
    const filePath = filePathRef.current;
    if (filePath) {
      const sep = filePath.lastIndexOf('/');
      const dir = sep >= 0 ? filePath.substring(0, sep + 1) : '';
      const cleaned = href.replace(/^\.\//, '');
      const resolved = dir + cleaned;
      onOpenPathRef.current?.(resolved);
    }
  }

  // html 变化后：渲染 mermaid + 绑定图片浮层（渲染后同步执行）。
  useEffect(() => {
    void processMermaid().then(() => attachImageOverlayHandlers());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  // 挂载：绑定链接点击拦截；卸载移除。
  useEffect(() => {
    const host = hostRef.current;
    const onClick = (e: Event) => handleLinkClick(e as MouseEvent);
    host?.addEventListener('click', onClick);
    return () => host?.removeEventListener('click', onClick);
  }, []);

  useImperativeHandle(ref, (): PreviewHandle => ({
    openSearch() {
      setSearchOpen(true);
      setTimeout(() => searchRef.current?.focusInput(), 0);
    },
    scrollToLine(line) {
      const article = hostRef.current;
      if (!article) return;
      const container = article.parentElement as HTMLElement | null;
      if (!container) return;
      const nodes = Array.from(article.querySelectorAll<HTMLElement>('[data-source-line]'));
      if (nodes.length === 0) return;
      let lo = 0;
      let hi = nodes.length - 1;
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const n = Number(nodes[mid].getAttribute('data-source-line') || 0);
        if (n <= line) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      const target = nodes[best];
      const offset = target.offsetTop - 8;
      container.scrollTo({ top: offset, behavior: 'smooth' });
    },
  }));

  const articleClass = [
    'preview-content',
    previewFitWidth && skin !== 'reading' ? 'preview-content--fit' : '',
    skin === 'reading' ? 'preview-content--reading' : '',
    codeBlockLineNumbers ? 'cb-numbered-on' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`preview-host${skin === 'reading' ? ' preview-host--reading' : ''}`}>
      {searchOpen && hostRef.current && (
        <PreviewSearch ref={searchRef} container={hostRef.current} onClose={() => setSearchOpen(false)} />
      )}
      <article ref={hostRef} className={articleClass} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
});
