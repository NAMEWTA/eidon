//! git_history 流水线的命令行驱动（开发自测用）。
//!
//! 不经 Tauri 前端，直接对真实工作区文件夹跑 git_history 全链路，用于在本机
//! 验证「Rust 侧 git 路径可用」。版本/历史/提交/恢复经 core/snapshots → git_history
//! 的 auto-commit 历史（见 ADR-0015；此处 auto-commit 指普通编辑提交，非已删的 Recipes 沙箱）。
//!
//! Usage:
//!   cargo run --example autogit_drive -- status  <folder>
//!   cargo run --example autogit_drive -- init    <folder>
//!   cargo run --example autogit_drive -- commit  <folder> [<file>]
//!   cargo run --example autogit_drive -- log     <folder> <file>

use app_lib::git_history::{
    git_auto_commit_inner, git_file_history_inner, git_init_workspace_inner,
    git_workspace_status_inner,
};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!(
            "usage: {} <status|init|commit|log> <folder> [<file>]",
            args[0]
        );
        std::process::exit(2);
    }
    let cmd = &args[1];
    let folder = args[2].clone();

    match cmd.as_str() {
        "status" => match git_workspace_status_inner(folder) {
            Ok(s) => println!("{:#?}", s),
            Err(e) => {
                eprintln!("status error: {}", e);
                std::process::exit(1);
            }
        },
        "init" => match git_init_workspace_inner(folder, None, Some(false)) {
            Ok(()) => println!("init: ok"),
            Err(e) => {
                eprintln!("init error: {}", e);
                std::process::exit(1);
            }
        },
        "commit" => {
            let file = args.get(3).cloned();
            match git_auto_commit_inner(folder, file, None) {
                Ok(Some(sha)) => println!("commit: {}", sha),
                Ok(None) => println!("commit: nothing to commit"),
                Err(e) => {
                    eprintln!("commit error: {}", e);
                    std::process::exit(1);
                }
            }
        }
        "log" => {
            let file = args.get(3).cloned().unwrap_or_default();
            match git_file_history_inner(folder, file, 50) {
                Ok(hist) => {
                    println!("{} commits:", hist.len());
                    for c in &hist {
                        println!("  {}  {}  ({})", c.short_sha, c.message, c.author);
                    }
                }
                Err(e) => {
                    eprintln!("log error: {}", e);
                    std::process::exit(1);
                }
            }
        }
        other => {
            eprintln!("unknown command: {other}");
            std::process::exit(2);
        }
    }
}
