/**
 * GithubSyncSettings.tsx — Settings → GitHub sync 面板（从 GithubSyncSettings.vue 迁移）。
 *
 * 三态：
 *   1. 无 PAT          → "Connect with GitHub" + token 输入 + 帮助链接
 *   2. 有 PAT 未关联   → repo 选择器 + "新建 vault repo"
 *   3. 已关联          → 状态、自动推送开关、自动拉取间隔、手动 push/pull、解绑、切 repo
 *
 * 嵌于 SettingsPanel 的 AutoGit 区。ref→useState，computed→useMemo，
 * watch/onMounted→useEffect。错误经 toasts 呈现。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icons';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useGithubSyncStore } from '../stores/githubSync';
import { useSettingsStore } from '../stores/settings';
import { useWorkspaceStore } from '../stores/workspace';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';

const PAT_HELP_URL =
  'https://github.com/settings/tokens/new?scopes=repo&description=EIDON%20sync';

export function GithubSyncSettings() {
  const { t } = useI18n();
  // 订阅 githubSync store 切片（getters isLinked/hasConflicts 以方法形式调用，返回原始值）。
  const hasToken = useGithubSyncStore((s) => s.hasToken);
  const user = useGithubSyncStore((s) => s.user);
  const repos = useGithubSyncStore((s) => s.repos);
  const status = useGithubSyncStore((s) => s.status);
  const loading = useGithubSyncStore((s) => s.loading);
  const pushing = useGithubSyncStore((s) => s.pushing);
  const pulling = useGithubSyncStore((s) => s.pulling);
  const lastError = useGithubSyncStore((s) => s.lastError);
  const isLinked = useGithubSyncStore((s) => s.isLinked());
  const hasConflicts = useGithubSyncStore((s) => s.hasConflicts());
  const currentFolder = useWorkspaceStore((s) => s.currentFolder);

  const [tokenInput, setTokenInput] = useState('');
  const [tokenSaving, setTokenSaving] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [linking, setLinking] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // v2.6.3 — multi-provider + E2EE state
  const [providerChoice, setProviderChoice] = useState<'github' | 'gitlab' | 'gitea' | 'custom'>('github');
  const [customUrl, setCustomUrl] = useState('');
  const [enableE2ee, setEnableE2ee] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [passphraseSaving, setPassphraseSaving] = useState(false);
  const [decrypting, setDecrypting] = useState(false);

  // v3.0 — 把已关联的明文 workspace 升级到 E2EE。
  const [upgradePassphrase, setUpgradePassphrase] = useState('');
  const [upgradeConfirm, setUpgradeConfirm] = useState('');
  const [upgradeAcknowledged, setUpgradeAcknowledged] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  function startE2eeUpgrade() {
    setUpgradeOpen(true);
  }
  function cancelE2eeUpgrade() {
    setUpgradeOpen(false);
    setUpgradePassphrase('');
    setUpgradeConfirm('');
    setUpgradeAcknowledged(false);
  }
  async function commitE2eeUpgrade() {
    const folder = useWorkspaceStore.getState().currentFolder;
    if (!folder) return;
    const toasts = useToastsStore.getState();
    if (upgradePassphrase.length < 8) {
      toasts.warning(t('githubSync.upgradeShortPassphrase'));
      return;
    }
    if (upgradePassphrase !== upgradeConfirm) {
      toasts.warning(t('githubSync.upgradeMismatch'));
      return;
    }
    if (!upgradeAcknowledged) {
      toasts.warning(t('githubSync.upgradeNotAcknowledged'));
      return;
    }
    setUpgrading(true);
    try {
      await useGithubSyncStore.getState().enableEncryption(folder, upgradePassphrase);
      toasts.success(t('githubSync.upgradeDoneToast'));
      cancelE2eeUpgrade();
    } catch (e) {
      toasts.error(`${t('githubSync.upgradeFailed')}: ${e}`);
    } finally {
      setUpgrading(false);
    }
  }

  // 挂载：复刻 Vue onMounted 顺序（refreshHasToken → 若有 folder refreshStatus →
  // 若 hasToken 且未关联，refreshUser + listRepos）。
  useEffect(() => {
    (async () => {
      const sync = useGithubSyncStore.getState();
      await sync.refreshHasToken();
      const folder = useWorkspaceStore.getState().currentFolder;
      if (folder) {
        await useGithubSyncStore.getState().refreshStatus(folder);
      }
      if (useGithubSyncStore.getState().hasToken && !useGithubSyncStore.getState().isLinked()) {
        await Promise.all([
          useGithubSyncStore.getState().refreshUser(),
          useGithubSyncStore.getState().listRepos().catch(() => {}),
        ]);
      }
    })();
  }, []);

  // workspace.currentFolder 变化（不含初次挂载，复刻 watch 无 immediate）→ refreshStatus。
  const didMountFolder = useRef(false);
  useEffect(() => {
    if (!didMountFolder.current) {
      didMountFolder.current = true;
      return;
    }
    void useGithubSyncStore.getState().refreshStatus(currentFolder);
  }, [currentFolder]);

  async function saveToken() {
    const tok = tokenInput.trim();
    if (!tok) return;
    const toasts = useToastsStore.getState();
    setTokenSaving(true);
    try {
      await useGithubSyncStore.getState().setToken(tok);
      setTokenInput('');
      toasts.success(t('githubSync.tokenSavedToast'));
      // 预加载 repos 给选择器。
      await useGithubSyncStore.getState().listRepos().catch((e) => {
        toasts.error(`${t('githubSync.tokenInvalid')}: ${e}`);
        // token 无效。清掉让用户干净重试。
        void useGithubSyncStore.getState().clearToken();
      });
    } catch (e) {
      toasts.error(String(e));
    } finally {
      setTokenSaving(false);
    }
  }

  async function clearToken() {
    const folder = useWorkspaceStore.getState().currentFolder;
    if (useGithubSyncStore.getState().status?.linked && folder) {
      await useGithubSyncStore.getState().unlink(folder).catch(() => {});
    }
    await useGithubSyncStore.getState().clearToken();
    useToastsStore.getState().info(t('githubSync.tokenClearedToast'));
  }

  async function refreshRepos() {
    try {
      await useGithubSyncStore.getState().listRepos();
    } catch (e) {
      useToastsStore.getState().error(String(e));
    }
  }

  async function createRepo() {
    const name = newRepoName.trim();
    if (!name) return;
    const toasts = useToastsStore.getState();
    setCreatingRepo(true);
    try {
      const repo = await useGithubSyncStore.getState().createRepo(name, newRepoPrivate);
      toasts.success(t('githubSync.repoCreatedToast', { name: repo.full_name }));
      setNewRepoName('');
      // 若有 workspace 自动关联。
      if (useWorkspaceStore.getState().currentFolder) {
        await link(repo.clone_url);
      }
    } catch (e) {
      toasts.error(`${t('githubSync.repoCreateFailed')}: ${e}`);
    } finally {
      setCreatingRepo(false);
    }
  }

  async function link(remoteUrl: string) {
    const folder = useWorkspaceStore.getState().currentFolder;
    const toasts = useToastsStore.getState();
    if (!folder) {
      toasts.warning(t('githubSync.noWorkspace'));
      return;
    }
    if (!useSettingsStore.getState().autoGitEnabled) {
      // GitHub sync 只推送 commit——AutoGit 是硬前提。直接替用户打开而非拒绝。
      useSettingsStore.getState().toggleAutoGit();
    }
    setLinking(true);
    try {
      await useGithubSyncStore.getState().link(folder, remoteUrl, {
        encrypted: enableE2ee,
        provider: providerChoice,
      });
      toasts.success(t('githubSync.linkedToast'));
    } catch (e) {
      toasts.error(`${t('githubSync.linkFailed')}: ${e}`);
    } finally {
      setLinking(false);
    }
  }

  async function linkCustom() {
    const url = customUrl.trim();
    if (!url) return;
    await link(url);
    setCustomUrl('');
  }

  async function savePassphrase() {
    const folder = useWorkspaceStore.getState().currentFolder;
    if (!folder) return;
    const pw = passphraseInput;
    if (!pw) return;
    const toasts = useToastsStore.getState();
    setPassphraseSaving(true);
    try {
      await useGithubSyncStore.getState().setPassphrase(folder, pw);
      setPassphraseInput('');
      toasts.success(t('githubSync.passphraseSavedToast'));
    } catch (e) {
      toasts.error(`${t('githubSync.passphraseFailed')}: ${e}`);
    } finally {
      setPassphraseSaving(false);
    }
  }

  async function decryptNow() {
    const folder = useWorkspaceStore.getState().currentFolder;
    if (!folder) return;
    const toasts = useToastsStore.getState();
    setDecrypting(true);
    try {
      await useGithubSyncStore.getState().decryptNow(folder);
      toasts.success(t('githubSync.decryptedToast'));
      window.dispatchEvent(new CustomEvent('eidon:remote-pulled'));
    } catch (e) {
      toasts.error(`${t('githubSync.decryptFailed')}: ${e}`);
    } finally {
      setDecrypting(false);
    }
  }

  async function unlink() {
    const folder = useWorkspaceStore.getState().currentFolder;
    if (!folder) return;
    try {
      await useGithubSyncStore.getState().unlink(folder);
      useToastsStore.getState().info(t('githubSync.unlinkedToast'));
    } catch (e) {
      useToastsStore.getState().error(String(e));
    }
  }

  async function pushNow() {
    const folder = useWorkspaceStore.getState().currentFolder;
    if (!folder) return;
    const toasts = useToastsStore.getState();
    try {
      await useGithubSyncStore.getState().push(folder);
      toasts.success(t('githubSync.pushedToast'));
    } catch (e) {
      toasts.error(`${t('githubSync.pushFailed')}: ${e}`);
    }
  }

  async function pullNow() {
    const folder = useWorkspaceStore.getState().currentFolder;
    if (!folder) return;
    const toasts = useToastsStore.getState();
    try {
      const r = await useGithubSyncStore.getState().pull(folder);
      if (r.kind === 'up_to_date') {
        toasts.info(t('githubSync.upToDate'));
      } else if (r.kind === 'conflicts') {
        toasts.warning(t('githubSync.pullConflicts', { n: String(r.conflicts.length) }));
      } else {
        toasts.success(t('githubSync.pulledToast'));
        window.dispatchEvent(new CustomEvent('eidon:remote-pulled'));
      }
    } catch (e) {
      toasts.error(`${t('githubSync.pullFailed')}: ${e}`);
    }
  }

  async function setAutoPush(checked: boolean) {
    const folder = useWorkspaceStore.getState().currentFolder;
    const st = useGithubSyncStore.getState().status;
    if (!folder || !st?.linked) return;
    const toasts = useToastsStore.getState();
    try {
      await useGithubSyncStore.getState().setConfig(folder, checked, st.auto_pull_minutes);
      toasts.info(checked ? t('githubSync.autoPushOn') : t('githubSync.autoPushOff'));
    } catch (e) {
      toasts.error(String(e));
    }
  }

  async function setAutoPullMinutes(v: number) {
    const folder = useWorkspaceStore.getState().currentFolder;
    const st = useGithubSyncStore.getState().status;
    if (!folder || !st?.linked) return;
    try {
      await useGithubSyncStore.getState().setConfig(
        folder,
        st.auto_push,
        Number.isFinite(v) && v >= 0 ? v : 0,
      );
    } catch (e) {
      useToastsStore.getState().error(String(e));
    }
  }

  function openPATHelp() {
    void openUrl(PAT_HELP_URL);
  }

  function fmtAgo(ts: number | null): string {
    if (!ts) return t('githubSync.never');
    const dt = Date.now() / 1000 - ts;
    if (dt < 60) return t('githubSync.agoSec', { n: String(Math.floor(dt)) });
    if (dt < 3600) return t('githubSync.agoMin', { n: String(Math.floor(dt / 60)) });
    if (dt < 86400) return t('githubSync.agoHour', { n: String(Math.floor(dt / 3600)) });
    return t('githubSync.agoDay', { n: String(Math.floor(dt / 86400)) });
  }

  const linkedRepoLabel = useMemo(() => {
    const url = status?.remote_url ?? '';
    const m = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
    return m ? `${m[1]}/${m[2]}` : url;
  }, [status]);

  return (
    <section className="ghs">
      <h3 className="ghs__heading">{t('githubSync.heading')}</h3>
      <p className="ghs__intro">{t('githubSync.intro')}</p>

      {/* v3.0 — 首次设置提示：keychain "Always Allow" 一次即可静默后续。 */}
      <div className="ghs-keychain-hint">
        <span className="ghs-keychain-hint__icon"><Icon name="key" size={14} /></span>
        <div>
          <strong>{t('githubSync.keychainHintTitle')}</strong>
          <p>{t('githubSync.keychainHintBody')}</p>
        </div>
      </div>

      {/* State 1: no PAT — sign-in form */}
      {!hasToken ? (
        <div className="ghs-card">
          <div className="ghs-card__title">{t('githubSync.signInTitle')}</div>
          <p className="ghs-help">{t('githubSync.signInHint')}</p>
          <div className="ghs-row">
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="ghs-input ghs-input--mono"
              placeholder={t('githubSync.tokenPlaceholder')}
            />
          </div>
          <div className="ghs-row">
            <button className="ghs-btn ghs-btn--primary" disabled={tokenSaving || !tokenInput.trim()} onClick={saveToken}>
              {tokenSaving ? t('githubSync.tokenSaving') : t('githubSync.tokenSaveBtn')}
            </button>
            <button className="ghs-btn" onClick={openPATHelp}>
              {t('githubSync.tokenGetBtn')}
            </button>
          </div>
          <p className="ghs-fineprint">{t('githubSync.tokenScopeHint')}</p>
        </div>
      ) : !isLinked ? (
        /* State 2: PAT, no link — repo picker / create */
        <div className="ghs-card">
          <div className="ghs-card__title">
            {t('githubSync.signedInAs', { user: user?.login ?? '…' })}
          </div>

          {!currentFolder ? (
            <p className="ghs-help">{t('githubSync.openFolderFirst')}</p>
          ) : (
            <>
              <p className="ghs-help">{t('githubSync.linkHint')}</p>

              {/* v2.6.3 — provider + E2EE toggle */}
              <div className="ghs-subblock">
                <div className="ghs-sub-title">{t('githubSync.providerTitle')}</div>
                <div className="ghs-row">
                  <select value={providerChoice} onChange={(e) => setProviderChoice(e.target.value as typeof providerChoice)} className="ghs-select">
                    <option value="github">GitHub</option>
                    <option value="gitlab">GitLab</option>
                    <option value="gitea">Gitea (self-hosted)</option>
                    <option value="custom">{t('githubSync.customProvider')}</option>
                  </select>
                </div>
                {providerChoice !== 'github' && (
                  <p className="ghs-help">{t('githubSync.nonGithubHint')}</p>
                )}
                <label className="ghs-checkbox" style={{ marginTop: '6px' }}>
                  <input checked={enableE2ee} onChange={(e) => setEnableE2ee(e.target.checked)} type="checkbox" />
                  {t('githubSync.enableE2ee')}
                </label>
                <p className="ghs-help">{t('githubSync.e2eeHint')}</p>
              </div>

              {/* Create new */}
              {providerChoice === 'github' && (
                <div className="ghs-subblock">
                  <div className="ghs-sub-title">{t('githubSync.createNewTitle')}</div>
                  <div className="ghs-row">
                    <input
                      value={newRepoName}
                      onChange={(e) => setNewRepoName(e.target.value)}
                      type="text"
                      className="ghs-input"
                      placeholder={t('githubSync.newRepoPlaceholder')}
                    />
                  </div>
                  <div className="ghs-row">
                    <label className="ghs-checkbox">
                      <input checked={newRepoPrivate} onChange={(e) => setNewRepoPrivate(e.target.checked)} type="checkbox" />
                      {t('githubSync.privateRepo')}
                    </label>
                  </div>
                  <div className="ghs-row">
                    <button className="ghs-btn ghs-btn--primary" disabled={creatingRepo || !newRepoName.trim()} onClick={createRepo}>
                      {creatingRepo ? t('githubSync.creatingRepo') : t('githubSync.createAndLinkBtn')}
                    </button>
                  </div>
                </div>
              )}

              {/* Custom / GitLab / Gitea — paste a clone URL */}
              {providerChoice !== 'github' && (
                <div className="ghs-subblock">
                  <div className="ghs-sub-title">{t('githubSync.pasteUrlTitle')}</div>
                  <div className="ghs-row">
                    <input
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      type="text"
                      className="ghs-input ghs-input--mono"
                      placeholder={
                        providerChoice === 'gitlab'
                          ? 'https://gitlab.com/owner/repo.git'
                          : providerChoice === 'gitea'
                            ? 'https://gitea.example.org/owner/repo.git'
                            : 'https://git.example.org/owner/repo.git'
                      }
                    />
                  </div>
                  <div className="ghs-row">
                    <button className="ghs-btn ghs-btn--primary" disabled={linking || !customUrl.trim()} onClick={linkCustom}>
                      {t('githubSync.linkBtn')}
                    </button>
                  </div>
                </div>
              )}

              {/* Pick existing (GitHub only) */}
              {providerChoice === 'github' && (
                <div className="ghs-subblock">
                  <div className="ghs-sub-title">{t('githubSync.pickExistingTitle')}</div>
                  {loading ? (
                    <div className="ghs-help">{t('githubSync.loadingRepos')}</div>
                  ) : !repos.length ? (
                    <div className="ghs-help">
                      {t('githubSync.noReposFound')}
                      <button className="ghs-btn ghs-btn--small" onClick={refreshRepos}>{t('githubSync.refreshRepos')}</button>
                    </div>
                  ) : (
                    <ul className="ghs-repolist">
                      {repos.map((r) => (
                        <li key={r.full_name} className="ghs-repolist__item">
                          <div className="ghs-repolist__meta">
                            <span className="ghs-repolist__name">{r.full_name}</span>
                            {r.private && <span className="ghs-repolist__pill">{t('githubSync.privateBadge')}</span>}
                          </div>
                          <button className="ghs-btn ghs-btn--small" disabled={linking} onClick={() => link(r.clone_url)}>
                            {t('githubSync.linkBtn')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="ghs-row">
                <button className="ghs-btn ghs-btn--ghost" onClick={clearToken}>
                  {t('githubSync.signOutBtn')}
                </button>
                <button className="ghs-btn ghs-btn--ghost" onClick={refreshRepos}>
                  {t('githubSync.refreshRepos')}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        /* State 3: linked — status + actions */
        <div className="ghs-card ghs-card--linked">
          <div className="ghs-card__title">
            {t('githubSync.linkedTitle', { repo: linkedRepoLabel })}
          </div>

          <div className="ghs-status">
            <div>
              <span className={`ghs-dot ${status?.dirty ? 'ghs-dot--warn' : 'ghs-dot--ok'}`}></span>
              {status?.dirty ? <span>{t('githubSync.statusDirty')}</span> : <span>{t('githubSync.statusClean')}</span>}
            </div>
            {(status?.ahead ?? 0) > 0 && (
              <div className="ghs-status__pill">↑ {status?.ahead} {t('githubSync.ahead')}</div>
            )}
            {(status?.behind ?? 0) > 0 && (
              <div className="ghs-status__pill">↓ {status?.behind} {t('githubSync.behind')}</div>
            )}
            {hasConflicts && (
              <div className="ghs-status__pill ghs-status__pill--err">
                <Icon name="warning" size={13} /> {status?.conflicts.length} {t('githubSync.conflictsBadge')}
              </div>
            )}
          </div>

          <div className="ghs-timestamps">
            <div>{t('githubSync.lastPush')}: {fmtAgo(status?.last_push_at ?? null)}</div>
            <div>{t('githubSync.lastPull')}: {fmtAgo(status?.last_pull_at ?? null)}</div>
          </div>

          <div className="ghs-row">
            <button className="ghs-btn ghs-btn--primary" disabled={pushing || pulling || hasConflicts} onClick={pushNow}>
              {pushing ? t('githubSync.pushing') : t('githubSync.pushNow')}
            </button>
            <button className="ghs-btn" disabled={pushing || pulling} onClick={pullNow}>
              {pulling ? t('githubSync.pulling') : t('githubSync.pullNow')}
            </button>
          </div>

          {/* v3.0 — upgrade plaintext-linked workspace to E2EE */}
          {!status?.encrypted && !upgradeOpen && (
            <div className="ghs-upgrade-row">
              <span className="ghs-upgrade-row__icon"><Icon name="lock" size={14} /></span>
              <div className="ghs-upgrade-row__copy">
                <strong>{t('githubSync.upgradeRowTitle')}</strong>
                <p>{t('githubSync.upgradeRowBody')}</p>
              </div>
              <button className="ghs-btn" onClick={startE2eeUpgrade}>
                {t('githubSync.upgradeRowBtn')}
              </button>
            </div>
          )}

          {!status?.encrypted && upgradeOpen && (
            <div className="ghs-subblock ghs-upgrade-form">
              <div className="ghs-sub-title">{t('githubSync.upgradeFormTitle')}</div>
              <p className="ghs-help">{t('githubSync.upgradeFormBody')}</p>
              <div className="ghs-warn"><Icon name="warning" size={13} /> {t('githubSync.upgradeForcePushWarning')}</div>
              <div className="ghs-row">
                <input
                  value={upgradePassphrase}
                  onChange={(e) => setUpgradePassphrase(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className="ghs-input"
                  placeholder={t('githubSync.upgradePassphrasePlaceholder')}
                />
              </div>
              <div className="ghs-row">
                <input
                  value={upgradeConfirm}
                  onChange={(e) => setUpgradeConfirm(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className="ghs-input"
                  placeholder={t('githubSync.upgradeConfirmPlaceholder')}
                />
              </div>
              <label className="ghs-checkbox" style={{ marginTop: '4px' }}>
                <input checked={upgradeAcknowledged} onChange={(e) => setUpgradeAcknowledged(e.target.checked)} type="checkbox" />
                {t('githubSync.upgradeAcknowledge')}
              </label>
              <div className="ghs-row" style={{ marginTop: '4px' }}>
                <button className="ghs-btn ghs-btn--ghost" disabled={upgrading} onClick={cancelE2eeUpgrade}>
                  {t('githubSync.upgradeCancelBtn')}
                </button>
                <button
                  className="ghs-btn ghs-btn--primary"
                  disabled={upgrading || !upgradePassphrase || !upgradeConfirm || !upgradeAcknowledged}
                  onClick={commitE2eeUpgrade}
                >
                  {upgrading ? t('githubSync.upgradeRunning') : t('githubSync.upgradeCommitBtn')}
                </button>
              </div>
            </div>
          )}

          {/* v2.6.3 — E2EE passphrase prompt */}
          {status?.encrypted && (
            <div className="ghs-subblock">
              <div className="ghs-sub-title">{t('githubSync.e2eeSection')}</div>
              <p className="ghs-help">{t('githubSync.e2eePromptHint')}</p>
              <div className="ghs-row">
                <input
                  value={passphraseInput}
                  onChange={(e) => setPassphraseInput(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className="ghs-input"
                  placeholder={t('githubSync.passphrasePlaceholder')}
                />
              </div>
              <div className="ghs-row">
                <button className="ghs-btn ghs-btn--primary" disabled={passphraseSaving || !passphraseInput} onClick={savePassphrase}>
                  {passphraseSaving ? t('githubSync.passphraseSaving') : t('githubSync.passphraseSaveBtn')}
                </button>
                <button className="ghs-btn" disabled={decrypting} onClick={decryptNow}>
                  {decrypting ? t('githubSync.decrypting') : t('githubSync.decryptBtn')}
                </button>
              </div>
            </div>
          )}

          <details className="ghs-details" open={showAdvanced}>
            <summary
              onClick={(e) => {
                e.preventDefault();
                setShowAdvanced((v) => !v);
              }}
            >
              {t('githubSync.advanced')}
            </summary>
            <div className="ghs-advanced">
              <label className="ghs-checkbox">
                <input
                  type="checkbox"
                  checked={status?.auto_push ?? false}
                  onChange={(e) => setAutoPush(e.target.checked)}
                />
                {t('githubSync.autoPushLabel')}
              </label>
              <p className="ghs-help">{t('githubSync.autoPushHint')}</p>

              <label className="ghs-row" style={{ alignItems: 'center' }}>
                <span className="ghs-help" style={{ marginRight: '8px' }}>{t('githubSync.autoPullLabel')}:</span>
                <select
                  value={String(status?.auto_pull_minutes ?? 0)}
                  onChange={(e) => setAutoPullMinutes(parseInt(e.target.value, 10))}
                  className="ghs-select"
                >
                  <option value="0">{t('githubSync.autoPullOff')}</option>
                  <option value="5">5 {t('githubSync.minutes')}</option>
                  <option value="15">15 {t('githubSync.minutes')}</option>
                  <option value="30">30 {t('githubSync.minutes')}</option>
                  <option value="60">60 {t('githubSync.minutes')}</option>
                </select>
              </label>
              <p className="ghs-help">{t('githubSync.autoPullHint')}</p>

              <div className="ghs-row" style={{ marginTop: '10px' }}>
                <button className="ghs-btn ghs-btn--ghost" onClick={unlink}>
                  {t('githubSync.unlinkBtn')}
                </button>
                <button className="ghs-btn ghs-btn--ghost" onClick={clearToken}>
                  {t('githubSync.signOutBtn')}
                </button>
              </div>
            </div>
          </details>
        </div>
      )}

      {lastError && <p className="ghs-error">{lastError}</p>}
    </section>
  );
}

export default GithubSyncSettings;
