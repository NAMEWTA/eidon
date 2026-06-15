#!/usr/bin/env bash
#
# macOS ARM64 未签名本地构建 → 输出到 release/
#
# 产出: release/EIDON_<版本>_macos_arm64.dmg
#
# 用户首次打开需右键 → 打开 绕过 Gatekeeper，
# 或将 .app 拖入 /Applications 后运行:
#   xattr -cr /Applications/EIDON.app
#
# 用法: ./scripts/build-mac-arm64-unsigned.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/app"

VERSION=$(node -p "require('./package.json').version")
echo "==> EIDON v${VERSION} — macOS ARM64 unsigned build"

echo "==> Installing frontend deps"
pnpm install --frozen-lockfile

echo "==> Building .app + .dmg (aarch64-apple-darwin)"
pnpm tauri build --target aarch64-apple-darwin --bundles dmg

APP="src-tauri/target/aarch64-apple-darwin/release/bundle/macos/EIDON.app"
SRC_DMG="src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/EIDON_${VERSION}_arm64.dmg"

[ -d "$APP" ] || { echo "ERROR: .app not found at $APP" >&2; exit 1; }
[ -f "$SRC_DMG" ] || { echo "ERROR: .dmg not found at $SRC_DMG" >&2; exit 1; }

echo "==> Copying to release/"
mkdir -p "$REPO_ROOT/release"
OUT_DMG="$REPO_ROOT/release/EIDON_${VERSION}_macos_arm64.dmg"
cp "$SRC_DMG" "$OUT_DMG"

echo ""
echo "==> Done"
echo "    .app:  $APP"
echo "    .dmg:  $OUT_DMG"
echo ""
echo "    验证:  open \"$OUT_DMG\""
echo "    分发:  将 $OUT_DMG 发送给用户即可"
echo ""
echo "    注意: 未签名应用首次打开需右键 → 打开"
