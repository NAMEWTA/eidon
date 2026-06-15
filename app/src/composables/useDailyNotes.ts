/**
 * 每日笔记（日历整理箱版）。打开/创建任意日期的日记。
 *
 * 路径与命名**固定**走三层【节点】日历规则（不可配置，见 core/nodes 日历助手）：
 *   `<workspace>/_日历/YYYY/YYYY-MM/YYYY-MM-DD.md`
 * 打开前先经 nodes store 确保 L1 `_日历`/L2 年/L3 月 节点链存在（幂等）；
 * 文件缺失则按用户「日记模板」（或内置 defaultDailyTemplate）物化后再打开。
 * 命令式函数（由日历面板/命令面板/快捷键调用），读 store 用 getState。
 */
import { invoke } from '../../core/bridge/tauri';
import { absoluteWorkspacePath } from '../../core/bridge/file';
import { calendarNotePath } from '../../core/nodes';
import { openPath } from './useFiles';
import { useWorkspaceStore } from '../stores/workspace';
import { useSettingsStore } from '../stores/settings';
import { useNodesStore } from '../stores/nodes';
import { useToastsStore } from '../stores/toasts';
import { applyTemplate, defaultDailyTemplate } from '../lib/daily-notes';

function shiftDate(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 日记 wikilink 词干（{{previous}}/{{next}} 用）：固定 ISO 日期。 */
function dateStem(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await invoke('read_file', { path });
    return true;
  } catch {
    return false;
  }
}

export interface ResolvedDailyPath {
  /** workspace 相对路径（POSIX 分隔）。 */
  relPath: string;
  filename: string;
  /** 绝对路径（按平台分隔符拼接）。 */
  fullPath: string;
}

export function resolveDailyPath(date: Date): ResolvedDailyPath | null {
  const ws = useWorkspaceStore.getState().currentFolder;
  if (!ws) return null;
  const relPath = calendarNotePath(date);
  return {
    relPath,
    filename: relPath.split('/').pop() ?? relPath,
    fullPath: absoluteWorkspacePath(ws, relPath),
  };
}

export async function openDateNote(date: Date): Promise<void> {
  const toasts = useToastsStore.getState();
  const resolved = resolveDailyPath(date);
  if (!resolved) {
    toasts.warning('Open a folder first to use daily notes.');
    return;
  }
  const { fullPath, filename } = resolved;

  // 先确保日历节点链存在（幂等），保证日记永远落在合法 L3 内。
  try {
    await useNodesStore.getState().ensureCalendarMonth(date);
  } catch (e) {
    toasts.error(`Calendar structure init failed: ${e}`);
    return;
  }

  if (await fileExists(fullPath)) {
    await openPath(fullPath);
    return;
  }
  const settings = useSettingsStore.getState();
  const tmpl = settings.dailyNotesTemplate.trim()
    ? settings.dailyNotesTemplate
    : defaultDailyTemplate(settings.language === 'zh' ? 'zh' : 'en');
  const body = applyTemplate(tmpl, date, dateStem(shiftDate(date, -1)), dateStem(shiftDate(date, 1)));
  try {
    const bytes = Array.from(new TextEncoder().encode(body));
    await invoke('write_binary_file', { path: fullPath, data: bytes });
  } catch (e) {
    useToastsStore.getState().error(`Failed to create ${filename}: ${e}`);
    return;
  }
  window.dispatchEvent(new CustomEvent('eidon:saved', { detail: { filePath: fullPath } }));
  await openPath(fullPath);
}

export async function openTodayNote(): Promise<void> {
  return openDateNote(new Date());
}
export async function openYesterday(): Promise<void> {
  return openDateNote(shiftDate(new Date(), -1));
}
export async function openTomorrow(): Promise<void> {
  return openDateNote(shiftDate(new Date(), 1));
}

export function useDailyNotes() {
  return { openDateNote, openTodayNote, openYesterday, openTomorrow, resolveDailyPath };
}
