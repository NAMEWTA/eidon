/**
 * cloudSync store（Zustand v5）。云文件夹检测 +
 * 跨设备会话恢复。包裹 `cloud_folder_detect` / `session_*` / `device_id_*` 命令。
 */
import { create } from 'zustand';
import { eidonInvoke } from '@bridge/ipc';

// wire 形状事实源在 @shared/models；此处再导出供消费组件以 store 单点 import。
export type {
  CloudProvider,
  CloudFolderInfo,
  SessionTab,
  SessionPayload,
  SiblingSession,
} from '@shared/models';
import type { CloudFolderInfo, SessionPayload, SiblingSession } from '@shared/models';

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
    const id = await eidonInvoke('git:deviceId', {});
    set({ deviceId: id });
    return id;
  },

  async refresh(folder) {
    if (!folder) {
      set({ cloud: { provider: 'none', label: '' }, siblings: [] });
      return;
    }
    set({ cloud: await eidonInvoke('git:cloudDetect', { folder }) });
    const id = await get().ensureDeviceId();
    set({ siblings: await eidonInvoke('git:sessionListOthers', { folder, ourDeviceId: id }) });
  },

  async saveSession(folder, payload) {
    await eidonInvoke('git:sessionSave', { folder, payload });
  },

  async loadSession(folder, deviceId) {
    return await eidonInvoke('git:sessionLoad', { folder, deviceId });
  },

  markPrompted(folder) {
    set({ promptedSessionFor: folder });
  },
}));
