/**
 * 原生菜单构建。
 *
 * 菜单项 id 稳定（file.new / view.cycleView / help.about …），点击经
 * emitEvent("eidon:menu", id) 转发给渲染层分发命令（替代旧 `on_menu_event` + `app.emit`）。
 * Edit 用 Electron role；macOS 首个子菜单为 App 菜单（About/设置/服务/隐藏/退出，HIG 约定）。
 */
import { Menu, type MenuItemConstructorOptions } from "electron";
import { emitEvent } from "../../ipc/emit";
import { stringsFor } from "./strings";

const isMac = process.platform === "darwin";

/** 自定义命令项：点击 → 发 eidon:menu(id)。 */
function cmd(id: string, label: string, accelerator?: string): MenuItemConstructorOptions {
  return {
    id,
    label,
    accelerator,
    click: () => emitEvent("eidon:menu", id),
  };
}

/** 按语言构建并应用菜单。 */
export function buildAndSetMenu(lang: string): void {
  const s = stringsFor(lang);

  const fileSubmenu: MenuItemConstructorOptions = {
    label: s.file,
    submenu: [
      cmd("file.new", s.new_md, "CmdOrCtrl+N"),
      cmd("file.newText", s.new_txt, "CmdOrCtrl+Alt+N"),
      { type: "separator" },
      cmd("file.openFolder", s.open_folder),
      { type: "separator" },
      cmd("file.save", s.save, "CmdOrCtrl+S"),
      cmd("file.saveAs", s.save_as, "CmdOrCtrl+Shift+S"),
      { type: "separator" },
      cmd("file.print", s.print_item, "CmdOrCtrl+P"),
      { type: "separator" },
      cmd("file.closeTab", s.close_tab, "CmdOrCtrl+W"),
    ],
  };

  const editSubmenu: MenuItemConstructorOptions = {
    label: s.edit,
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  };

  const viewSubmenu: MenuItemConstructorOptions = {
    label: s.view,
    submenu: [
      cmd("view.toggleTheme", s.toggle_theme),
      { type: "separator" },
      cmd("view.toggleFileTree", s.toggle_sidebar, "CmdOrCtrl+B"),
      cmd("view.toggleOutline", s.toggle_outline, "CmdOrCtrl+Shift+O"),
      cmd("view.cycleView", s.cycle_view, "CmdOrCtrl+Shift+P"),
      { type: "separator" },
      cmd("view.zoomUiIn", s.ui_zoom_in, "CmdOrCtrl+="),
      cmd("view.zoomUiOut", s.ui_zoom_out, "CmdOrCtrl+-"),
      cmd("view.zoomUiReset", s.ui_zoom_reset, "CmdOrCtrl+0"),
      { type: "separator" },
      cmd("view.zoomEditorIn", s.editor_zoom_in, "CmdOrCtrl+Shift+="),
      cmd("view.zoomEditorOut", s.editor_zoom_out, "CmdOrCtrl+Shift+-"),
      cmd("view.zoomEditorReset", s.editor_zoom_reset, "CmdOrCtrl+Shift+0"),
      { type: "separator" },
      cmd("view.zoomPreviewIn", s.preview_zoom_in, "CmdOrCtrl+Control+="),
      cmd("view.zoomPreviewOut", s.preview_zoom_out, "CmdOrCtrl+Control+-"),
      cmd("view.zoomPreviewReset", s.preview_zoom_reset, "CmdOrCtrl+Control+0"),
      { type: "separator" },
      cmd("view.cmdPalette", s.palette, "CmdOrCtrl+Shift+K"),
      cmd("search.global", s.global_search, "CmdOrCtrl+Shift+F"),
      { type: "separator" },
      cmd("view.settings", s.settings_menu, "CmdOrCtrl+,"),
    ],
  };

  const helpSubmenu: MenuItemConstructorOptions = {
    label: s.help,
    submenu: [cmd("help.markdown", s.md_help, "F1"), { type: "separator" }, cmd("help.about", s.about)],
  };

  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    // macOS App 菜单：About(原生面板) / 设置 / 服务 / 隐藏 / 退出。
    template.push({
      label: "EIDON",
      submenu: [
        { role: "about" },
        { type: "separator" },
        cmd("view.settings", s.settings_menu, "CmdOrCtrl+,"),
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  template.push(fileSubmenu, editSubmenu, viewSubmenu);

  if (isMac) {
    template.push({
      label: s.window,
      submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "close" }],
    });
  }

  template.push(helpSubmenu);

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
