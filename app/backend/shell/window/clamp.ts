/**
 * 把窗口夹回当前显示器工作区。
 *
 * 防两类 window-state 还原故障：①超大尺寸（5K 存的尺寸还原到 1440p 笔记本）；②越界位置
 * （已拔掉的副屏坐标 / 标题栏藏到 macOS 菜单栏后）。尺寸/位置仍有效则保留用户布局；越界则夹小并
 * 在当前显示器居中。Electron 的 workArea 已自动排除菜单栏/任务栏，无需再手留 40px。
 * 最大化/全屏窗口已由 OS 贴合显示器，直接跳过（避免触发 Windows「还原后又缩小」#56）。
 */
import { screen, type BrowserWindow } from "electron";

const MIN_W = 480;
const MIN_H = 360;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(v, hi));
}

export function clampWindowToMonitor(win: BrowserWindow): void {
  if (win.isMaximized() || win.isFullScreen()) return;

  const b = win.getBounds();
  const wa = screen.getDisplayMatching(b).workArea;

  const maxW = wa.width;
  const maxH = wa.height;
  const newW = clamp(b.width, MIN_W, maxW);
  const newH = clamp(b.height, MIN_H, maxH);
  const sizeClamped = newW !== b.width || newH !== b.height;

  const positionInvalid =
    b.x < wa.x ||
    b.x + newW > wa.x + wa.width ||
    b.y < wa.y ||
    b.y + newH > wa.y + wa.height;

  if (sizeClamped || positionInvalid) {
    const newX = wa.x + Math.round((wa.width - newW) / 2);
    const centeredY = wa.y + Math.round((wa.height - newH) / 2);
    const newY = Math.max(wa.y, centeredY);
    win.setBounds({ x: newX, y: newY, width: newW, height: newH });
  } else if (sizeClamped) {
    win.setBounds({ width: newW, height: newH });
  }
}
