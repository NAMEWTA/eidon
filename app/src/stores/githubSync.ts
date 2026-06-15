/**
 * githubSync store（Zustand v5；从 Pinia 1:1 迁移）。包裹 Rust `github_*` /
 * `crypto_*` / `proxy_*` 命令。缓存 PAT 在位标志与当前文件夹的 SyncStatus。
 * 错误只 stash 到 lastError（不自 toast），以便非组件上下文复用。
 */
import { create } from 'zustand';
import { invoke } from '../../core/bridge/tauri';

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  clone_url: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  updated_at: string;
}

export interface SyncConfig {
  remote_url: string;
  auto_push: boolean;
  auto_pull_minutes: number;
  last_push_at: number | null;
  last_pull_at: number | null;
}

export interface SyncStatus {
  linked: boolean;
  remote_url: string;
  auto_push: boolean;
  auto_pull_minutes: number;
  encrypted: boolean;
  provider: string;
  ahead: number;
  behind: number;
  dirty: boolean;
  has_conflicts: boolean;
  conflicts: string[];
  last_push_at: number | null;
  last_pull_at: number | null;
}

export interface CryptoStatus {
  enabled: boolean;
  has_key: boolean;
}

export interface PullResult {
  kind: 'fast_forward' | 'up_to_date' | 'conflicts' | 'merged';
  conflicts: string[];
}

interface State {
  hasToken: boolean;
  user: GitHubUser | null;
  repos: GitHubRepo[];
  folder: string | null;
  status: SyncStatus | null;
  loading: boolean;
  pushing: boolean;
  pulling: boolean;
  lastError: string | null;
}

interface Actions {
  isLinked(): boolean;
  hasConflicts(): boolean;
  refreshHasToken(): Promise<void>;
  setToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
  refreshUser(): Promise<void>;
  listRepos(): Promise<GitHubRepo[]>;
  createRepo(name: string, isPrivate: boolean): Promise<GitHubRepo>;
  link(folder: string, remoteUrl: string, opts?: { encrypted?: boolean; provider?: string }): Promise<void>;
  cryptoStatus(folder: string): Promise<CryptoStatus>;
  setPassphrase(folder: string, passphrase: string): Promise<void>;
  clearPassphrase(folder: string): Promise<void>;
  decryptNow(folder: string): Promise<void>;
  getProxy(): Promise<string>;
  setProxy(url: string): Promise<void>;
  enableEncryption(folder: string, passphrase: string): Promise<void>;
  setConfig(folder: string, autoPush: boolean, autoPullMinutes: number): Promise<void>;
  unlink(folder: string): Promise<void>;
  refreshStatus(folder: string | null): Promise<void>;
  push(folder: string): Promise<void>;
  pull(folder: string): Promise<PullResult>;
  resolveConflict(folder: string, file: string, choice: 'local' | 'remote' | 'both'): Promise<void>;
}

export const useGithubSyncStore = create<State & Actions>()((set, get) => ({
  hasToken: false,
  user: null,
  repos: [],
  folder: null,
  status: null,
  loading: false,
  pushing: false,
  pulling: false,
  lastError: null,

  isLinked() {
    return Boolean(get().status?.linked);
  },
  hasConflicts() {
    return Boolean(get().status?.has_conflicts);
  },

  async refreshHasToken() {
    try {
      set({ hasToken: await invoke<boolean>('github_has_token') });
    } catch (e) {
      set({ lastError: String(e), hasToken: false });
    }
  },

  async setToken(token) {
    await invoke('github_set_token', { token });
    set({ hasToken: true });
    await get().refreshUser();
  },

  async clearToken() {
    await invoke('github_clear_token');
    set({ hasToken: false, user: null, repos: [] });
  },

  async refreshUser() {
    try {
      set({ user: await invoke<GitHubUser>('github_user') });
    } catch (e) {
      set({ lastError: String(e), user: null });
    }
  },

  async listRepos() {
    set({ loading: true });
    try {
      const repos = await invoke<GitHubRepo[]>('github_list_repos');
      set({ repos });
      return repos;
    } catch (e) {
      set({ lastError: String(e), repos: [] });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  async createRepo(name, isPrivate) {
    const repo = await invoke<GitHubRepo>('github_create_vault_repo', { name, private: isPrivate });
    set({ repos: [repo, ...get().repos] });
    return repo;
  },

  async link(folder, remoteUrl, opts = {}) {
    await invoke<SyncConfig>('github_link_workspace', {
      folder,
      remoteUrl,
      encrypted: opts.encrypted ?? false,
      provider: opts.provider ?? 'github',
    });
    await get().refreshStatus(folder);
  },

  async cryptoStatus(folder) {
    return await invoke<CryptoStatus>('crypto_status', { folder });
  },
  async setPassphrase(folder, passphrase) {
    await invoke('crypto_set_passphrase', { folder, passphrase });
  },
  async clearPassphrase(folder) {
    await invoke('crypto_clear_passphrase', { folder });
  },
  async decryptNow(folder) {
    await invoke('crypto_decrypt_after_pull', { folder });
  },
  async getProxy() {
    return await invoke<string>('proxy_get');
  },
  async setProxy(url) {
    await invoke('proxy_set', { url });
  },

  async enableEncryption(folder, passphrase) {
    await invoke('github_enable_encryption', { folder, passphrase });
    await get().refreshStatus(folder);
  },

  async setConfig(folder, autoPush, autoPullMinutes) {
    await invoke<SyncConfig>('github_set_config', { folder, autoPush, autoPullMinutes });
    await get().refreshStatus(folder);
  },

  async unlink(folder) {
    await invoke('github_unlink_workspace', { folder });
    await get().refreshStatus(folder);
  },

  async refreshStatus(folder) {
    if (!folder) {
      set({ folder: null, status: null });
      return;
    }
    set({ folder });
    try {
      set({ status: await invoke<SyncStatus>('github_sync_status', { folder }) });
    } catch (e) {
      // 出错不清空 status，保留最后已知状态，避免 UI 在 linked/not-linked 间闪烁。
      set({ lastError: String(e) });
    }
  },

  async push(folder) {
    set({ pushing: true });
    try {
      await invoke('github_push', { folder });
      await get().refreshStatus(folder);
    } catch (e) {
      set({ lastError: String(e) });
      throw e;
    } finally {
      set({ pushing: false });
    }
  },

  async pull(folder) {
    set({ pulling: true });
    try {
      const r = await invoke<PullResult>('github_pull', { folder });
      await get().refreshStatus(folder);
      return r;
    } catch (e) {
      set({ lastError: String(e) });
      throw e;
    } finally {
      set({ pulling: false });
    }
  },

  async resolveConflict(folder, file, choice) {
    await invoke('github_resolve_conflict', { folder, file, choice });
    await get().refreshStatus(folder);
  },
}));
