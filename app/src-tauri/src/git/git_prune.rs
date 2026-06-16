//! History pruning + repo-size reporting（见工程层 ADR-0023）。
//!
//! ADR-0015 原定 AutoGit 不改、本期不做「快照功能」。用户后续要求对版本历史设上限
//! （单仓最大提交数 / `.git` 最大体积），这需要**重写 git 历史**（破坏性操作）——
//! ADR-0023 记录此决策。`.git` 属本机缓存（「可迁移」铁律本就豁免 git 历史），重写只
//! 影响本地历史，绝不动 plain-file 这一真理源。
//!
//! - `git_repo_size`  —— `.git/` 目录字节数（仅供显示）。
//! - `git_prune_history` —— 保留最近 `max_commits` 个提交、把更早的压成一个合成根，
//!   随后尽力 `git gc` 回收磁盘。提交数 ≤ max_commits 时为 no-op。

use std::path::Path;
use std::process::Command;

use git2::{Repository, Signature};
use serde::Serialize;

fn open_repo(folder: &str) -> Result<Repository, String> {
    Repository::open(Path::new(folder)).map_err(|e| format!("git open failed: {}", e))
}

/// 提交签名：取全局 git config 的 user.name/email，缺省回退 `EIDON / eidon@local`。
fn build_signature(repo: &Repository) -> Result<Signature<'static>, String> {
    let cfg = repo.config().map_err(|e| format!("git config: {}", e))?;
    let name = cfg
        .get_string("user.name")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "EIDON".to_string());
    let email = cfg
        .get_string("user.email")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "eidon@local".to_string());
    Signature::now(&name, &email).map_err(|e| format!("signature: {}", e))
}

/// 递归累加目录下所有文件字节数。
fn dir_size(path: &Path) -> u64 {
    let mut total = 0u64;
    let entries = match std::fs::read_dir(path) {
        Ok(e) => e,
        Err(_) => return 0,
    };
    for entry in entries.flatten() {
        match entry.file_type() {
            Ok(ft) if ft.is_dir() => total += dir_size(&entry.path()),
            Ok(ft) if ft.is_file() => {
                if let Ok(meta) = entry.metadata() {
                    total += meta.len();
                }
            }
            _ => {}
        }
    }
    total
}

#[derive(Debug, Serialize)]
pub struct PruneResult {
    /// 修剪前 HEAD 可达提交数（沿一级父链）。
    pub commits_before: usize,
    /// 修剪后保留的提交数。
    pub commits_after: usize,
    /// 修剪（含尽力 gc）后的 `.git` 体积（字节）。
    pub size_after: u64,
    /// 系统 `git gc` 是否成功执行（未装 git 时为 false，磁盘不会真正回收）。
    pub gc_ran: bool,
}

pub fn git_repo_size_inner(folder: String) -> Result<u64, String> {
    let git_dir = Path::new(&folder).join(".git");
    if !git_dir.exists() {
        return Ok(0);
    }
    Ok(dir_size(&git_dir))
}

#[tauri::command]
pub async fn git_repo_size(folder: String) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || git_repo_size_inner(folder))
        .await
        .map_err(|e| format!("join: {e}"))?
}

/// 尽力跑系统 `git gc`——libgit2 无 gc。先 expire reflog 让被重写掉的提交变不可达，
/// 再 gc --prune=now。未装 git 或失败返回 false（非致命：历史已重写，只是没回收磁盘）。
fn best_effort_gc(folder: &str) -> bool {
    let reflog = Command::new("git")
        .args(["-C", folder, "reflog", "expire", "--expire=now", "--all"])
        .output();
    if reflog.is_err() {
        return false;
    }
    let gc = Command::new("git")
        .args(["-C", folder, "gc", "--prune=now", "--quiet"])
        .output();
    matches!(gc, Ok(o) if o.status.success())
}

