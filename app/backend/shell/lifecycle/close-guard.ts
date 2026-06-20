/**
 * 未存内容关闭确认守卫。
 *
 * 主窗口关闭请求先被拦截，发 `eidon:close-requested` 给渲染层；渲染层确认后调 `shell:forceClose`
 * （置 force 标志并真正 close）。再次触发的 close 因 force 已置而放行。
 */
let forceClose = false;

/** shell:forceClose 调用：渲染层已确认丢弃未存内容。 */
export function markForceClose(): void {
  forceClose = true;
}

/** close 事件是否应被拦截（尚未确认）。 */
export function shouldPreventClose(): boolean {
  return !forceClose;
}
