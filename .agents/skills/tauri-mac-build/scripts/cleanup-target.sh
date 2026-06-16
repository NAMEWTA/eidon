#!/usr/bin/env bash
# 清理 Tauri Rust 构建产物，释放磁盘空间。
# target/ 目录通常占用 10-20GB，删除后下次构建需重新编译（~3-5min）。
#
# 用法:
#   bash scripts/cleanup-target.sh              # 删除 target/
#   bash scripts/cleanup-target.sh --dry-run    # 仅显示大小，不删除
set -euo pipefail

TARGET_DIR="app/src-tauri/target"
DRY_RUN=false

if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

if [ -d "$TARGET_DIR" ]; then
  SIZE=$(du -sh "$TARGET_DIR" 2>/dev/null | cut -f1)
  echo "target/ 大小: $SIZE"
  if $DRY_RUN; then
    echo "[dry-run] 将删除 $TARGET_DIR"
  else
    rm -rf "$TARGET_DIR"
    echo "已删除 target/，释放 $SIZE"
  fi
else
  echo "target/ 不存在，无需清理"
fi
