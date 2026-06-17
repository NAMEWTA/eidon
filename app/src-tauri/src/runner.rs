#[path = "editor/file_ops.rs"]
mod file_ops;

#[path = "knowledge/search.rs"]
mod search;

#[path = "editor/convert.rs"]
mod convert;

#[path = "knowledge/workspace_index.rs"]
mod workspace_index;

#[path = "knowledge/spellcheck.rs"]
mod spellcheck;

#[path = "editor/pandoc.rs"]
mod pandoc;

#[path = "git/git_history.rs"]
mod git_history;
#[path = "git/git_ops.rs"]
mod git_ops;
#[path = "git/git_prune.rs"]
mod git_prune;

// v2.5 CJK proofread — flags common Chinese typos with one-click fixes.
#[path = "knowledge/cjk_proofread.rs"]
mod cjk_proofread;

// v2.6.1 cloud-folder detection + cross-device session restore.
#[path = "git/cloud_folder.rs"]
mod cloud_folder;


// v2.3 dev WebDriver bridge — debug builds only. Module file itself is
// `#[cfg(debug_assertions)]`-gated, so this `mod` line is too.
#[cfg(debug_assertions)]
#[path = "shell/dev_bridge.rs"]
mod dev_bridge;

#[path = "editor/watcher.rs"]
mod watcher;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{
    AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
};
use tauri::{Emitter, Manager, RunEvent};

/// Tell macOS AppKit to use the given language for native dialogs
/// (NSSavePanel/NSOpenPanel). Reads from a small preference file so the
/// setting survives across launches without needing Tauri state.
#[cfg(target_os = "macos")]
fn apply_macos_language(lang: &str) {
    use objc2::rc::autoreleasepool;
    use objc2_foundation::{NSArray, NSString, NSUserDefaults};

    let apple_lang = if lang == "zh" { "zh-Hans" } else { "en" };
    autoreleasepool(|_| unsafe {
        let defaults = NSUserDefaults::standardUserDefaults();
        let code = NSString::from_str(apple_lang);
        let arr = NSArray::from_vec(vec![code]);
        defaults.setObject_forKey(Some(&*arr), &*NSString::from_str("AppleLanguages"));
    });
}

#[cfg(not(target_os = "macos"))]
fn apply_macos_language(_lang: &str) {}

fn read_saved_language() -> String {
    // Frontend writes this file whenever the user changes Settings → Language.
    // Read at startup so system dialogs can use the right locale.
    let path = dirs_path();
    std::fs::read_to_string(&path)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| s == "en" || s == "zh")
        .unwrap_or_else(|| "en".to_string())
}

fn dirs_path() -> std::path::PathBuf {
    let mut p = dirs_home().unwrap_or_else(std::env::temp_dir);
    p.push(".eidon-language");
    p
}

fn dirs_home() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(std::path::PathBuf::from))
}

#[tauri::command]
fn save_language_preference(lang: String) -> Result<(), String> {
    let path = dirs_path();
    std::fs::write(&path, lang.trim()).map_err(|e| e.to_string())
}

/// Set to true by `force_close_window` command after the frontend confirms close.
static FORCE_CLOSE: AtomicBool = AtomicBool::new(false);

/// Frontend calls this after user confirms "Discard & Close".
#[tauri::command]
fn force_close_window(window: tauri::Window) {
    FORCE_CLOSE.store(true, Ordering::Relaxed);
    window.close().ok();
}

/// Localized menu strings. Two languages for now: "en" and "zh".
struct MenuStrings {
    file: &'static str,
    edit: &'static str,
    view: &'static str,
    help: &'static str,
    new_md: &'static str,
    new_txt: &'static str,
    open_folder: &'static str,
    save: &'static str,
    save_as: &'static str,
    print_item: &'static str,
    close_tab: &'static str,
    toggle_theme: &'static str,
    toggle_sidebar: &'static str,
    toggle_outline: &'static str,
    cycle_view: &'static str,
    // v4.3.0 PR #74 — 3-axis zoom (UI / Editor / Preview).
    ui_zoom_in: &'static str,
    ui_zoom_out: &'static str,
    ui_zoom_reset: &'static str,
    editor_zoom_in: &'static str,
    editor_zoom_out: &'static str,
    editor_zoom_reset: &'static str,
    preview_zoom_in: &'static str,
    preview_zoom_out: &'static str,
    preview_zoom_reset: &'static str,
    palette: &'static str,
    global_search: &'static str,
    settings_menu: &'static str,
    md_help: &'static str,
    about: &'static str,
}