pub fn git_prune_history_inner(folder: String, max_commits: u32) -> Result<PruneResult, String> {
    let repo = open_repo(&folder)?;
    let max = (max_commits.max(1)) as usize;

    let head = repo
        .head()
        .map_err(|e| format!("git head: {e}"))?
        .peel_to_commit()
        .map_err(|e| format!("git head commit: {e}"))?;

    // 沿一级父链收集提交（AutoGit 是线性历史）：chain[0]=HEAD（最新）…越往后越旧。
    let mut chain = vec![head.clone()];
    let mut cur = head.clone();
    loop {
        match cur.parent(0) {
            Ok(p) => {
                chain.push(p.clone());
                cur = p;
            }
            Err(_) => break,
        }
        if chain.len() > 1_000_000 {
            break; // 极端仓库的安全护栏
        }
    }
    let commits_before = chain.len();

    if commits_before <= max {
        let size_after = git_repo_size_inner(folder.clone())?;
        return Ok(PruneResult {
            commits_before,
            commits_after: commits_before,
            size_after,
            gc_ran: false,
        });
    }

    // 保留最近 max 个版本、总提交数恰为 max：
    //   · 第 max 新的版本（chain[max-1]）的树压成一个无父的合成根；
    //   · 其上重建更新的 chain[max-2..=0]（共 max-1 个），合计 max 个提交。
    let base_tree = chain[max - 1].tree().map_err(|e| format!("base tree: {e}"))?;
    let sig = build_signature(&repo)?;
    let new_root = repo
        .commit(
            None,
            &sig,
            &sig,
            "EIDON: history compacted (older versions pruned)",
            &base_tree,
            &[],
        )
        .map_err(|e| format!("commit root: {e}"))?;

    // 重建被保留的较新提交（从旧到新），逐个挂到上一个之上。树与原提交一致。
    let mut parent_oid = new_root;
    for i in (0..max - 1).rev() {
        let orig = &chain[i];
        let tree = orig.tree().map_err(|e| format!("tree: {e}"))?;
        let parent = repo
            .find_commit(parent_oid)
            .map_err(|e| format!("find parent: {e}"))?;
        let message = orig.message().unwrap_or("");
        parent_oid = repo
            .commit(
                None,
                &orig.author(),
                &orig.committer(),
                message,
                &tree,
                &[&parent],
            )
            .map_err(|e| format!("recommit: {e}"))?;
    }

    // 把当前分支指向重写后的新 tip。新 tip 的树 == 旧 HEAD 树，工作区/索引保持一致，无需 checkout。
    let head_ref = repo.head().map_err(|e| format!("head ref: {e}"))?;
    let refname = head_ref
        .name()
        .ok_or_else(|| "head has no name (detached?)".to_string())?
        .to_string();
    repo.reference(&refname, parent_oid, true, "EIDON history prune")
        .map_err(|e| format!("update ref: {e}"))?;

    let gc_ran = best_effort_gc(&folder);
    let size_after = git_repo_size_inner(folder.clone())?;
    Ok(PruneResult {
        commits_before,
        commits_after: max,
        size_after,
        gc_ran,
    })
}

#[tauri::command]
pub async fn git_prune_history(folder: String, max_commits: u32) -> Result<PruneResult, String> {
    tauri::async_runtime::spawn_blocking(move || git_prune_history_inner(folder, max_commits))
        .await
        .map_err(|e| format!("join: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Repository;

    fn commit_file(repo: &Repository, name: &str, content: &str, msg: &str) {
        let dir = repo.workdir().unwrap();
        std::fs::write(dir.join(name), content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new(name)).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = Signature::now("t", "t@t").unwrap();
        let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
        let parents: Vec<&git2::Commit> = parent.iter().collect();
        repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parents)
            .unwrap();
    }

    fn count_commits(repo: &Repository) -> usize {
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        let mut n = 1;
        let mut cur = head;
        while let Ok(p) = cur.parent(0) {
            n += 1;
            cur = p;
        }
        n
    }

    #[test]
    fn prune_keeps_recent_commits_and_preserves_head_tree() {
        let tmp = std::env::temp_dir().join(format!("eidon-prune-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let repo = Repository::init(&tmp).unwrap();
        for i in 0..10 {
            commit_file(&repo, "note.md", &format!("v{i}"), &format!("commit {i}"));
        }
        assert_eq!(count_commits(&repo), 10);
        let head_tree_before = repo.head().unwrap().peel_to_commit().unwrap().tree().unwrap().id();

        let folder = tmp.to_string_lossy().to_string();
        let result = git_prune_history_inner(folder, 3).unwrap();
        assert_eq!(result.commits_before, 10);
        assert_eq!(result.commits_after, 3);

        let repo2 = Repository::open(&tmp).unwrap();
        assert_eq!(count_commits(&repo2), 3);
        let head_tree_after = repo2.head().unwrap().peel_to_commit().unwrap().tree().unwrap().id();
        // 工作区内容（HEAD 树）不变。
        assert_eq!(head_tree_before, head_tree_after);
        // 最新内容仍是 v9。
        assert_eq!(std::fs::read_to_string(tmp.join("note.md")).unwrap(), "v9");

        // 提交数已低于上限 → 再修剪为 no-op。
        let again = git_prune_history_inner(tmp.to_string_lossy().to_string(), 3).unwrap();
        assert_eq!(again.commits_after, 3);

        let _ = std::fs::remove_dir_all(&tmp);
    }
}
