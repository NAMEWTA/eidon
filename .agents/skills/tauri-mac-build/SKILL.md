---
name: tauri-mac-build
description: Build Tauri macOS .dmg packages (arm64/universal) and clean up Rust build artifacts to reclaim disk space. Use when the user asks to build a macOS DMG, package a Tauri app for macOS, or clean up build artifacts. Covers unsigned local builds, common build script pitfalls, and post-build cleanup of the target/ directory (which can exceed 16GB).
---

# Tauri macOS Build & Cleanup

## Build (unsigned, arm64)

Run the project's existing build script from repo root:

```bash
bash scripts/build-mac-arm64-unsigned.sh
```

This produces `release/EIDON_<version>_macos_arm64.dmg`.

## Common Pitfall

Tauri's `bundle_dmg.sh` step **cleans the .app** from `bundle/macos/` during DMG creation. If the project build script checks for `.app` existence after `tauri build`, it will fail even though the DMG was created successfully. The `.dmg` is always at:

```
app/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/
```

If the script fails at the `.app` check, manually copy the DMG:

```bash
mkdir -p release
cp app/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/EIDON_*.dmg \
   release/EIDON_$(node -p "require('./app/package.json').version")_macos_arm64.dmg
```

## Signed Build

For signed + notarized builds, use `scripts/build-mac.sh` (requires Apple Developer credentials in environment).

## Cleanup

Rust's `target/` directory accumulates compilation artifacts and can grow to **10–20GB**. After a successful build, delete it to reclaim space.

### Check Size

```bash
du -sh app/src-tauri/target
```

### Delete

```bash
rm -rf app/src-tauri/target
```

Or use the bundled script from repo root:

```bash
bash .agents/skills/tauri-mac-build/scripts/cleanup-target.sh
```

With `--dry-run` to check size first:

```bash
bash .agents/skills/tauri-mac-build/scripts/cleanup-target.sh --dry-run
```

> Keep `app/dist/` (frontend build, ~10MB) — negligible size. Only `target/` is worth deleting.

## Build vs. Cleanup Tradeoff

| Action | Disk | Next Build |
|--------|------|------------|
| Keep `target/` | ~16GB used | ~10s incremental |
| Delete `target/` | ~16GB freed | ~3–5min full rebuild |

**Recommendation**: Delete `target/` after each successful DMG build. The DMG in `release/` is the only artifact worth keeping.

**Appropriate for:** Templates, boilerplate code, document templates, images, icons, fonts, or any files meant to be copied or used in the final output.

---

**Not every skill requires all three types of resources.**