fn strings_for(lang: &str) -> MenuStrings {
    if lang == "zh" {
        MenuStrings {
            file: "文件",
            edit: "编辑",
            view: "视图",
            help: "帮助",
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
        }
    } else {
        MenuStrings {
            file: "File",
            edit: "Edit",
            view: "View",
            help: "Help",
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
        }
    }
}

fn build_app_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    lang: &str,
) -> tauri::Result<tauri::menu::Menu<R>> {
    let s = strings_for(lang);

    let new_md = MenuItemBuilder::with_id("file.new", s.new_md)
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let new_txt = MenuItemBuilder::with_id("file.newText", s.new_txt)
        .accelerator("CmdOrCtrl+Alt+N")
        .build(app)?;
    let open_folder = MenuItemBuilder::with_id("file.openFolder", s.open_folder).build(app)?;
    let save = MenuItemBuilder::with_id("file.save", s.save)
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let save_as = MenuItemBuilder::with_id("file.saveAs", s.save_as)
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;
    let print_item = MenuItemBuilder::with_id("file.print", s.print_item)
        .accelerator("CmdOrCtrl+P")
        .build(app)?;
    let close_tab = MenuItemBuilder::with_id("file.closeTab", s.close_tab)
        .accelerator("CmdOrCtrl+W")
        .build(app)?;
    let file_submenu = SubmenuBuilder::new(app, s.file)
        .item(&new_md)
        .item(&new_txt)
        .separator()
        .item(&open_folder)
        .separator()
        .item(&save)
        .item(&save_as)
        .separator()
        .item(&print_item)
        .separator()
        .item(&close_tab)
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, s.edit)
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let toggle_theme = MenuItemBuilder::with_id("view.toggleTheme", s.toggle_theme).build(app)?;
    let toggle_sidebar = MenuItemBuilder::with_id("view.toggleFileTree", s.toggle_sidebar)
        .accelerator("CmdOrCtrl+B")
        .build(app)?;
    let toggle_outline = MenuItemBuilder::with_id("view.toggleOutline", s.toggle_outline)
        .accelerator("CmdOrCtrl+Shift+O")
        .build(app)?;
    let cycle_view = MenuItemBuilder::with_id("view.cycleView", s.cycle_view)
        .accelerator("CmdOrCtrl+Shift+P")
        .build(app)?;
    // v4.3.0 PR #74 — three independent zoom axes wired through native
    // menu accelerators (more reliable than JS keyboard handlers on macOS,
    // which the WKWebView can sometimes intercept). Action ids are
    // dispatched in App.vue's `dispatchMenuAction`.
    let ui_zoom_in = MenuItemBuilder::with_id("view.zoomUiIn", s.ui_zoom_in)
        .accelerator("CmdOrCtrl+=")
        .build(app)?;
    let ui_zoom_out = MenuItemBuilder::with_id("view.zoomUiOut", s.ui_zoom_out)
        .accelerator("CmdOrCtrl+-")
        .build(app)?;
    let ui_zoom_reset = MenuItemBuilder::with_id("view.zoomUiReset", s.ui_zoom_reset)
        .accelerator("CmdOrCtrl+0")
        .build(app)?;
    let editor_zoom_in = MenuItemBuilder::with_id("view.zoomEditorIn", s.editor_zoom_in)
        .accelerator("CmdOrCtrl+Shift+=")
        .build(app)?;
    let editor_zoom_out = MenuItemBuilder::with_id("view.zoomEditorOut", s.editor_zoom_out)
        .accelerator("CmdOrCtrl+Shift+-")
        .build(app)?;
    let editor_zoom_reset = MenuItemBuilder::with_id("view.zoomEditorReset", s.editor_zoom_reset)
        .accelerator("CmdOrCtrl+Shift+0")
        .build(app)?;
    let preview_zoom_in = MenuItemBuilder::with_id("view.zoomPreviewIn", s.preview_zoom_in)
        .accelerator("CmdOrCtrl+Control+=")
        .build(app)?;
    let preview_zoom_out = MenuItemBuilder::with_id("view.zoomPreviewOut", s.preview_zoom_out)
        .accelerator("CmdOrCtrl+Control+-")
        .build(app)?;
    let preview_zoom_reset = MenuItemBuilder::with_id("view.zoomPreviewReset", s.preview_zoom_reset)
        .accelerator("CmdOrCtrl+Control+0")
        .build(app)?;
    let palette = MenuItemBuilder::with_id("view.cmdPalette", s.palette)
        .accelerator("CmdOrCtrl+Shift+K")
        .build(app)?;
    let global_search = MenuItemBuilder::with_id("search.global", s.global_search)
        .accelerator("CmdOrCtrl+Shift+F")
        .build(app)?;
    let settings_item = MenuItemBuilder::with_id("view.settings", s.settings_menu)
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let view_submenu = SubmenuBuilder::new(app, s.view)
        .item(&toggle_theme)
        .separator()
        .item(&toggle_sidebar)
        .item(&toggle_outline)
        .item(&cycle_view)
        .separator()
        .item(&ui_zoom_in)
        .item(&ui_zoom_out)
        .item(&ui_zoom_reset)
        .separator()
        .item(&editor_zoom_in)
        .item(&editor_zoom_out)
        .item(&editor_zoom_reset)
        .separator()
        .item(&preview_zoom_in)
        .item(&preview_zoom_out)
        .item(&preview_zoom_reset)
        .separator()
        .item(&palette)
        .item(&global_search)
        .separator()
        .item(&settings_item)
        .build()?;

    let md_help = MenuItemBuilder::with_id("help.markdown", s.md_help)
        .accelerator("F1")
        .build(app)?;
    let about = MenuItemBuilder::with_id("help.about", s.about).build(app)?;

    let help_submenu = SubmenuBuilder::new(app, s.help)
        .item(&md_help)
        .separator()
        .item(&about)
        .build()?;

    // macOS: the first submenu becomes the "App menu" (titled with the
    // app's process name) and is where users go for About / Settings /
    // Quit by HIG convention. Without this, ⌘Q does nothing and the
    // last menu item visually becomes "Close Tab" (issue #31).
    #[cfg(target_os = "macos")]
    {
        let app_about_meta = AboutMetadata {
            name: Some("EIDON".into()),
            version: Some(env!("CARGO_PKG_VERSION").into()),
            credits: Some("Made by 智通 / xiangdong li".into()),
            authors: Some(vec!["xiangdong li".into()]),
            comments: Some("Local-first structured knowledge IDE.".into()),
            website: Some("https://github.com/NAMEWTA/eidon".into()),
            website_label: Some("github.com/NAMEWTA/eidon".into()),
            ..Default::default()
        };
        let app_submenu = SubmenuBuilder::new(app, "EIDON")
            .about(Some(app_about_meta))
            .separator()
            .item(&settings_item)
            .separator()
            .item(&PredefinedMenuItem::services(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::hide(app, None)?)
            .item(&PredefinedMenuItem::hide_others(app, None)?)
            .item(&PredefinedMenuItem::show_all(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::quit(app, None)?)
            .build()?;

        let window_submenu = SubmenuBuilder::new(app, if lang == "zh" { "窗口" } else { "Window" })
            .item(&PredefinedMenuItem::minimize(app, None)?)
            .item(&PredefinedMenuItem::maximize(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::close_window(app, None)?)
            .build()?;

        return MenuBuilder::new(app)
            .items(&[
                &app_submenu,
                &file_submenu,
                &edit_submenu,
                &view_submenu,
                &window_submenu,
                &help_submenu,
            ])
            .build();
    }

    #[cfg(not(target_os = "macos"))]
    MenuBuilder::new(app)
        .items(&[&file_submenu, &edit_submenu, &view_submenu, &help_submenu])
        .build()
}

/// Frontend calls this when user changes language in Settings.
#[tauri::command]
fn set_menu_language(app: tauri::AppHandle, lang: String) -> Result<(), String> {
    let menu = build_app_menu(&app, &lang).map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| e.to_string())?;
    Ok(())
}

/// One-shot guard so the size/position fit-up only runs once per launch.
/// After the plugin's restore (or the Ready-event fallback) triggers it,
/// further user moves/resizes are left alone.
static MAIN_FIT_DONE: AtomicBool = AtomicBool::new(false);

/// Apply the size + position clamp + show + focus exactly once. Subsequent
/// calls are cheap no-ops via the `MAIN_FIT_DONE` flag.
fn fit_main_window_once(win: &tauri::WebviewWindow) {
    if MAIN_FIT_DONE
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }
    clamp_window_to_monitor(win);
    let _ = win.show();
    let _ = win.unminimize();
    let _ = win.set_focus();
}

