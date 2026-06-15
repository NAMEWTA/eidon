# 发布与构建脚本

EIDON 的本地构建 / 签名 / 发布脚本。所有命令在**仓库根目录**执行。

## 速用

```bash
# 切版本（同步 tauri.conf.json / app/package.json / Cargo.toml 三处版本号，打 tag 并推送；
# tag push 触发 .github/workflows/release.yml 在 CI 构建 macOS + Windows 安装包）
./scripts/release.sh 0.2.0

# 本地未签名 macOS ARM64 .dmg（无需 Apple 开发者账号，快速测试用）
./scripts/build-mac-arm64-unsigned.sh

# 本地签名 + 公证 macOS .dmg（需 APPLE_* 环境变量，arm64 默认）
APPLE_SIGNING_IDENTITY="Developer ID Application: …" \
APPLE_ID="you@example.com" APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx" APPLE_TEAM_ID="XXXXXXXXXX" \
./scripts/build-mac.sh

# macOS universal 签名构建（Intel + Apple Silicon）
./scripts/build-mac.sh universal
```

## 脚本一览

| 脚本 | 作用 |
|------|------|
| `release.sh <版本>` | 同步三处版本号、提交、打 `vX.Y.Z` tag 并推 `origin/main`（tag 触发 CI 构建） |
| `build-mac.sh [arm64\|universal]` | 本地 macOS 签名构建：Developer ID 签名 + 公证 + 注入文件类型图标，产出 `release/EIDON_<版本>_macos_<架构>.dmg`（默认 arm64） |
| `build-mac-arm64-unsigned.sh` | 本地 macOS ARM64 未签名构建：无需 Apple 开发者账号，产出 `release/EIDON_<版本>_macos_arm64.dmg` |

> CI 构建通过 `.github/workflows/release.yml` 实现：`push tag v*` 自动触发 macOS ARM64 + Windows x64 并行构建，产物在 Actions run summary 页面下载。

## GitHub Actions CI

`.github/workflows/release.yml` 在 `push tag v*` 时自动并行构建两个平台：

| Job | Runner | Target | 产物 |
|-----|--------|--------|------|
| `build-macos-arm64` | `macos-latest` | `aarch64-apple-darwin` | `.dmg` |
| `build-windows-x64` | `windows-latest` | `x86_64-pc-windows-msvc` | NSIS `.exe` |

也支持从 Actions 页面手动触发（`workflow_dispatch`）。

## macOS 签名所需的 GitHub Actions Secrets

（仅在配置 CI 自动签名时需要）在 **Settings → Secrets and variables → Actions** 逐项添加：

| Secret | 值 | 获取方式 |
|---|---|---|
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: <名字> (<TeamID>)` | `security find-identity -v -p codesigning` |
| `APPLE_CERTIFICATE` | `.p12` 证书的 base64 | `base64 -i developer-id.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | 导出 `.p12` 时设的密码 | 自定 |
| `APPLE_ID` | Apple ID 邮箱 | — |
| `APPLE_PASSWORD` | App 专用密码 | account.apple.com → 登录与安全 → App 专用密码 |
| `APPLE_TEAM_ID` | 团队 ID | Apple Developer → Membership |
