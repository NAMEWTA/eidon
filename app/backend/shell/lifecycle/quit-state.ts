/**
 * 退出意图标志（托盘常驻模型，见决策 Q2）。
 *
 * 关窗默认隐藏到托盘、主进程继续托管 cron/桥接；只有「真正退出」（托盘菜单退出 / Cmd+Q /
 * app before-quit）才置位，使主窗口 close 走真正关闭 + 未存内容守卫，而非隐藏。
 */
let quitting = false;

/** 标记进入退出流程（托盘退出 / before-quit）。 */
export function setQuitting(value: boolean): void {
  quitting = value;
}

/** 当前是否处于退出流程（main-window close handler 据此决定隐藏还是关闭）。 */
export function isQuitting(): boolean {
  return quitting;
}
