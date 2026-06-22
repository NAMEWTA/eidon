/**
 * backend/capabilities/ai/tools-store —— `~/.eidon/tools.json` IO（全局工具开关，纯 node）。
 * 仅记录「被全局禁用」的内置工具名；其余默认可用（per-agent 再叠加白/黑名单）。
 */
import { ToolsFileSchema, type ToolsFile } from "@shared/contracts";

import { toolsPath } from "./paths";
import { readJson, writeJson } from "./store";

const empty = (): ToolsFile => ({ version: 1, disabled: [] });

export const readTools = (): Promise<ToolsFile> =>
  readJson(ToolsFileSchema, toolsPath(), empty());

export const writeTools = (data: ToolsFile): Promise<ToolsFile> =>
  writeJson(ToolsFileSchema, toolsPath(), data);

/** 全局启用/禁用某内置工具。 */
export async function setToolEnabled(name: string, enabled: boolean): Promise<void> {
  const file = await readTools();
  const disabled = new Set(file.disabled);
  if (enabled) disabled.delete(name);
  else disabled.add(name);
  await writeTools({ ...file, disabled: [...disabled] });
}
