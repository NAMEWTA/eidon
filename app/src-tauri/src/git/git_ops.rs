//! Git primitives for core runner orchestration.

use git2::{BranchType, Repository, StatusOptions};

#[tauri::command]
pub async fn git_has_dirty_changes(workspace: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let repo = Repository::open(&workspace).map_err(|e| format!("git open: {e}"))?;
        let mut opts = StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(true)
            .include_ignored(false);
        let statuses = repo
            .statuses(Some(&mut opts))
            .map_err(|e| format!("git status: {e}"))?;
        Ok(statuses.iter().any(|entry| {
            let status = entry.status();
            !status.is_empty() && !status.contains(git2::Status::IGNORED)
        }))
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

#[tauri::command]
pub async fn git_create_branch(workspace: String, branch: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let repo = Repository::open(&workspace).map_err(|e| format!("git open: {e}"))?;
        let head = repo.head().map_err(|e| format!("head: {e}"))?;
        let oid = head.target().ok_or_else(|| "HEAD has no target".to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| format!("commit: {e}"))?;
        repo.branch(&branch, &commit, false)
            .map_err(|e| format!("branch: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

#[tauri::command]
pub async fn git_checkout(workspace: String, branch: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || checkout(&workspace, &branch))
        .await
        .map_err(|e| format!("join: {e}"))?
}

#[tauri::command]
pub async fn git_restore_head(workspace: String, branch: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || checkout(&workspace, &branch).map(|_| ()))
        .await
        .map_err(|e| format!("join: {e}"))?
}

#[tauri::command]
pub async fn git_delete_branch(workspace: String, branch: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let repo = Repository::open(&workspace).map_err(|e| format!("git open: {e}"))?;
        let mut br = repo
            .find_branch(&branch, BranchType::Local)
            .map_err(|e| format!("find branch: {e}"))?;
        br.delete().map_err(|e| format!("delete branch: {e}"))
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

fn checkout(workspace: &str, branch: &str) -> Result<String, String> {
    let repo = Repository::open(workspace).map_err(|e| format!("git open: {e}"))?;
    let prev = repo
        .head()
        .ok()
        .and_then(|head| head.shorthand().map(|s| s.to_string()))
        .unwrap_or_else(|| "main".to_string());
    let branch_ref = format!("refs/heads/{branch}");
    let obj = repo
        .revparse_single(&branch_ref)
        .map_err(|e| format!("revparse {branch_ref}: {e}"))?;
    let mut opts = git2::build::CheckoutBuilder::new();
    opts.safe();
    repo.checkout_tree(&obj, Some(&mut opts))
        .map_err(|e| format!("checkout: {e}"))?;
    repo.set_head(&branch_ref)
        .map_err(|e| format!("set head: {e}"))?;
    Ok(prev)
}
