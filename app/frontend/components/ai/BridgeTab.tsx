/**
 * BridgeTab —— 智能体设置「社交接入」子页（P4，飞书 + 微信官方 iLink）。
 *
 * 每平台：绑定 Agent + 凭证（飞书 appId/appSecret；微信扫码登录）+ 启停 + 实时状态徽标。
 * 入站消息由后端路由到绑定 Agent 的会话并回发；本组件只配置 + 看状态，读写走 bridge:* 通道 + 事件。
 */
import { useEffect, useState } from 'react';

import { aiBridge } from '@bridge/ipc';
import { useAiStore } from '../../stores/ai';
import { useToastsStore } from '../../stores/toasts';
import type { BridgePlatform, BridgeStatus, WechatLoginState } from '@shared/models';
import { SettingsSection, Toggle, KeyInput, TextInput, Select, Banner } from '../settings/kit';

const STATE_LABEL: Record<BridgeStatus['state'], string> = {
  idle: '未启动',
  connecting: '连接中…',
  online: '在线',
  error: '错误',
  disconnected: '已断开',
};
const STATE_COLOR: Record<BridgeStatus['state'], string> = {
  idle: 'var(--text-faint)',
  connecting: '#d8a657',
  online: '#4a9d6a',
  error: 'var(--danger)',
  disconnected: 'var(--text-faint)',
};

function StatusBadge({ s }: { s: BridgeStatus | undefined }) {
  const state = s?.state ?? 'idle';
  return (
    <span className="bridge-status" title={s?.error ?? undefined} style={{ color: STATE_COLOR[state] }}>
      <span className="bridge-status__dot" style={{ background: STATE_COLOR[state] }} />
      {STATE_LABEL[state]}
    </span>
  );
}

export function BridgeTab() {
  const store = useAiStore();
  const toasts = useToastsStore();
  const [statuses, setStatuses] = useState<BridgeStatus[]>([]);
  const [fsAppId, setFsAppId] = useState('');
  const [fsAppSecret, setFsAppSecret] = useState('');
  const [qr, setQr] = useState<WechatLoginState | null>(null);

  const get = (p: BridgePlatform) => statuses.find((s) => s.platform === p);

  async function refresh() {
    setStatuses(await aiBridge.bridgeStatus());
  }

  useEffect(() => {
    void store.init();
    void refresh();
    let offStatus: (() => void) | undefined;
    let offQr: (() => void) | undefined;
    void aiBridge.onBridgeStatus((s) => {
      setStatuses((prev) => prev.map((x) => (x.platform === s.platform ? s : x)));
    }).then((fn) => (offStatus = fn));
    void aiBridge.onWechatQr((s) => {
      setQr(s);
      if (s.status === 'confirmed') {
        toasts.success('微信登录成功');
        void refresh();
      }
    }).then((fn) => (offQr = fn));
    return () => {
      offStatus?.();
      offQr?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function bind(
    platform: BridgePlatform,
    patch: { agentId?: string | null; creds?: Record<string, string>; enabled?: boolean },
  ) {
    const cur = get(platform);
    await aiBridge.bindBridge({
      platform,
      agentId: patch.agentId !== undefined ? patch.agentId : cur?.agentId ?? null,
      creds: patch.creds,
      enabled: patch.enabled !== undefined ? patch.enabled : cur?.enabled ?? false,
    });
    await refresh();
  }

  function AgentSelect({ platform }: { platform: BridgePlatform }) {
    const s = get(platform);
    return (
      <Select value={s?.agentId ?? ''} onChange={(e) => void bind(platform, { agentId: e.target.value || null })}>
        <option value="">（选择绑定的助手）</option>
        {store.agents.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </Select>
    );
  }

  const fs = get('feishu');
  const wx = get('wechat');

  return (
    <div>
      <Banner>把某个助手接到外部 IM。消息进来后由绑定的助手用其人格/模型回复。需保持应用在托盘常驻才能持续在线。</Banner>

      {/* 飞书 */}
      <SettingsSection
        title="飞书"
        hint="建飞书自建应用 → 开机器人 → 事件订阅选「长连接」模式 → 授 im:message 权限。支持私聊 + 群聊，无需公网。"
        context={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusBadge s={fs} />
            <Toggle on={fs?.enabled} disabled={!fs?.configured || !fs?.agentId} onChange={(on) => void aiBridge.setBridgeEnabled('feishu', on).then(refresh)} />
          </div>
        }
      >
        <div className="pv-credentials">
          <div className="pv-cred-row"><span className="pv-cred-label">绑定助手</span><div className="pv-cred-field"><AgentSelect platform="feishu" /></div></div>
          <div className="pv-cred-row"><span className="pv-cred-label">App ID</span><div className="pv-cred-field"><TextInput value={fsAppId} onChange={(e) => setFsAppId(e.target.value)} placeholder={fs?.configured ? '已配置（重填以覆盖）' : 'cli_xxx'} /></div></div>
          <div className="pv-cred-row"><span className="pv-cred-label">App Secret</span><div className="pv-cred-field"><KeyInput value={fsAppSecret} onChange={setFsAppSecret} placeholder={fs?.configured ? '••••' : ''} /></div></div>
        </div>
        <button
          className="set-btn set-btn--primary"
          onClick={() => {
            if (!fs?.agentId) { toasts.error('请先选择绑定的助手'); return; }
            if (!fsAppId.trim() || !fsAppSecret.trim()) { toasts.error('请填写 App ID 与 App Secret'); return; }
            void bind('feishu', { creds: { appId: fsAppId.trim(), appSecret: fsAppSecret.trim() }, enabled: true }).then(() => {
              setFsAppId('');
              setFsAppSecret('');
              toasts.success('已保存并连接飞书');
            });
          }}
        >
          保存并连接
        </button>
      </SettingsSection>

      {/* 微信 */}
      <SettingsSection
        title="微信（官方 iLink）"
        hint="腾讯官方个人号 Bot（扫码登录）。限制：仅 1v1 私聊、24h 回复窗口、每次扫码 Bot 会变；实验性官方通道，勿用于核心业务。"
        context={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusBadge s={wx} />
            <Toggle on={wx?.enabled} disabled={!wx?.configured || !wx?.agentId} onChange={(on) => void aiBridge.setBridgeEnabled('wechat', on).then(refresh)} />
          </div>
        }
      >
        <div className="pv-credentials">
          <div className="pv-cred-row"><span className="pv-cred-label">绑定助手</span><div className="pv-cred-field"><AgentSelect platform="wechat" /></div></div>
        </div>

        {qr?.qrDataUrl && qr.status !== 'confirmed' ? (
          <div className="set-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <img src={qr.qrDataUrl} alt="微信登录二维码" style={{ width: 200, height: 200 }} />
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              {qr.status === 'scanned' ? '已扫码，请在手机上确认…' : '用微信扫码并确认登录'}
            </div>
            <button className="set-btn" onClick={() => void aiBridge.wechatCancelLogin().then(() => setQr(null))}>取消</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="set-btn set-btn--primary" onClick={() => { setQr({ status: 'pending' }); void aiBridge.wechatStartLogin(); }}>
              {wx?.configured ? '重新扫码登录' : '扫码登录'}
            </button>
            {wx?.configured && (
              <button className="set-btn set-btn--danger" onClick={() => void aiBridge.unbindBridge('wechat').then(refresh)}>解绑</button>
            )}
            {qr?.status === 'expired' && <span style={{ fontSize: 12, color: 'var(--danger)' }}>二维码已过期，请重试</span>}
            {qr?.status === 'error' && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{qr.error ?? '登录失败'}</span>}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}

export default BridgeTab;
