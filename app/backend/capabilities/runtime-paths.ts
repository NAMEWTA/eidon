/**
 * 运行时路径注入点（保持 capabilities 不依赖 electron）。
 *
 * 应用数据/配置目录经 Electron 的 app.getPath 解析；
 * 在 Electron 下这些只有 main 进程能问（`app.getPath('userData')`、`process.resourcesPath`）。
 * 为保持各能力模块「仅 node:* + 库、可单测」，main/index.ts 在启动时调用 setRuntimePaths 注入，
 * 能力层只读这里的纯字符串，不直接 import electron。
 */
export interface RuntimePaths {
  /** 应用数据目录（缓存等），对应 Electron userData。 */
  userData: string;
  /** 应用配置目录（用户词典等）。 */
  userConfig: string;
  /** 内置字典目录（en_US.aff/.dic 所在），生产=resourcesPath/dicts，dev=app/resources/dicts。 */
  dicts: string;
}

let paths: RuntimePaths = {
  userData: "",
  userConfig: "",
  dicts: "",
};

/** main/index.ts 启动时注入真实路径。 */
export function setRuntimePaths(next: RuntimePaths): void {
  paths = next;
}

export function getRuntimePaths(): RuntimePaths {
  return paths;
}
