/**
 * backend/domain/ai/skills —— 经 Pi 的 DefaultResourceLoader 发现可用 skills。
 *
 * 扫描 cwd（工作区 `.agents/skills/`、向上至 git root）+ agentDir（全局 `~/.eidon/skills/` 等）。
 * 仅返回 name/description 投影，供 composer 的 `/skill:` 菜单与设置展示。
 */
import { DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

import type { SkillInfo } from "@shared/models";

export async function listSkills(cwd: string, agentDir: string): Promise<SkillInfo[]> {
  try {
    const loader = new DefaultResourceLoader({ cwd, agentDir });
    await loader.reload();
    return loader.getSkills().skills.map((s) => ({
      name: s.name,
      description: s.description,
    }));
  } catch {
    return [];
  }
}
