/**
 * backend/capabilities/ai/channels-store —— `~/.eidon/channels.json` IO（多 Agent 群聊频道，纯 node）。
 * 频道 = 一组成员 Agent id；群聊一轮里每个成员依次基于「用户消息 + 在先成员发言」作答（service 编排）。
 */
import { ChannelsFileSchema, type Channel, type ChannelsFile } from "@shared/contracts";
import { createNodeId } from "@shared/utils";

import { channelsPath } from "./paths";
import { readJson, writeJson } from "./store";

const empty = (): ChannelsFile => ({ version: 1, channels: [] });

export async function listChannels(): Promise<Channel[]> {
  return (await readJson(ChannelsFileSchema, channelsPath(), empty())).channels;
}

async function writeChannels(channels: Channel[]): Promise<void> {
  await writeJson(ChannelsFileSchema, channelsPath(), { version: 1, channels });
}

export async function createChannel(name: string, members: string[]): Promise<Channel> {
  const channel: Channel = {
    id: createNodeId(),
    name: name.trim() || "新频道",
    members,
    createdAt: new Date().toISOString(),
  };
  const channels = await listChannels();
  channels.push(channel);
  await writeChannels(channels);
  return channel;
}

export async function updateChannel(
  id: string,
  patch: { name?: string; members?: string[] },
): Promise<Channel | null> {
  const channels = await listChannels();
  const idx = channels.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  channels[idx] = {
    ...channels[idx],
    name: patch.name ?? channels[idx].name,
    members: patch.members ?? channels[idx].members,
  };
  await writeChannels(channels);
  return channels[idx];
}

export async function deleteChannel(id: string): Promise<void> {
  await writeChannels((await listChannels()).filter((c) => c.id !== id));
}

export async function getChannel(id: string): Promise<Channel | null> {
  return (await listChannels()).find((c) => c.id === id) ?? null;
}
