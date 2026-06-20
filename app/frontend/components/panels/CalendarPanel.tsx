/**
 * CalendarPanel.tsx — 日历 + 当日代办（左抽屉视图）。
 *
 * 上半：react-day-picker v10 日历（中文/英文 locale 随 settings.language），
 *   月份切换时拉取该月已有日记集打点；有笔记的日期下方打小圆点。
 * 下半：选中日的代办区 —— 解析 `- [ ]` / `- [x]` 为可交互 checkbox，
 *   勾选/取消 → 改写文件落盘；若该文件在 tab 中打开则同步 useTabsStore。
 *
 * 无 workspace 时显示空态提示。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker, type NavProps } from 'react-day-picker';
import { enUS, zhCN } from 'date-fns/locale';
import { Icon } from '../shared/Icons';
import { TodoRow } from './TodoRow';
import { useSettingsStore } from '../../stores/settings';
import { useWorkspaceStore } from '../../stores/workspace';
import { useTabsStore } from '../../stores/tabs';
import { useTodosStore } from '../../stores/todos';
import { useI18n } from '../../i18n';
import { openDateNote, resolveDailyPath } from '../../hooks/useDailyNotes';
import { parseTodos, toggleTodo } from '../../lib/daily-todos';
import { eidonInvoke } from '@bridge/ipc';
import { absoluteWorkspacePath, calendarMonthPath, calendarNotePath } from '@shared/utils';
import type { TodoItem } from '../../lib/daily-todos';

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 月份导航条（模块级，避免内联定义导致 DayPicker 每次重渲染都换 Nav 引用而 remount）。
 * prev / next 月份切换 + 右侧「回到今天」icon 按钮（点击切到今天并打开/创建今日笔记）。
 * 额外数据经 actions ref 注入，故组件本体可保持稳定引用。
 */
function CalendarNavView({
  onPreviousClick,
  onNextClick,
  previousMonth,
  nextMonth,
  actions,
}: NavProps & { actions: React.MutableRefObject<{ onToday: () => void; todayLabel: string; prevMonthLabel: string; nextMonthLabel: string }> }) {
  return (
    <div className="calendar-panel__rdp-nav">
      <button type="button" onClick={onPreviousClick} disabled={!previousMonth} aria-label={actions.current.prevMonthLabel}>
        <Icon name="chevron-left" size={14} />
      </button>
      <button type="button" onClick={onNextClick} disabled={!nextMonth} aria-label={actions.current.nextMonthLabel}>
        <Icon name="chevron-right" size={14} />
      </button>
      <button
        type="button"
        className="calendar-panel__rdp-nav-today"
        onClick={(e) => { e.stopPropagation(); actions.current.onToday(); }}
        title={actions.current.todayLabel}
        aria-label={actions.current.todayLabel}
      >
        <Icon name="calendar" size={13} />
      </button>
    </div>
  );
}

