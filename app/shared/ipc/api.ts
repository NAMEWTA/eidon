/**
 * shared/ipc/api.ts — `window.eidon` 的类型（renderer ↔ main 的唯一接缝面）。
 *
 * preload 用 contextBridge 暴露符合此接口的对象；renderer 经 `src/global.d.ts` 把
 * `window.eidon` 声明为 `EidonApi`。泛型约束确保 channel 名、请求体、响应体三者端到端对齐。
 */
import type { Channel, Req, Res } from "./channels";
import type { EidonEventName, EidonEventPayload } from "./events";

export interface EidonApi {
  /** 请求/响应：转发到 main 的 ipcMain.handle(channel)。 */
  invoke<C extends Channel>(channel: C, req: Req<C>): Promise<Res<C>>;
  /** 订阅主进程推送事件；返回退订函数。 */
  on<E extends EidonEventName>(
    event: E,
    cb: (payload: EidonEventPayload<E>) => void,
  ): () => void;
  /**
   * 取拖入文件的绝对路径（Electron 32+ webUtils.getPathForFile）。
   * HTML5 drop 拿到的 File 经此还原磁盘路径。
   */
  getPathForFile(file: File): string;
}