/// Re-fit the main window into its current monitor's work area before show.
///
/// Two failure modes from `tauri-plugin-window-state` we have to defend
/// against on every launch:
/// 1. **Oversize restore** — a saved 2880×1740 from a 5K display, restored
///    on a 1440p laptop, leaves the bottom edge off-screen.
/// 2. **Out-of-bounds position** — saved coordinates from a now-disconnected
///    secondary monitor, or a saved Y that tucks the title bar behind the
///    macOS menu bar.
///
/// Behavior:
/// - If size or position is still valid for the current monitor, the user's
///   chosen layout is preserved (we don't fight intentional positioning).
/// - If anything was out of bounds, the window is clamped to a sensible
///   size and **recentered on the current monitor**. Centering > pinning to
///   an edge: a left-edge-pinned window after a display change reads as
///   "broken layout," whereas centered reads as "fresh start, sane state."
///
/// 40px is reserved at the top of the work area for the macOS menu bar.
fn clamp_window_to_monitor(win: &tauri::WebviewWindow) {
    // A maximized or fullscreen window is already sized to the monitor by the
    // OS — clamping it would call set_size(), which un-maximizes and shrinks
    // it. That's the Windows "restores maximized, then shrinks" bug (#56): the
    // window-state plugin restored the maximized state, then this clamp fired
    // on the restore's Resized event and undid it. Leave such windows alone.
    if win.is_maximized().unwrap_or(false) || win.is_fullscreen().unwrap_or(false) {
        return;
    }

    // The macOS global menu bar overlays the top of the screen, so reserve a
    // strip for it. Windows / Linux have no such bar — reserving there made a
    // legitimately near-full-height restored window get shrunk by 40px.
    #[cfg(target_os = "macos")]
    const MENU_BAR_RESERVE: i32 = 40;
    #[cfg(not(target_os = "macos"))]
    const MENU_BAR_RESERVE: i32 = 0;
    const MIN_W: i32 = 480;
    const MIN_H: i32 = 360;

    let Ok(Some(monitor)) = win.current_monitor() else { return; };
    let scale = monitor.scale_factor();
    let mon_w = (monitor.size().width as f64 / scale).round() as i32;
    let mon_h = (monitor.size().height as f64 / scale).round() as i32;
    let mon_x = (monitor.position().x as f64 / scale).round() as i32;
    let mon_y = (monitor.position().y as f64 / scale).round() as i32;

    let Ok(outer) = win.outer_size() else { return; };
    let cur_w = (outer.width as f64 / scale).round() as i32;
    let cur_h = (outer.height as f64 / scale).round() as i32;

    let max_w = mon_w;
    let max_h = mon_h - MENU_BAR_RESERVE;
    let new_w = cur_w.clamp(MIN_W, max_w);
    let new_h = cur_h.clamp(MIN_H, max_h);
    let size_clamped = new_w != cur_w || new_h != cur_h;

    let Ok(outer_pos) = win.outer_position() else { return; };
    let cur_x = (outer_pos.x as f64 / scale).round() as i32;
    let cur_y = (outer_pos.y as f64 / scale).round() as i32;

    // Position is "off-monitor" if any edge of the window falls outside the
    // current monitor's work area (top edge above the menu bar reserve, or
    // any other edge past the monitor bounds for the post-clamp size).
    let position_invalid = cur_x < mon_x
        || cur_x + new_w > mon_x + mon_w
        || cur_y < mon_y + MENU_BAR_RESERVE
        || cur_y + new_h > mon_y + mon_h;

    if size_clamped {
        let _ = win.set_size(tauri::LogicalSize::new(new_w as u32, new_h as u32));
    }

    if size_clamped || position_invalid {
        let new_x = mon_x + (mon_w - new_w) / 2;
        let centered_y = mon_y + (mon_h - new_h) / 2;
        let new_y = centered_y.max(mon_y + MENU_BAR_RESERVE);
        let _ = win.set_position(tauri::LogicalPosition::new(new_x, new_y));
    }
}