export function CalendarPanel() {
  const { t } = useI18n();
  const currentFolder = useWorkspaceStore((s) => s.currentFolder);
  const language = useSettingsStore((s) => s.language);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [monthDate, setMonthDate] = useState<Date>(() => new Date());
  const [notesInMonth, setNotesInMonth] = useState<Set<string>>(new Set());
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [dayContent, setDayContent] = useState<string>('');
  const [loadingTodos, setLoadingTodos] = useState(false);

  // ---- 节点级待办（来自 .node/todos.json，按截止日匹配当前选中日期）----
  const storeTodos = useTodosStore((s) => s.items);
  const nodeTodosForDate = useMemo(() => {
    const dk = dateKey(selectedDate);
    return storeTodos.filter((a) => {
      if (!a.item.due) return false;
      return dateKey(new Date(a.item.due)) === dk;
    });
  }, [storeTodos, selectedDate]);

  const locale = language === 'zh' ? zhCN : enUS;

  /** 把 workspace 相对路径转绝对路径（仅在 workspace 已打开时有效）。 */
  const absPath = useCallback(
    (rel: string) => (currentFolder ? absoluteWorkspacePath(currentFolder, rel) : rel),
    [currentFolder],
  );

  // ---- 加载某日笔记内容 ----
  const loadDayContent = useCallback(async (date: Date) => {
    if (!currentFolder) { setDayContent(''); setTodos([]); return; }
    setLoadingTodos(true);
    const rel = calendarNotePath(date);
    const abs = absPath(rel);
    try {
      const result = await eidonInvoke('editor:readFile', { path: abs });
      if (result === null) {
        setDayContent('');
        setTodos([]);
      } else {
        const content = result.content;
        setDayContent(content);
        setTodos(parseTodos(content));
      }
    } catch {
      setDayContent('');
      setTodos([]);
    } finally {
      setLoadingTodos(false);
    }
  }, [currentFolder, absPath]);

  // ---- 月份切换时拉取该月已有日记 ----
  const refreshMonthNotes = useCallback(async (d: Date) => {
    if (!currentFolder) return;
    const monthRel = calendarMonthPath(d);
    const abs = absPath(monthRel);
    try {
      const entries = await eidonInvoke('editor:listDir', { path: abs, includeHidden: false });
      const notes = new Set<string>();
      for (const entry of entries) {
        const m = /^(\d{4}-\d{2}-\d{2})\.md$/.exec(entry.name);
        if (m) notes.add(m[1]);
      }
      setNotesInMonth(notes);
    } catch {
      // 月目录不存在 → 空集
      setNotesInMonth(new Set());
    }
  }, [currentFolder, absPath]);

  // 选中日期或 workspace 变化 → 加载当日内容
  useEffect(() => {
    void loadDayContent(selectedDate);
  }, [selectedDate, loadDayContent]);

  // 月份变化 → 刷新打点
  useEffect(() => {
    void refreshMonthNotes(monthDate);
  }, [monthDate, refreshMonthNotes]);

  // ---- 监听文件保存事件：刷新当日代办与打点 ----
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const monthDateRef = useRef(monthDate);
  monthDateRef.current = monthDate;

  useEffect(() => {
    function onSaved(e: Event) {
      const filePath = (e as CustomEvent<{ filePath: string }>).detail?.filePath;
      if (!filePath || !currentFolder) return;
      const dk = dateKey(selectedDateRef.current);
      if (filePath.includes(dk)) {
        void loadDayContent(selectedDateRef.current);
        void refreshMonthNotes(monthDateRef.current);
      }
    }
    window.addEventListener('eidon:saved', onSaved);
    return () => window.removeEventListener('eidon:saved', onSaved);
  }, [currentFolder, loadDayContent, refreshMonthNotes]);

  // watcher 触发文件变更
  useEffect(() => {
    function onChanged(e: Event) {
      const detail = (e as CustomEvent<{ paths?: string[] }>).detail;
      if (!detail?.paths || !currentFolder) return;
      const dk = dateKey(selectedDateRef.current);
      if (detail.paths.some((p) => p.includes(dk))) {
        void loadDayContent(selectedDateRef.current);
        void refreshMonthNotes(monthDateRef.current);
      }
    }
    window.addEventListener('eidon:file-changed', onChanged);
    return () => window.removeEventListener('eidon:file-changed', onChanged);
  }, [currentFolder, loadDayContent, refreshMonthNotes]);

  // ---- 代办勾选 ----
  async function handleTodoToggle(todo: TodoItem) {
    const newContent = toggleTodo(dayContent, todo.line);
    setDayContent(newContent);
    setTodos(parseTodos(newContent));

    const rel = calendarNotePath(selectedDate);
    const abs = absPath(rel);
    try {
      const bytes = Array.from(new TextEncoder().encode(newContent));
      await eidonInvoke('editor:writeBinaryFile', { path: abs, data: bytes });
      window.dispatchEvent(new CustomEvent('eidon:saved', { detail: { filePath: abs } }));

      // 如果该文件在 tab 中打开，同步 tabs store（同时更新 savedContent，
      // 避免文件监视器误判为"外部修改"弹出 FileChangedDialog）。
      const dk = dateKey(selectedDate);
      useTabsStore.setState((s) => ({
        tabs: s.tabs.map((t) =>
          t.filePath && t.filePath.includes(dk) && t.filePath.endsWith('.md')
            ? { ...t, content: newContent, savedContent: newContent }
            : t,
        ),
      }));
    } catch (e) {
      console.warn('Failed to save todo toggle:', e);
    }
  }

  // ---- 创建/打开日记（创建后自动加载内容） ----
  async function handleCreateOrOpen(date: Date) {
    await openDateNote(date);
    // openDateNote 会写文件并触发 eidon:saved，但为确保即时刷新再手动 load 一次
    await loadDayContent(date);
    await refreshMonthNotes(date);
  }

  // ---- 日期选择（仅选中，不创建） ----
  function handleDaySelect(date: Date) {
    setSelectedDate(date);
    if (date.getMonth() !== monthDate.getMonth() || date.getFullYear() !== monthDate.getFullYear()) {
      setMonthDate(date);
    }
  }

  // ---- 双击某日 = 打开/创建当日笔记（与头部按钮同效）----
  const lastClickRef = useRef<{ key: string; t: number } | null>(null);
  function handleDayClick(date: Date) {
    const k = dateKey(date);
    const now = Date.now();
    const prev = lastClickRef.current;
    if (prev && prev.key === k && now - prev.t < 400) {
      lastClickRef.current = null;
      void handleCreateOrOpen(date);
      return;
    }
    lastClickRef.current = { key: k, t: now };
  }

  // ---- 回到今天：切到今天 + 打开/创建今日笔记 ----
  function goToToday() {
    const today = new Date();
    setSelectedDate(today);
    setMonthDate(today);
    void handleCreateOrOpen(today);
  }

  // Nav 的额外动作经 ref 注入，使传给 DayPicker 的组件引用恒稳定（否则每次重渲染换引用会 remount 导航条）。
  const navActions = useRef({ onToday: goToToday, todayLabel: t('calendar.today'), prevMonthLabel: t('calendar.prevMonth'), nextMonthLabel: t('calendar.nextMonth') });
  navActions.current = { onToday: goToToday, todayLabel: t('calendar.today'), prevMonthLabel: t('calendar.prevMonth'), nextMonthLabel: t('calendar.nextMonth') };
  const NavComponent = useMemo(
    () => (props: NavProps) => <CalendarNavView {...props} actions={navActions} />,
    [],
  );

  const dateLabel = useMemo(
    () => selectedDate.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    }),
    [selectedDate, language],
  );

  const isToday = sameDay(selectedDate, new Date());
  const hasNote = dayContent.length > 0;
  const resolved = resolveDailyPath(selectedDate);

  // ---- 自定义 DayPicker classNames ----
  const rdpClassNames = {
    root: 'calendar-panel__rdp',
    month: 'calendar-panel__rdp-month',
    month_caption: 'calendar-panel__rdp-caption',
    nav: 'calendar-panel__rdp-nav',
    weekdays: 'calendar-panel__rdp-weekdays',
    weekday: 'calendar-panel__rdp-weekday',
    weeks: 'calendar-panel__rdp-weeks',
    day: 'calendar-panel__rdp-day',
    day_button: 'calendar-panel__rdp-day-btn',
    selected: 'calendar-panel__rdp-selected',
    today: 'calendar-panel__rdp-today',
    outside: 'calendar-panel__rdp-outside',
    disabled: 'calendar-panel__rdp-disabled',
    hidden: 'calendar-panel__rdp-hidden',
  };

  // days with notes — 传给 DayPicker 的 modifiers
  const hasNoteModifier = useMemo(
    () => ({
      hasNote: Array.from(notesInMonth).map((d) => new Date(d + 'T00:00:00')),
    }),
    [notesInMonth],
  );
  const hasNoteClass = { hasNote: 'calendar-panel__rdp-has-note' };

  if (!currentFolder) {
    return (
      <div className="calendar-panel">
        <div className="calendar-panel__empty">{t('daily.noWorkspace')}</div>
      </div>
    );
  }

  return (
    <div className="calendar-panel">
      {/* ---- 日历 ---- */}
      <div className="calendar-panel__picker">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={(d) => { if (d) handleDaySelect(d); }}
          onDayClick={(d) => handleDayClick(d)}
          month={monthDate}
          onMonthChange={(d) => setMonthDate(d)}
          locale={locale}
          weekStartsOn={language === 'zh' ? 1 : 0}
          classNames={rdpClassNames}
          modifiers={hasNoteModifier}
          modifiersClassNames={hasNoteClass}
          components={{ Nav: NavComponent }}
        />
      </div>

      {/* ---- 代办区 ---- */}
      <div className="calendar-panel__todos">
        <header className="calendar-panel__todos-head">
          <div>
            <strong className="calendar-panel__todos-date">
              {isToday ? t('tags.todayBtn') : dateLabel}
            </strong>
            {isToday && <small className="calendar-panel__todos-sub">{dateLabel}</small>}
          </div>
          <button
            className="calendar-panel__open-btn"
            onClick={() => void handleCreateOrOpen(selectedDate)}
            title={hasNote ? t('daily.openSelected') : t('calendar.createNote')}
          >
            <Icon name={hasNote ? 'file-pen' : 'new-text'} size={14} />
            {hasNote ? t('daily.openSelected') : t('calendar.createNote')}
          </button>
        </header>

        <div className="calendar-panel__todos-body">
          {/* ---- 笔记待办（Markdown - [ ] 解析） ---- */}
          <div className="calendar-panel__section-label">{t('calendar.noteTodos')}</div>
          {loadingTodos ? (
            <div className="calendar-panel__todos-empty">{t('calendar.loading')}</div>
          ) : !hasNote ? (
            <div className="calendar-panel__todos-empty">
              <p>{t('calendar.noNote')}</p>
              <button
                className="calendar-panel__create-btn"
                onClick={() => void handleCreateOrOpen(selectedDate)}
              >
                <Icon name="new" size={14} /> {t('calendar.createNote')}
              </button>
            </div>
          ) : todos.length === 0 ? (
            <div className="calendar-panel__todos-empty">{t('calendar.noTodos')}</div>
          ) : (
            <ul className="calendar-panel__todo-list">
              {todos.map((todo) => (
                <li
                  key={todo.line}
                  className={`calendar-panel__todo-item${todo.checked ? ' calendar-panel__todo--done' : ''}`}
                  style={{ paddingLeft: `${8 + todo.indent * 12}px` }}
                >
                  <label className="calendar-panel__todo-label">
                    <input
                      type="checkbox"
                      checked={todo.checked}
                      onChange={() => void handleTodoToggle(todo)}
                      className="calendar-panel__todo-check"
                    />
                    <span className="calendar-panel__todo-text">{todo.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {/* ---- 待办事项（节点级 .node/todos.json，按截止日匹配） ---- */}
          <div className="calendar-panel__section-label">{t('calendar.nodeTodos')}</div>
          {nodeTodosForDate.length === 0 ? (
            <div className="calendar-panel__todos-empty">{t('calendar.noNodeTodos')}</div>
          ) : (
            <ul className="todos-list">
              {nodeTodosForDate.map((a) => (
                <TodoRow key={a.item.id} agg={a} />
              ))}
            </ul>
          )}
        </div>

        {resolved && (
          <footer className="calendar-panel__path" title={resolved.fullPath}>
            <Icon name="folder" size={12} />
            <span>{resolved.relPath}</span>
          </footer>
        )}
      </div>
    </div>
  );
}

export default CalendarPanel;
