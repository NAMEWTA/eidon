#[path = "shell/app_build.rs"]
pub mod app_build;
#[path = "editor/file_ops.rs"]
pub mod file_ops;
#[path = "knowledge/search.rs"]
pub mod search;
#[path = "knowledge/workspace_index.rs"]
pub mod workspace_index;
#[path = "knowledge/spellcheck.rs"]
pub mod spellcheck;
#[path = "editor/pandoc.rs"]
pub mod pandoc;
// AutoGit + GitHub sync rely on libgit2 (vendored). Cross-compiling libgit2
// + openssl through the NDK is painful and these are desktop-class features
// (the user shouldn't be pushing to GitHub from a phone). Gate them out of
// Android — frontend already hides any UI that calls into these commands
// when the Tauri command resolution fails.
#[cfg(not(target_os = "android"))]
#[path = "git/git_history.rs"]
pub mod git_history;
#[cfg(not(target_os = "android"))]
#[path = "git/git_ops.rs"]
pub mod git_ops;
// 历史版本上限：repo 体积报告 + 破坏性历史修剪（保留最近 N 提交 + best-effort gc，见 ADR-0023）。
#[cfg(not(target_os = "android"))]
#[path = "git/git_prune.rs"]
pub mod git_prune;
// v2.5 F6 CJK proofread — flags common Chinese typos with one-click fixes.
#[path = "knowledge/cjk_proofread.rs"]
pub mod cjk_proofread;
// v2.6 GitHub-backed sync — extends v2.2 AutoGit with push/pull to a
// user-owned GitHub repo. PAT in OS keychain, config in .eidon-sync/sync.json.
// Same git2 dep → same Android gate as git_history.
#[cfg(not(target_os = "android"))]
#[path = "git/github_sync.rs"]
pub mod github_sync;
// v2.6.1 cloud-folder detection (iCloud / Dropbox / OneDrive / Google Drive)
// + cross-device session restore via per-device JSON.
#[path = "git/cloud_folder.rs"]
pub mod cloud_folder;
// v2.6.3 workspace-level E2EE: passphrase → Argon2id → key in keyring;
// XChaCha20-Poly1305 over each .md before push, decrypt after pull.
#[path = "git/crypto.rs"]
pub mod crypto;
// PR #24 (@beihai23) external file-change watcher — preview mode auto-reloads,
// edit / split modes pop a reload-vs-keep dialog.
#[path = "editor/watcher.rs"]
pub mod watcher;

// v2.3 dev WebDriver bridge — debug builds only.
#[cfg(debug_assertions)]
#[path = "shell/dev_bridge.rs"]
pub mod dev_bridge;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init());

    #[cfg(desktop)]
    let builder = builder.plugin(
        tauri_plugin_window_state::Builder::default()
            .with_state_flags(tauri_plugin_window_state::StateFlags::all())
            .build(),
    );

    let builder = builder.manage(watcher::WatcherState::new());
    builder
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                dev_bridge::spawn(app.handle().clone());
            }
            // Show the window only after first paint to suppress the
            // position-jump flicker on Windows (issue #60). The window
            // is born hidden (tauri.conf.json: "visible": false) and
            // we reveal it here once the webview has settled.
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                use tauri::Manager;
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            #[cfg(any(target_os = "android", target_os = "ios"))]
            {
                let _ = app;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_build::app_build_info,
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
            #[cfg(not(target_os = "android"))]
            git_history::git_workspace_status,
            #[cfg(not(target_os = "android"))]
            git_history::git_init_workspace,
            #[cfg(not(target_os = "android"))]
            git_history::git_auto_commit,
            #[cfg(not(target_os = "android"))]
            git_history::git_file_history,
            #[cfg(not(target_os = "android"))]
            git_history::git_file_diff,
            #[cfg(not(target_os = "android"))]
            git_history::git_file_at_version,
            #[cfg(not(target_os = "android"))]
            git_history::git_rollback_file,
            #[cfg(not(target_os = "android"))]
            git_ops::git_has_dirty_changes,
            #[cfg(not(target_os = "android"))]
            git_ops::git_create_branch,
            #[cfg(not(target_os = "android"))]
            git_ops::git_checkout,
            #[cfg(not(target_os = "android"))]
            git_ops::git_restore_head,
            #[cfg(not(target_os = "android"))]
            git_ops::git_delete_branch,
            #[cfg(not(target_os = "android"))]
            git_prune::git_repo_size,
            #[cfg(not(target_os = "android"))]
            git_prune::git_prune_history,
            cjk_proofread::cjk_proofread,
            #[cfg(not(target_os = "android"))]
            github_sync::github_set_token,
            #[cfg(not(target_os = "android"))]
            github_sync::github_clear_token,
            #[cfg(not(target_os = "android"))]
            github_sync::github_has_token,
            #[cfg(not(target_os = "android"))]
            github_sync::github_user,
            #[cfg(not(target_os = "android"))]
            github_sync::github_list_repos,
            #[cfg(not(target_os = "android"))]
            github_sync::github_create_vault_repo,
            #[cfg(not(target_os = "android"))]
            github_sync::github_link_workspace,
            #[cfg(not(target_os = "android"))]
            github_sync::github_set_config,
            #[cfg(not(target_os = "android"))]
            github_sync::github_unlink_workspace,
            #[cfg(not(target_os = "android"))]
            github_sync::github_enable_encryption,
            #[cfg(not(target_os = "android"))]
            github_sync::github_sync_status,
            #[cfg(not(target_os = "android"))]
            github_sync::github_push,
            #[cfg(not(target_os = "android"))]
            github_sync::github_pull,
            #[cfg(not(target_os = "android"))]
            github_sync::github_resolve_conflict,
            #[cfg(not(target_os = "android"))]
            github_sync::proxy_get,
            #[cfg(not(target_os = "android"))]
            github_sync::proxy_set,
            cloud_folder::cloud_folder_detect,
            cloud_folder::device_id_get_or_create,
            cloud_folder::session_save,
            cloud_folder::session_load,
            cloud_folder::session_list_others,
            crypto::crypto_status,
            crypto::crypto_set_passphrase,
            crypto::crypto_clear_passphrase,
            crypto::crypto_encrypt_for_push,
            crypto::crypto_decrypt_after_pull,
            watcher::watch_file,
            watcher::unwatch_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
