import { getVersion } from '../../core/bridge/tauri';
import { openUrl } from '@tauri-apps/plugin-opener';

/**
 * 更新检查：直接查 GitHub releases（eidon 仓库）。失败（离线 / 限流）时返回
 * `latest: null` + `error: true`，UI 显示「检查失败，重试」而非谎称「已是最新」。
 *
 * 注：原远程代理源已移除（pre-launch 清理，见 ADR-0022）；如后续需要低限流代理，
 * 在此加回一个源即可。
 */

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/NAMEWTA/eidon/releases/latest';

export interface UpdateResult {
  current: string;
  latest: string | null;
  hasUpdate: boolean;
  url: string;
  /** True when neither source could be reached. UI should show
   *  "couldn't check" rather than "up to date". */
  error: boolean;
}

/** Returns semver comparison: 1 if a > b, -1 if a < b, 0 if equal */
function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

const MAS_BUILD = import.meta.env.VITE_MAS_BUILD === '1';

export const isMasBuild = (): boolean => MAS_BUILD;

const RELEASES_PAGE = 'https://github.com/NAMEWTA/eidon/releases';

async function fetchLatestRelease(): Promise<{ tag: string; url: string } | null> {
  try {
    const res = await fetch(GITHUB_RELEASES_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: string; html_url?: string };
    const tag = (data.tag_name || '').replace(/^v/, '');
    if (!tag) return null;
    return { tag, url: data.html_url || RELEASES_PAGE };
  } catch {
    return null;
  }
}

export async function checkForUpdate(): Promise<UpdateResult> {
  const current = await getVersion().catch(() => '0.0.0');
  if (MAS_BUILD) {
    return { current, latest: null, hasUpdate: false, url: '', error: false };
  }

  const info = await fetchLatestRelease();

  if (!info) {
    return {
      current,
      latest: null,
      hasUpdate: false,
      url: RELEASES_PAGE,
      error: true,
    };
  }

  const hasUpdate = compareSemver(info.tag, current) > 0;
  return {
    current,
    latest: info.tag,
    hasUpdate,
    url: info.url,
    error: false,
  };
}

/** Open the release page in the system browser. */
export async function openReleaseUrl(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch {
    /* ignore */
  }
}

/** Store the last-checked timestamp so we don't spam GitHub on every launch. */
const LS_KEY = 'eidon.update.last-check';
const CHECK_INTERVAL = 24 * 3600 * 1000; // 24 hours

export async function checkForUpdateOnStartup(): Promise<UpdateResult | null> {
  if (MAS_BUILD) return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const ts = Number(raw);
      if (Date.now() - ts < CHECK_INTERVAL) return null;
    }
  } catch {}
  const result = await checkForUpdate();
  // Only stamp the cache when the check actually succeeded — failed
  // checks shouldn't lock us out for 24 h.
  if (!result.error) {
    try {
      localStorage.setItem(LS_KEY, String(Date.now()));
    } catch {}
  }
  return result;
}
