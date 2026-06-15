#!/usr/bin/env bash
#
# 本地 macOS 签名构建 → 输出到 release/
#
# 用法:
#   ./scripts/build-mac.sh              # arm64（默认）
#   ./scripts/build-mac.sh arm64        # Apple Silicon only
#   ./scripts/build-mac.sh universal    # Intel + Apple Silicon
#
# 必需环境变量（export 或放入 .env.local）:
#   APPLE_SIGNING_IDENTITY  e.g. "Developer ID Application: xiangdong li (6NQM3XP5RF)"
#   APPLE_ID                Apple ID 邮箱
#   APPLE_PASSWORD          App 专用密码
#   APPLE_TEAM_ID           e.g. 6NQM3XP5RF
#
# 流程:
#   1. pnpm tauri build --bundles app  (构建 + 签名 .app，不生成 dmg / 不公证)
#   2. 注入文件类型图标 (CFBundleTypeIconFile for .md / .txt)
#   3. 重签 .app 覆盖 plist 变更
#   4. 公证 + staple
#   5. hdiutil 创建 DMG
#   6. 签名 DMG → 复制到 release/
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ── 解析 target ────────────────────────────────────────────────
TARGET="${1:-arm64}"
case "$TARGET" in
  arm64)
    RUST_TARGET="aarch64-apple-darwin"
    DMG_SUFFIX="arm64"
    ;;
  universal)
    RUST_TARGET="universal-apple-darwin"
    DMG_SUFFIX="universal"
    ;;
  *)
    echo "ERROR: unknown target '$TARGET'. Use 'arm64' or 'universal'." >&2
    exit 1
    ;;
esac

# ── 加载凭证 ───────────────────────────────────────────────────
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

: "${APPLE_SIGNING_IDENTITY:?Set APPLE_SIGNING_IDENTITY}"
: "${APPLE_ID:?Set APPLE_ID}"
: "${APPLE_PASSWORD:?Set APPLE_PASSWORD}"
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID}"

cd app
VERSION=$(node -p "require('./package.json').version")
echo "==> EIDON v${VERSION} — Mac build ($TARGET → $RUST_TARGET)"

echo "==> Installing frontend deps"
pnpm install --frozen-lockfile

echo "==> Building .app (no dmg yet)"
# APPLE_ID / APPLE_PASSWORD intentionally unset so Tauri skips notarization —
# we'll notarize manually after patching the .app below.
APPLE_SIGNING_IDENTITY="$APPLE_SIGNING_IDENTITY" \
  pnpm tauri build --target "$RUST_TARGET" --bundles app

APP="src-tauri/target/${RUST_TARGET}/release/bundle/macos/EIDON.app"
[ -d "$APP" ] || { echo "ERROR: .app not found at $APP" >&2; exit 1; }

echo "==> Injecting file-type icon into Info.plist"
cp src-tauri/icons/file_icon.icns "$APP/Contents/Resources/file_icon.icns"
PLIST="$APP/Contents/Info.plist"
# CFBundleDocumentTypes has two entries (md + txt). Add CFBundleTypeIconFile to each.
for i in 0 1; do
  /usr/libexec/PlistBuddy -c "Delete :CFBundleDocumentTypes:${i}:CFBundleTypeIconFile" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:${i}:CFBundleTypeIconFile string file_icon.icns" "$PLIST"
done

echo "==> Re-signing .app (signature must cover patched plist)"
codesign --force --deep --options runtime \
  --sign "$APPLE_SIGNING_IDENTITY" "$APP"

echo "==> Notarizing .app"
ZIP="/tmp/EIDON-${VERSION}.zip"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"
xcrun notarytool submit "$ZIP" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
rm -f "$ZIP"

echo "==> Stapling notarization ticket"
xcrun stapler staple "$APP"

echo "==> Building dmg"
STAGE="/tmp/eidon-dmg-stage-${VERSION}"
rm -rf "$STAGE" && mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/EIDON.app"
ln -s /Applications "$STAGE/Applications"
DMG_DIR="src-tauri/target/${RUST_TARGET}/release/bundle/dmg"
mkdir -p "$DMG_DIR"
DMG="$DMG_DIR/EIDON_${VERSION}_${DMG_SUFFIX}.dmg"
rm -f "$DMG"
hdiutil create -volname EIDON -srcfolder "$STAGE" -ov -format UDZO "$DMG"

echo "==> Signing dmg"
codesign --force --sign "$APPLE_SIGNING_IDENTITY" "$DMG"

echo "==> Copying to release/"
mkdir -p "$REPO_ROOT/release"
OUT_DMG="$REPO_ROOT/release/EIDON_${VERSION}_macos_${DMG_SUFFIX}.dmg"
cp "$DMG" "$OUT_DMG"

echo ""
echo "==> Verifying"
spctl -a -vvv "$APP" || echo "(spctl: check above)"
xcrun stapler validate "$APP"

echo ""
echo "==> Done"
echo "    .app: $APP"
echo "    .dmg: $OUT_DMG"
echo "    Open: open \"$OUT_DMG\""
