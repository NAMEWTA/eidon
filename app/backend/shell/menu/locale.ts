/**
 * 语言偏好持久化。
 *
 * 前端在 Settings→Language 变更时写 `~/.eidon-language`；启动读取用于初始菜单语言。
 * 仅接受 "en"/"zh"，其它/缺失回退 "en"。无 electron 依赖。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function langPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir() || os.tmpdir();
  return path.join(home, ".eidon-language");
}

export function readSavedLanguage(): string {
  try {
    const s = fs.readFileSync(langPath(), "utf8").trim();
    return s === "en" || s === "zh" ? s : "en";
  } catch {
    return "en";
  }
}

export function saveLanguagePreference(lang: string): void {
  fs.writeFileSync(langPath(), lang.trim());
}
