# 发布与构建脚本

EIDON 的本地构建 / 发布脚本。所有命令在**仓库根目录**执行。
打包由 **electron-builder** 完成（见 `app/electron-builder.yml`）；本地构建直接用 `pnpm dist:*`，无需 shell 脚本。

## 速用

```bash
# 切版本（bump app/package.json 版本号——Electron 全栈唯一版本源，打 tag 并推送；
# tag push 触发 .github/workflows/release.yml 在 CI 用 electron-builder 构建 mac/win/linux 安装包）
./scripts/release.sh 0.2.0

# 本地打包（当前 OS / 指定平台）
pnpm dist           # 当前平台
pnpm dist:mac       # dmg
pnpm dist:win       # nsis + msi
pnpm dist:linux     # deb + rpm
```

## 脚本一览

| 脚本 | 作用 |
|------|------|
| `release.sh <版本>` | bump `app/package.json` 版本、提交、打 `vX.Y.Z` tag 并推 `origin/main`（tag 触发 CI 构建） |

> 本地 macOS 签名/公证由 electron-builder 在 `pnpm dist:mac` 时按环境变量（`CSC_LINK`/`CSC_KEY_PASSWORD`/`APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`）自动处理；缺失则产出未签名包。

## GitHub Actions CI

`.github/workflows/release.yml` 在 `push tag v*` 时并行构建三平台（`pnpm dist:<os>`）：

| Job | Runner | 产物 |
|-----|--------|------|
| macOS | `macos-15` | `.dmg` |
| Windows | `windows-latest` | `.exe` (NSIS) / `.msi` |
| Linux | `ubuntu-22.04` | `.deb` / `.rpm` |

产物在 Actions run summary 页面下载；也支持手动触发（`workflow_dispatch`）。

## macOS 签名 / 公证所需的 GitHub Actions Secrets

（仅在配置 CI 自动签名时需要）在 **Settings → Secrets and variables → Actions** 逐项添加：

| Secret | 值 | 获取方式 |
|---|---|---|
| `MAC_CSC_LINK` | `.p12` 证书的 base64（Developer ID Application） | `base64 -i developer-id.p12 \| pbcopy` |
| `MAC_CSC_KEY_PASSWORD` | 导出 `.p12` 时设的密码 | 自定 |
| `APPLE_ID` | Apple ID 邮箱 | — |
| `APPLE_APP_SPECIFIC_PASSWORD` | App 专用密码 | account.apple.com → 登录与安全 → App 专用密码 |
| `APPLE_TEAM_ID` | 团队 ID | Apple Developer → Membership |
