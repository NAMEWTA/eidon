/**
 * backend/ipc/handlers/ai.handlers —— AI / providers 域 IPC handler（薄层 → ai-service）。
 * 流式结果不走返回值，经 eidon:ai-stream / eidon:ai-session 事件推送。
 */
import { aiService } from "../../services/ai-service";
import type { IpcHandlers } from "../register";

export const aiHandlers: IpcHandlers = {
  "ai:isAvailable": () => aiService.isAvailable(),

  "providers:list": () => aiService.listProviders(),
  "providers:listModels": ({ provider }) => aiService.listModels(provider),
  "providers:setKey": async ({ provider, apiKey }) => {
    await aiService.setProviderKey(provider, apiKey);
  },
  "providers:setDefaultModel": async ({ model }) => {
    await aiService.setDefaultModel(model);
  },
  "providers:getDefaultModel": () => aiService.getDefaultModel(),
  "providers:setConfig": async ({ provider, patch }) => {
    await aiService.setProviderConfig(provider, patch);
  },
  "providers:setModelMeta": async ({ provider, modelId, meta }) => {
    await aiService.setModelMeta(provider, modelId, meta);
  },
  "providers:removeModelMeta": async ({ provider, modelId }) => {
    await aiService.removeModelMeta(provider, modelId);
  },
  "providers:remove": async ({ provider }) => {
    await aiService.removeProvider(provider);
  },
  "providers:test": ({ provider, baseUrl, api, apiKey }) =>
    aiService.testProvider({ provider, baseUrl, api, apiKey }),
  "providers:fetchModels": ({ provider, baseUrl, api, apiKey }) =>
    aiService.fetchProviderModels({ provider, baseUrl, api, apiKey }),

  "ai:newSession": ({ agentId, workspace }) =>
    aiService.newSession({ agentId, workspace }),
  "ai:prompt": async ({ sessionId, text }) => {
    await aiService.prompt(sessionId, text);
  },
  "ai:cancel": async ({ sessionId }) => {
    await aiService.cancel(sessionId);
  },
  "ai:setModel": ({ sessionId, model }) => aiService.setModel(sessionId, model),
  "ai:disposeSession": ({ sessionId }) => {
    aiService.disposeSession(sessionId);
  },
  "ai:sessionState": ({ sessionId }) => aiService.sessionState(sessionId),

  "agents:list": () => aiService.listAgents(),
  "agents:get": ({ agentId }) => aiService.getAgent(agentId),
  "agents:create": (input) => aiService.createAgent(input),
  "agents:update": ({ agentId, patch }) => aiService.updateAgent(agentId, patch),
  "agents:delete": async ({ agentId }) => {
    await aiService.deleteAgent(agentId);
  },

  "tools:list": () => aiService.listTools(),
  "tools:setEnabled": async ({ name, enabled }) => {
    await aiService.setToolEnabled(name, enabled);
  },
  "skills:list": ({ workspace }) => aiService.listSkills(workspace),

  "cron:list": ({ agentId }) => aiService.listCronJobs(agentId),
  "cron:add": ({ agentId, input }) => aiService.addCronJob(agentId, input),
  "cron:update": ({ agentId, jobId, patch }) =>
    aiService.updateCronJob(agentId, jobId, patch),
  "cron:toggle": ({ agentId, jobId }) => aiService.toggleCronJob(agentId, jobId),
  "cron:remove": async ({ agentId, jobId }) => {
    await aiService.removeCronJob(agentId, jobId);
  },

  "channels:list": () => aiService.listChannels(),
  "channels:create": ({ name, members }) => aiService.createChannel(name, members),
  "channels:update": ({ id, patch }) => aiService.updateChannel(id, patch),
  "channels:delete": async ({ id }) => {
    await aiService.deleteChannel(id);
  },
  "channels:prompt": async ({ channelId, text, workspace }) => {
    await aiService.promptChannel(channelId, text, workspace);
  },

  "bridge:listBindings": () => aiService.listBridgeBindings(),
  "bridge:status": () => aiService.bridgeStatus(),
  "bridge:bind": async (req) => {
    await aiService.bindBridge(req);
  },
  "bridge:setEnabled": async ({ platform, enabled }) => {
    await aiService.setBridgeEnabled(platform, enabled);
  },
  "bridge:unbind": async ({ platform }) => {
    await aiService.unbindBridge(platform);
  },
  // 扫码登录是长流程：不阻塞 IPC 返回，进度经 eidon:bridge-wechat-qr 事件推送。
  "bridge:wechatStartLogin": () => {
    void aiService.startWechatLogin();
  },
  "bridge:wechatCancelLogin": () => {
    aiService.cancelWechatLogin();
  },
};
