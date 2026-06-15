/**
 * cloudSync store（Zustand v5；从 Pinia 1:1 迁移）。云文件夹检测 +
 * 跨设备会话恢复。包裹 `cloud_folder_detect` / `session_*` / `device_id_*` 命令。
 */
import { create } from 'zustand';
import { invoke } from '../../core/bridge/tauri';

export type CloudProvider = 'none' | 'icloud' | 'dropbox' | 'onedrive' | 'google_drive';

export interface CloudFolderInfo {
  provider: CloudProvider;
  label: string;
}

export interface SessionTab {
  file_path: string | null;
  file_name: string;
  cursor_line: number | null;
  cursor_col: number | null;
  rel_path?: string | null;
}

export interface SessionPayload {
  device_id: string;
  device_label: string;
  saved_at: number;
  active_index: number;
  tabs: SessionTab[];
}

export interface SiblingSession {
  device_id: string;
  device_label: string;
  saved_at: number;
  tab_count: number;
}

interface State {
  deviceId: string | null;
  cloud: CloudFolderInfo;
  siblings: SiblingSession[];
  promptedSessionFor: string | null;
}

interface Actions {
  isInCloudFolder(): boolean;
  freshestSibling(): SiblingSession | null;
  ensureDeviceId(): Promise<string>;
  refresh(folder: string | null): Promise<void>;
  saveSession(folder: string, payload: SessionPayload): Promise<void>;
  loadSession(folder: string, deviceId: string): Promise<SessionPayload | null>;
  markPrompted(folder: string): void;
}

export const useCloudSyncStore = create<State & Actions>()((set, get) => ({
  deviceId: null,
  cloud: { provider: 'none', label: '' },
  siblings: [],
  promptedSessionFor: null,

  isInCloudFolder() {
    return get().cloud.provider !== 'none';
  },
  freshestSibling() {
    return get().siblings[0] ?? null;
  },

  async ensureDeviceId() {
    const existing = get().deviceId;
    if (existing) return existing;
    const id = await invoke<string>('device_id_get_or_create');
    set({ deviceId: id });
    return id;
  },

  async refresh(folder) {
    if (!folder) {
      set({ cloud: { provider: 'none', label: '' }, siblings: [] });
      return;
    }
    set({ cloud: await invoke<CloudFolderInfo>('cloud_folder_detect', { folder }) });
    const id = await get().ensureDeviceId();
    set({ siblings: await invoke<SiblingSession[]>('session_list_others', { folder, ourDeviceId: id }) });
  },

  async saveSession(folder, payload) {
    await invoke('session_save', { folder, payload });
  },

  async loadSession(folder, deviceId) {
    return await invoke<SessionPayload | null>('session_load', { folder, deviceId });
  },

  markPrompted(folder) {
    set({ promptedSessionFor: folder });
  },
}));
