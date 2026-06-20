/**
 * 原生菜单本地化字符串。
 * 两种语言：en / zh。文案逐字对齐旧实现，确保菜单交互完全一致。
 */
export interface MenuStrings {
  file: string;
  edit: string;
  view: string;
  help: string;
  window: string;
  new_md: string;
  new_txt: string;
  open_folder: string;
  save: string;
  save_as: string;
  print_item: string;
  close_tab: string;
  toggle_theme: string;
  toggle_sidebar: string;
  toggle_outline: string;
  cycle_view: string;
  ui_zoom_in: string;
  ui_zoom_out: string;
  ui_zoom_reset: string;
  editor_zoom_in: string;
  editor_zoom_out: string;
  editor_zoom_reset: string;
  preview_zoom_in: string;
  preview_zoom_out: string;
  preview_zoom_reset: string;
  palette: string;
  global_search: string;
  settings_menu: string;
  md_help: string;
  about: string;
}

const ZH: MenuStrings = {
  file: "文件",
  edit: "编辑",
  view: "视图",
  help: "帮助",
  window: "窗口",
  new_md: "新建 Markdown",
  new_txt: "新建纯文本",
  open_folder: "打开文件夹…",
  save: "保存",
  save_as: "另存为…",
  print_item: "打印…",
  close_tab: "关闭标签页",
  toggle_theme: "切换主题",
  toggle_sidebar: "切换文件树",
  toggle_outline: "切换大纲",
  cycle_view: "切换视图模式 (编辑/分栏/预览)",
  ui_zoom_in: "整体界面：放大",
  ui_zoom_out: "整体界面：缩小",
  ui_zoom_reset: "整体界面：复位",
  editor_zoom_in: "编辑器：放大字号",
  editor_zoom_out: "编辑器：缩小字号",
  editor_zoom_reset: "编辑器：复位字号",
  preview_zoom_in: "预览：放大字号",
  preview_zoom_out: "预览：缩小字号",
  preview_zoom_reset: "预览：复位字号",
  palette: "命令面板",
  global_search: "在文件夹中搜索…",
  settings_menu: "设置…",
  md_help: "Markdown 速查",
  about: "关于 EIDON",
};

const EN: MenuStrings = {
  file: "File",
  edit: "Edit",
  view: "View",
  help: "Help",
  window: "Window",
  new_md: "New Markdown",
  new_txt: "New Plain Text",
  open_folder: "Open Folder…",
  save: "Save",
  save_as: "Save As…",
  print_item: "Print…",
  close_tab: "Close Tab",
  toggle_theme: "Toggle Theme",
  toggle_sidebar: "Toggle File Tree",
  toggle_outline: "Toggle Outline",
  cycle_view: "Cycle Edit/Split/Preview",
  ui_zoom_in: "UI: Zoom In",
  ui_zoom_out: "UI: Zoom Out",
  ui_zoom_reset: "UI: Reset Zoom",
  editor_zoom_in: "Editor: Zoom In",
  editor_zoom_out: "Editor: Zoom Out",
  editor_zoom_reset: "Editor: Reset Zoom",
  preview_zoom_in: "Preview: Zoom In",
  preview_zoom_out: "Preview: Zoom Out",
  preview_zoom_reset: "Preview: Reset Zoom",
  palette: "Command Palette",
  global_search: "Search in Folder…",
  settings_menu: "Settings…",
  md_help: "Markdown Cheatsheet",
  about: "About EIDON",
};

export function stringsFor(lang: string): MenuStrings {
  return lang === "zh" ? ZH : EN;
}
