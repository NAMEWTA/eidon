/**
 * FilePropertiesPanel — Markdown 文件的「文件属性」面板。
 *
 * 与 NodePropertiesPanel（目录节点 `.node/node.json` 的强类型字段）平行：
 * 这里面向**当前打开的 md 文件**，把 YAML frontmatter 当作可编辑属性呈现。
 *  - 通用字段（title / tags / created）固定在最上方；
 *  - 其余 frontmatter 键作为「扩展字段」动态渲染。
 * 保存/快捷键：合并回 data → `stringifyFrontMatter` 拼回全文 → `setContent` 写标签内容
 * → `saveActive()` 写入磁盘（属性面板内 Cmd+S / Ctrl+S 同样触发）。复用 NodePropertiesPanel
 * 的 `node-props*` 样式，附加 `.file-props` 修饰类。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTabsStore } from '../../stores/tabs';
import { useToastsStore } from '../../stores/toasts';
import { useFiles } from '../../hooks/useFiles';
import { eidonInvoke } from '@bridge/ipc';
import { useI18n } from '../../i18n';
import {
  splitFrontMatter,
  stringifyFrontMatter,
  toTagsArray,
  displayExtraValue,
  nowISO,
  UNIVERSAL_KEYS,
} from '../../lib/frontmatter';
import { Icon } from '../shared/Icons';
import { TagInput } from '../shared/TagInput';

interface FilePropertiesPanelProps {
  onClose?: () => void;
}

interface ExtraField {
  key: string;
  text: string;
  /** 标量值（string/number/boolean/null）可编辑；数组/对象只读，避免误改结构。 */
  editable: boolean;
  original: unknown;
}

/**
 * 把 js-yaml 可能解析出的 Date 对象或字符串统一成 `YYYY-MM-DD HH:mm:ss`。
 * 兼容旧格式（仅日期 `YYYY-MM-DD`）及 ISO 字符串。
 */
function normalizeDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) {
    const d = value;
    const pad2 = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }
  return String(value).trim();
}

