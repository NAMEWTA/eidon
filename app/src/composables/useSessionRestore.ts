/**
 * v2.6.1 — 跨设备会话保存/恢复（从 Vue composable 迁移为 React hook）。
 *
 * 工作区变化 → 刷新云信息 + 兄弟会话；最新兄弟比本地新且本运行未提示过 →
 * dispatch `eidon:session-restore-available` 供 App 弹对话框。tab/active 变化 →
 * 防抖 5s 写 session.<id>.json（只存标签元数据，不含内容）。watch → store.subscribe。
 */
import { useCloudSyncStore, type SessionPayload, type SessionTab } from '../stores/cloudSync';
import { useTabsStore } from '../stores/tabs';
import { useWorkspaceStore } from '../stores/workspace';

function deviceLabel(): string {
  const ua = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData;
  if (ua && ua.platform) return String(ua.platform);
  return navigator.platform || 'Unknown device';
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedAt = 0;
let started = false;

function workspaceRelative(filePath: string, workspaceRoot: string): string | null {
  if (!filePath || !workspaceRoot) return null;
  const norm = (s: string) => s.replace(/\\/g, '/').replace(/\/+$/, '');
  const root = norm(workspaceRoot);
  const fp = norm(filePath);
  const ci = /^[a-zA-Z]:\//.test(root);
  const rootForCmp = ci ? root.toLowerCase() : root;
  const fpForCmp = ci ? fp.toLowerCase() : fp;
  if (!fpForCmp.startsWith(rootForCmp + '/') && fpForCmp !== rootForCmp) return null;
  return fp.slice(root.length + 1) || null;
}

function snapshot(): SessionPayload | null {
  const cloud = useCloudSyncStore.getState();
  const tabs = useTabsStore.getState();
  if (!cloud.deviceId) return null;
  const root = useWorkspaceStore.getState().currentFolder || '';
  const sessionTabs: SessionTab[] = tabs.tabs.map((t) => ({
    file_path: t.filePath ?? null,
    file_name: t.fileName,
    cursor_line: null,
    cursor_col: null,
    rel_path: t.filePath ? workspaceRelative(t.filePath, root) : null,
  }));
  return {
    device_id: cloud.deviceId,
    device_label: deviceLabel(),
    saved_at: Math.floor(Date.now() / 1000),
    active_index: Math.max(0, tabs.tabs.findIndex((t) => t.id === tabs.activeId)),
    tabs: sessionTabs,
  };
}

async function persist(folder: string): Promise<void> {
  const payload = snapshot();
  if (!payload) return;
  if (Date.now() / 1000 - lastSavedAt < 2) return;
  try {
    await useCloudSyncStore.getState().saveSession(folder, payload);
    lastSavedAt = payload.saved_at;
  } catch (e) {
    console.warn('session_save failed', e);
  }
}

function debouncedPersist(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const folder = useWorkspaceStore.getState().currentFolder;
    if (folder) void persist(folder);
  }, 5000);
}

async function maybeOfferRestore(folder: string): Promise<void> {
  const cloud = useCloudSyncStore.getState();
  await cloud.refresh(folder);
  if (useCloudSyncStore.getState().promptedSessionFor === folder) return;
  const sibling = useCloudSyncStore.getState().freshestSibling();
  if (!sibling) return;
  if (sibling.saved_at <= lastSavedAt + 60) return;
  useCloudSyncStore.getState().markPrompted(folder);
  window.dispatchEvent(new CustomEvent('eidon:session-restore-available', { detail: { folder, sibling } }));
}

function start(): void {
  if (started) return;
  started = true;
  void useCloudSyncStore.getState().ensureDeviceId();

  // 工作区变化（含初始）→ 云探测 + 兄弟检查。
  let lastFolder: string | null | undefined = undefined;
  const runFolder = () => {
    const f = useWorkspaceStore.getState().currentFolder;
    if (f === lastFolder) return;
    lastFolder = f;
    if (f) void maybeOfferRestore(f);
    else useCloudSyncStore.setState({ cloud: { provider: 'none', label: '' } });
  };
  useWorkspaceStore.subscribe(() => runFolder());
  runFolder(); // immediate

  // tab 列表/活动标签变化 → 防抖写会话文件。
  let lastTabsKey = '';
  useTabsStore.subscribe(() => {
    const s = useTabsStore.getState();
    const key = `${s.tabs.length}|${s.activeId}`;
    if (key === lastTabsKey) return;
    lastTabsKey = key;
    debouncedPersist();
  });
}

export function useSessionRestore() {
  return { start };
}