pub fn run() {
    // IMPORTANT: must be called BEFORE NSApplication loads (i.e. before
    // `tauri::Builder::default()` below) so AppKit picks up the locale
    // for all system panels.
    let saved_lang = read_saved_language();
    apply_macos_language(&saved_lang);

    let builder = tauri::Builder::default();

    let builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    // v4.3.x — issue #56 reopen: the original fix landed in `lib.rs::run`
    // but `main.rs` calls `runner::run` instead, so the StateFlags::all()
    // call there was never reached. The plugin's default StateFlags is
    // `POSITION | SIZE` — missing MAXIMIZED + FULLSCREEN + DECORATIONS,
    // which is why Windows users kept seeing the maximized state forgotten
    // on relaunch. Patch this site (the live one) too.
    #[cfg(desktop)]
    let builder = builder.plugin(
        tauri_plugin_window_state::Builder::default()
            .with_state_flags(tauri_plugin_window_state::StateFlags::all())
            .build(),
    );

    let app = builder
        .manage(watcher::WatcherState::new())
        .invoke_handler(tauri::generate_handler![
            file_ops::read_file,
            file_ops::read_binary_file,
            file_ops::write_file,
            file_ops::write_binary_file,
            file_ops::print_webview,
            file_ops::copy_file,
            file_ops::list_dir,
            file_ops::fs_create_file,
            file_ops::fs_create_dir,
            file_ops::fs_delete,
            file_ops::fs_rename,
            search::search_in_dir,
            force_close_window,
            set_menu_language,
            save_language_preference,
            convert::convert_file_to_markdown,
            workspace_index::workspace_index_init,
            workspace_index::workspace_index_files,
            workspace_index::workspace_index_backlinks,
            workspace_index::workspace_index_tags,
            workspace_index::workspace_index_resolve,
            workspace_index::workspace_index_rescan,
            spellcheck::spellcheck_init,
            spellcheck::spellcheck_check,
            spellcheck::spellcheck_suggest,
            spellcheck::spellcheck_add_to_dict,
            spellcheck::spellcheck_load_user_dict,
            pandoc::pandoc_detect,
            pandoc::pandoc_export,
            git_history::git_workspace_status,
            git_history::git_init_workspace,
            git_history::git_auto_commit,
            git_history::git_file_history,
            git_history::git_file_diff,
            git_history::git_file_at_version,
            git_history::git_rollback_file,
            git_ops::git_has_dirty_changes,
            git_ops::git_create_branch,
            git_ops::git_checkout,
            git_ops::git_restore_head,
            git_ops::git_delete_branch,
            git_prune::git_repo_size,
            git_prune::git_prune_history,
            cjk_proofread::cjk_proofread,
            cloud_folder::cloud_folder_detect,
            cloud_folder::device_id_get_or_create,
            cloud_folder::session_save,
            cloud_folder::session_load,
            cloud_folder::session_list_others,
            watcher::watch_file,
            watcher::unwatch_file,
        ])
        .on_menu_event(|app_handle, event| {
            // Forward every menu click to the frontend as a single event
            // with the menu item id as payload. App.vue dispatches actions
            // based on this id.
            let id = event.id().0.clone();
            let _ = app_handle.emit("eidon://menu", id);
        })
        .setup(|app| {
            // Build initial menu in English — the frontend will call
            // `set_menu_language` on mount to apply the user's saved preference.
            let menu = build_app_menu(app.handle(), "en")?;
            app.set_menu(menu)?;

            // The window-state plugin's restore_state is dispatched via
            // `run_on_main_thread`, so it doesn't fire until AFTER setup
            // returns AND after the run loop has started processing. Hook
            // the main window's first Resized OR Moved event — that's the
            // restore — and clamp at that moment. A second hook in the
            // run-loop event match (`RunEvent::Ready` + 400ms timer) acts
            // as a fallback when there's no saved state to restore.
            if let Some(win) = app.get_webview_window("main") {
                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    if matches!(
                        event,
                        tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_)
                    ) {
                        fit_main_window_once(&win_clone);
                    }
                });
            }

            // NOTE: do NOT drain PendingOpen here. The frontend calls
            // `drain_pending_opens` on mount instead, which avoids the
            // race condition where the "opened-file" event fires before
            // the JS listener is ready (happens on macOS cold start).

            // v2.3: in debug builds, start the WebDriver bridge so
            // `eidon-dev-mcp` can drive the live UI from outside.
            // Release builds compile this out entirely.
            #[cfg(debug_assertions)]
            {
                dev_bridge::spawn(app.handle().clone());
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        match &event {
            // ---- Post-restore window setup ----
            // `RunEvent::Ready` fires after the run loop has started, which
            // means after `tauri-plugin-window-state` has had a chance to
            // process its `run_on_main_thread`-queued restore_state call.
            // Two things we do here that we can't reliably do in `setup`:
            //
            // 1. Clamp the restored window to the current monitor (size +
            //    position). The plugin happily restores a saved 2556×1320
            //    @ x=1207 from a previous multi-monitor session onto a
            //    single 2560-wide monitor, leaving the right edge 1.2k px
            //    off-screen. Always recenter when the saved layout is
            //    invalid for the current monitor; preserve when valid.
            //
            // 2. macOS-only: re-issue show + set_focus so EIDON becomes
            //    frontmost. `set_focus` from `setup` fires before NSApp
            //    has finished `applicationDidFinishLaunching` and gets
            //    silently dropped, leaving EIDON launched behind the
            //    parent app (Finder / terminal) — the macOS menu bar
            //    keeps showing the previous app's menus until the user
            //    drags EIDON's window.
            RunEvent::Ready => {
                // Fallback path: when there's no saved window state for the
                // plugin to restore (fresh install, deleted state file), no
                // Resized/Moved event ever fires from the restore — the
                // setup-time `on_window_event` hook would never trigger and
                // the window would never get shown / focused. Schedule a
                // delayed fit on a background thread; the AtomicBool guard
                // makes it a no-op if the on_window_event hook beat us.
                let app_handle_clone = app_handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(400));
                    if let Some(win) = app_handle_clone.get_webview_window("main") {
                        fit_main_window_once(&win);
                    }
                });
            }

            // ---- Window close: intercept and ask frontend ----
            // Only the main window gets the unsaved-tabs check. EIDON is a
            // single-window app; this label guard stays as a defensive no-op
            // so any non-main window (should one ever appear) closes directly
            // instead of tripping the main window's unsaved-tabs listener.
            RunEvent::WindowEvent {
                event: tauri::WindowEvent::CloseRequested { api, .. },
                label,
                ..
            } => {
                if label != "main" {
                    return; // let the auxiliary window close itself
                }
                if FORCE_CLOSE.load(Ordering::Relaxed) {
                    // Frontend confirmed — let the close proceed.
                    return;
                }
                // Prevent the close and ask the frontend to check unsaved tabs.
                api.prevent_close();
                let _ = app_handle.emit("eidon://close-requested", ());
            }

            _ => {}
        }
    });
}
