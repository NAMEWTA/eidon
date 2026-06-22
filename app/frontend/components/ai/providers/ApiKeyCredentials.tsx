/**
 * ApiKeyCredentials —— 供应商详情凭证表单（对齐参考图片）。
 *
 * 四行：API Key（输入 + 显示切换 + 连通性测试图标）、Headers（多行 key=value）、Base URL、API 类型（可编辑保存）。
 * 失焦即时保存：key 走 providers:setKey；baseUrl/api/headers 走 providers:setConfig。测试走 providers:test。
 */
import { useState } from 'react';

import { aiBridge } from '@bridge/ipc';
import { useAiStore } from '../../../stores/ai';
import { useToastsStore } from '../../../stores/toasts';
import type { ProviderInfo } from '@shared/models';
import { Select } from '../../settings/kit';
import { API_FORMAT_OPTIONS } from '../provider-catalog';

function serializeHeaders(h: Record<string, string>): string {
  return Object.entries(h).map(([k, v]) => `${k}=${v}`).join('\n');
}
function parseHeaders(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

type ConnStatus = 'idle' | 'testing' | 'ok' | 'fail';

export function ApiKeyCredentials({
  provider,
  effectiveBaseUrl,
  effectiveApi,
  defaultBaseUrl,
  onRefresh,
}: {
  provider: ProviderInfo;
  effectiveBaseUrl: string;
  effectiveApi: string;
  defaultBaseUrl: string;
  onRefresh: () => Promise<void>;
}) {
  const store = useAiStore();
  const toasts = useToastsStore();
  const [keyDraft, setKeyDraft] = useState('');
  const [reveal, setReveal] = useState(false);
  const [baseUrl, setBaseUrl] = useState(effectiveBaseUrl);
  const [headersText, setHeadersText] = useState(serializeHeaders(provider.headers));
  const [conn, setConn] = useState<ConnStatus>('idle');

  async function saveKey() {
    if (!keyDraft.trim()) return;
    await store.setProviderKey(provider.id, keyDraft.trim());
    setKeyDraft('');
    setConn('idle');
    toasts.success('已保存 API Key');
  }

  async function saveBaseUrl() {
    const trimmed = baseUrl.trim();
    const next = trimmed && trimmed !== defaultBaseUrl ? trimmed : null;
    await aiBridge.setProviderConfig(provider.id, { baseUrl: next });
    await onRefresh();
  }

  async function saveHeaders() {
    await aiBridge.setProviderConfig(provider.id, { headers: parseHeaders(headersText) });
    await onRefresh();
  }

  async function saveApi(val: string) {
    await aiBridge.setProviderConfig(provider.id, { api: val });
    await onRefresh();
    toasts.success('已保存 API 类型');
  }

  async function testConn() {
    setConn('testing');
    try {
      const ok = await aiBridge.testProvider({
        provider: provider.id,
        baseUrl: baseUrl.trim() || defaultBaseUrl,
        api: effectiveApi,
        apiKey: keyDraft.trim() || undefined,
      });
      setConn(ok ? 'ok' : 'fail');
      toasts[ok ? 'success' : 'error'](ok ? '连接成功' : '连接失败（检查凭证/Base URL/API 类型）');
    } catch {
      setConn('fail');
      toasts.error('连接失败');
    }
  }

  return (
    <div className="pv-credentials">
      {/* API Key */}
      <div className="pv-cred-row">
        <span className="pv-cred-label">API Key{provider.configured && <span className="pv-cred-badge"> ✓ 已配置</span>}</span>
        <div className="pv-cred-field">
          <input
            className="settings-input"
            type={reveal ? 'text' : 'password'}
            autoComplete="off"
            value={keyDraft}
            placeholder={provider.configured ? '已配置（重输以覆盖）' : '输入 API Key 以启用此供应商'}
            onChange={(e) => { setKeyDraft(e.target.value); setConn('idle'); }}
            onBlur={() => void saveKey()}
          />
          <button type="button" className="pv-cred-icon-btn" title={reveal ? '隐藏' : '显示'} onClick={() => setReveal((r) => !r)}>
            {reveal ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </button>
          <button type="button" className={`pv-cred-icon-btn${conn === 'ok' ? ' is-ok' : conn === 'fail' ? ' is-fail' : ''}${conn === 'testing' ? ' is-spinning' : ''}`} title="测试连接" onClick={() => void testConn()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          </button>
        </div>
      </div>

      {/* Headers */}
      <div className="pv-cred-row pv-cred-row--top">
        <span className="pv-cred-label">Headers</span>
        <div className="pv-cred-field">
          <textarea
            className="settings-textarea pv-headers-textarea"
            value={headersText}
            placeholder={'Authorization=Bearer token\nX-Corp-Auth=secret'}
            onChange={(e) => setHeadersText(e.target.value)}
            onBlur={() => void saveHeaders()}
          />
        </div>
      </div>

      {/* Base URL */}
      <div className="pv-cred-row">
        <span className="pv-cred-label">Base URL</span>
        <div className="pv-cred-field">
          <input
            className="settings-input"
            type="text"
            value={baseUrl}
            placeholder={defaultBaseUrl || 'https://api.example.com/v1'}
            onChange={(e) => setBaseUrl(e.target.value)}
            onBlur={() => void saveBaseUrl()}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
        </div>
      </div>

      {/* API 类型 */}
      <div className="pv-cred-row">
        <span className="pv-cred-label">API 类型</span>
        <div className="pv-cred-field">
          <Select value={effectiveApi} onChange={(e) => void saveApi(e.target.value)}>
            {API_FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}

export default ApiKeyCredentials;
