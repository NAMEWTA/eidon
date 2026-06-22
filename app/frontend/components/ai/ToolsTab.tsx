/**
 * ToolsTab —— 智能体设置「工具」子页（全局内置工具开关）。
 *
 * 从原 AiSettings 抽出：全局启用/禁用内置工具；每个助手还可在「助手」子页单独白/黑名单。
 * 渲染为带区隔的开关卡片网格。读写走 `tools:*` 通道。
 */
import { useEffect, useState } from 'react';

import { aiBridge } from '@bridge/ipc';
import { useAiStore } from '../../stores/ai';
import type { ToolInfo } from '@shared/models';
import { SettingsSection, Toggle, Banner } from '../settings/kit';

export function ToolsTab() {
  const store = useAiStore();
  const [tools, setTools] = useState<ToolInfo[]>([]);

  useEffect(() => {
    void store.init();
    void aiBridge.listTools().then(setTools);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleTool(name: string, enabled: boolean) {
    await aiBridge.setToolEnabled(name, enabled);
    setTools(await aiBridge.listTools());
  }

  return (
    <div>
      {!store.available && (
        <Banner warn>尚未配置模型提供商。请到「供应商」子页填入 API Key 后开始使用。</Banner>
      )}

      <SettingsSection
        title="全局工具"
        hint="这里全局启用/禁用内置工具；每个助手还可在「助手」子页单独白/黑名单。"
      >
        {tools.length === 0 ? (
          <div className="set-empty">暂无可配置的内置工具。</div>
        ) : (
          <div className="set-cardgrid">
            {tools.map((tool) => (
              <div key={tool.name} className={`set-option-card${tool.enabled ? ' is-on' : ''}`}>
                <div className="set-option-card__body">
                  <div className="set-option-card__name"><code>{tool.name}</code></div>
                  <div className="set-option-card__desc">{tool.description}</div>
                </div>
                <Toggle on={tool.enabled} onChange={(on) => void toggleTool(tool.name, on)} />
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}

export default ToolsTab;