/** 标题 → 安全文件名（去掉路径分隔符与非法字符、折叠空白）。 */
function sanitizeFileName(input: string): string {
  return input
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function coerceExtra(text: string, original: unknown): unknown {
  if (typeof original === 'number') {
    const n = Number(text);
    return Number.isFinite(n) ? n : original;
  }
  if (typeof original === 'boolean') {
    if (text === 'true') return true;
    if (text === 'false') return false;
    return original;
  }
  return text;
}

export function FilePropertiesPanel({ onClose }: FilePropertiesPanelProps) {
  const { t } = useI18n();
  const files = useFiles();

  // 只订阅身份字段（皆为基础值，不含 content），编辑器键入正文时本面板不重渲；
  // 正文内容在 seed / save 时按需 getState。
  const activeId = useTabsStore((s) => s.activeId);
  const fileName = useTabsStore((s) => s.activeTab()?.fileName ?? '');
  const filePath = useTabsStore((s) => s.activeTab()?.filePath ?? '');
  const language = useTabsStore((s) => s.activeTab()?.language ?? 'plaintext');
  const kind = useTabsStore((s) => s.activeTab()?.kind ?? 'text');

  const isMarkdown = activeId !== '' && kind === 'text' && language === 'markdown';

  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [created, setCreated] = useState('');
  const [extras, setExtras] = useState<ExtraField[]>([]);
  const [saving, setSaving] = useState(false);

  // 容器 ref：用于在捕获阶段拦截 Cmd+S / Ctrl+S，先合并属性再写入磁盘。
  const containerRef = useRef<HTMLDivElement>(null);

  // 切换文件（activeId 变化）时从其 frontmatter 重新播种表单；键入正文不触发。
  useEffect(() => {
    const current = useTabsStore.getState().activeTab();
    if (!current || (current.kind ?? 'text') !== 'text' || current.language !== 'markdown') {
      setTitle('');
      setTags([]);
      setCreated('');
      setExtras([]);
      return;
    }
    const { data } = splitFrontMatter(current.content);
    setTitle(typeof data.title === 'string' ? data.title : data.title != null ? String(data.title) : '');
    setTags(toTagsArray(data.tags));
    setCreated(normalizeDate(data.created));
    setExtras(
      Object.keys(data)
        .filter((k) => !UNIVERSAL_KEYS.has(k))
        .map((k) => {
          const v = data[k];
          const editable = v === null || ['string', 'number', 'boolean'].includes(typeof v);
          return { key: k, text: displayExtraValue(v), editable, original: v };
        }),
    );
  }, [activeId]);

  function updateExtra(index: number, text: string) {
    setExtras((cur) => cur.map((e, i) => (i === index ? { ...e, text } : e)));
  }

  /**
   * 合并当前表单值 → frontmatter → 写回 tab content → 写入磁盘。
   * 同时被「保存」按钮和 Cmd+S / Ctrl+S 快捷键复用。
   */
  const save = useCallback(async function save() {
    const current = useTabsStore.getState().activeTab();
    if (!current) return;
    setSaving(true);
    try {
      const { body } = splitFrontMatter(current.content);
      const now = nowISO();
      const data: Record<string, unknown> = {};
      if (title.trim()) data.title = title.trim();
      if (tags.length) data.tags = tags;

      // 创建时间：已有值保留；无值则取当前时刻（首次初始化）
      const existingCreated = created.trim();
      data.created = existingCreated || now;

      for (const e of extras) {
        if (!e.key.trim()) continue;
        data[e.key] = e.editable ? coerceExtra(e.text, e.original) : e.original;
      }
      const next = stringifyFrontMatter(data, body);
      useTabsStore.getState().setContent(current.id, next);
      setCreated(normalizeDate(data.created));

      // 写入磁盘（未保存文件弹出「另存为」对话框；成功/取消由 saveTab 内部 toast）
      await files.saveActive();

      // 标题与文件名保持一致：标题变化时同步重命名 md 文件（仅已落盘文件）。
      const saved = useTabsStore.getState().activeTab();
      const fp = saved?.filePath;
      const newTitle = title.trim();
      if (saved && fp && newTitle) {
        const slash = Math.max(fp.lastIndexOf('/'), fp.lastIndexOf('\\'));
        const dir = slash >= 0 ? fp.slice(0, slash + 1) : '';
        const curName = fp.slice(slash + 1);
        const dot = curName.lastIndexOf('.');
        const ext = dot > 0 ? curName.slice(dot) : '.md';
        const stem = dot > 0 ? curName.slice(0, dot) : curName;
        const safe = sanitizeFileName(newTitle);
        if (safe && safe !== stem) {
          const target = `${dir}${safe}${ext}`;
          try {
            await eidonInvoke('editor:rename', { from: fp, to: target });
            // 同步打开中的 tab + 通知文件树刷新（fs_rename 已连带处理 per-file 资产目录）。
            useTabsStore.setState({
              tabs: useTabsStore.getState().tabs.map((tb) =>
                tb.id === saved.id ? { ...tb, filePath: target, fileName: `${safe}${ext}` } : tb,
              ),
            });
            window.dispatchEvent(new CustomEvent('eidon:saved', { detail: { filePath: target } }));
          } catch (error) {
            useToastsStore.getState().error(String(error));
          }
        }
      }
    } catch (error) {
      useToastsStore.getState().error(String(error));
    } finally {
      setSaving(false);
    }
  }, [title, tags, created, extras, files]);

  // 用 ref 持有最新 save，供原生事件监听器读取（避免闭包陈旧）。
  const saveRef = useRef(save);
  saveRef.current = save;

  // 在捕获阶段拦截 Cmd+S / Ctrl+S，先合并属性再写盘，阻止全局快捷键重复保存。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        saveRef.current();
      }
    };
    el.addEventListener('keydown', handler, true); // capture 阶段，先于 window 全局 handler
    return () => el.removeEventListener('keydown', handler, true);
  }, []);

  return (
    <div className="node-props file-props" ref={containerRef}>
      <header className="node-props__head">
        <span className="node-props__title">{t('fileProps.title')}</span>
        {onClose && (
          <button className="rs-pane-close" type="button" title="Close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        )}
      </header>

      {!isMarkdown ? (
        <div className="node-props__empty">{t('fileProps.empty')}</div>
      ) : (
        <div className="node-props__body">
          <section className="node-props__identity">
            <span className="node-props__glyph file-props__glyph">
              <Icon name="file" size={16} />
            </span>
            <span className="node-props__identity-text">
              <strong>{fileName}</strong>
              <small>{filePath || t('fileProps.unsaved')}</small>
            </span>
          </section>

          <section className="node-props__fields">
            <label className="node-props__field">
              <span className="node-props__field-label">
                <span className="node-props__field-type">T</span>
                {t('fileProps.field.title')}
              </span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={fileName} />
            </label>

            <label className="node-props__field">
              <span className="node-props__field-label">
                <span className="node-props__field-type">#</span>
                {t('fileProps.field.tags')}
              </span>
              <TagInput value={tags} onChange={setTags} placeholder={t('fileProps.tagsPlaceholder')} />
            </label>

            <label className="node-props__field">
              <span className="node-props__field-label">
                <span className="node-props__field-type">D</span>
                {t('fileProps.field.created')}
              </span>
              <input type="text" value={created} onChange={(e) => setCreated(e.target.value)} placeholder="YYYY-MM-DD HH:mm:ss" />
            </label>
          </section>

          {extras.length > 0 && (
            <section className="node-props__fields file-props__extras">
              <h4>{t('fileProps.extras')}</h4>
              {extras.map((e, i) => (
                <label key={e.key} className="node-props__field">
                  <span className="node-props__field-label">
                    <span className="node-props__field-type">{e.editable ? 'F' : '·'}</span>
                    {e.key}
                  </span>
                  <input
                    type="text"
                    value={e.text}
                    disabled={!e.editable}
                    onChange={(ev) => updateExtra(i, ev.target.value)}
                  />
                </label>
              ))}
            </section>
          )}

          <button type="button" className="node-props__save" disabled={saving} onClick={() => { save(); }}>
            {saving ? t('fileProps.saving') : t('fileProps.save')}
          </button>
        </div>
      )}
    </div>
  );
}

export default FilePropertiesPanel;
