# R-review Report

Verdict: `REQUEST_CHANGES`

The implementation has substantial core coverage and the main automated TypeScript, UI, contract, build, and lint checks pass. The review still found three P1 issues where shipped behavior conflicts with the EIDON data-layer spec or hard repository constraints.

## Spec Findings

### S-1 P1: Opening a workspace mutates disk and initializes node/template state eagerly

Evidence:

- `app/src/App.tsx:571` calls `ensureDefaultInbox(ws.currentFolder)` whenever a workspace is selected.
- `app/src/stores/nodes.ts:107` initializes templates before creating the inbox structure.
- `app/core/nodes/index.ts:495` creates `_整理箱/未分类/收件箱`.
- `speculo/.speculo/dev/eidon-base-roadmap/prd.md:16`, `:24`, and `:70` require lazy `.eidon`/template initialization and read-only scan/open behavior, without auto creating, moving, or rewriting existing workspaces.

Impact:

Opening a plain Markdown workspace now writes `.eidon/templates` and creates a physical inbox before the user creates node content. That breaks the adoption path described by the PRD and makes EIDON modify existing folders merely by opening them.

Expected direction:

Keep workspace open and scan read-only. Create the default inbox only on explicit content creation or an explicit workspace migration action.

Note:

The handoff file says `App.tsx` initializes the inbox on workspace open, but that conflicts with the PRD and ADR-backed read-only adoption rule.

### S-2 P1: Claimed workspace migration and remediation entry points are not wired in the UI

Evidence:

- `app/core/consistency/index.ts:255` implements `normalizeWorkspaceStructure`.
- `rg "normalizeWorkspaceStructure|Promote workspace|workspace to nodes" app/src` finds no UI call site.
- `app/src/components/FileTree.tsx:837` defines the context menu, but it does not expose root workspace migration.
- `app/src/components/FileTree.tsx:343` blocks dragging files unless their parent is a scanned L3 node, so content files already sitting in L1/L2 cannot be fixed by drag/drop.
- `speculo/.speculo/dev/eidon-base-roadmap/regression.md:24` and `:43` state the fix added a visible `Promote workspace to nodes` banner/header/root menu command.
- `speculo/.speculo/dev/eidon-base-roadmap/diagnosis.md:7` records the original user-blocking symptom: files could not be opened or moved into the required L3 node path.

Impact:

The diagnostic fix is documented as complete, but users still lack the promised visible migration command. For L1/L2 content-file violations, the marker exists but the remediation path is incomplete.

Expected direction:

Wire the existing `normalizeWorkspaceStructure` command to the FileTree banner/header/root context menu, and ensure content-file violations route to a usable manual remediation flow.

### S-3 P3: Native startup language still falls back to English

Evidence:

- `app/src/i18n/translate.ts:11` falls back to `zh`.
- `app/src/lib/persistence/settings.ts:145` defaults app settings to `zh`.
- `app/src-tauri/src/runner.rs:139` reads the saved native language and falls back to `"en"`.
- `/tmp/eidon-handoff-filetree-inbox-i18n.md:42` requires zh/en only, with zh fallback.

Impact:

On a fresh install, native menu or system-panel text can start in English before the frontend reconciles language state. This is smaller than the data-layer issues, but it is inconsistent with the handoff and UI default.

Expected direction:

Change the Rust fallback to `zh` and keep native/frontend defaults aligned.

## Engineering Findings

### E-1 P2: Template version writes are not transactionally atomic

Evidence:

- `app/core/templates/index.ts:72` validates all three L1/L2/L3 template layers before write.
- `app/core/templates/index.ts:102` writes layer files sequentially.
- `app/core/templates/index.ts:144` comments that create is atomic and leaves no half-set, but only validation is atomic; filesystem writes are not.
- `app/core/templates/index.ts:271` uses the same sequential-write pattern for version edits.

Impact:

A crash, disk-full condition, or permission error between layer writes can leave an incomplete template version in `.eidon/templates/{id}`. That undermines the bundled L1/L2/L3 schema contract and can create invalid rebuild state.

Expected direction:

Stage layer files in a temporary directory or temporary filenames, then commit with a final rename/marker step. Alternatively, make incomplete versions explicit and ignored by normal listing.

### E-2 P2: Save As validation allows writes into EIDON system metadata paths

Evidence:

- `app/src/lib/eidon-paths.ts:20` treats `.eidon`, `.node`, `.solomd`, and `.git` paths as valid by returning `true`.
- `app/src/lib/eidon-paths.ts:48` mirrors that behavior in `isValidContentPath`.
- `app/src/composables/useFiles.ts:297` uses `validateContentPath` before writing the selected Save As target.

Impact:

A user can select a path such as `.eidon/templates/...` or `L1/.node/node.json` and overwrite system metadata through the editor. The helper is mixing two distinct questions: "should this path be flagged as misplaced content" and "may the editor write user content here".

Expected direction:

Split the helper into read-only violation classification and user-write validation. UI Save As should reject system paths; internal core writes can bypass that user-content guard.

## Standards Findings

### T-1 P1: GitHub Sync remains mounted through the command palette

Evidence:

- `app/src/composables/useCommands.ts:28` imports `useGithubSyncStore`.
- `app/src/composables/useCommands.ts:292` registers `sync.pushNow`, `sync.pullNow`, and `sync.copyShareLink`.
- `speculo/.speculo/dev/eidon-base-roadmap/prd.md:111` lists cloud/GitHub sync as out of scope.
- `speculo/.speculo/.config/adr/ADR-0018-ai-agent-recipes-out-of-scope.md` says cloud/network legacy capabilities remain as retained code, not mounted.
- `AGENTS.md` requires full offline operation and excludes AI·Agent·Recipes/cloud scope for this phase.

Impact:

Even though Settings no longer exposes GitHub Sync, users can still run sync commands from the command palette. That violates the phase boundary and can trigger network/remote repository behavior in an offline-local product surface.

Expected direction:

Remove these command registrations for EIDON, or gate them behind an explicit future feature flag that is disabled by default and not reachable in this phase.

### T-2 P2: UI code still performs direct Tauri access instead of typed core bridge wrappers

Evidence:

- `app/src/components/FileTree.tsx:5` imports `invoke`/`listen` and directly calls commands such as `list_dir`, `fs_create_file`, `fs_create_dir`, `fs_rename`, and `fs_delete`.
- `app/src/composables/useFiles.ts:11` imports `invoke`, and `:12` imports `@tauri-apps/plugin-dialog`.
- `app/src/components/Toolbar.tsx:20` imports `@tauri-apps/plugin-opener` and `@tauri-apps/plugin-dialog`.
- `app/src/composables/useCommands.ts:14` imports Tauri plugins directly.
- `AGENTS.md` and `/tmp/eidon-handoff-filetree-inbox-i18n.md` both state that frontend business code must use typed wrappers through `core/bridge`.

Impact:

The current lint run passes, so this architecture rule is not being enforced for these paths. The result is UI code coupled to raw Tauri commands and plugin APIs, which weakens the stated 三层【代码】 boundary.

Expected direction:

Move file/dialog/opener/listen calls behind typed `core/bridge` wrappers and update lint rules so UI cannot import raw Tauri APIs or generic `invoke` reexports for business calls.

### T-3 P2: Auto-update networking still defaults on and points at legacy SoloMD endpoints

Evidence:

- `app/src/lib/persistence/settings.ts:169` sets `autoCheckUpdate: true`.
- `app/src/App.tsx:718` calls `checkForUpdateOnStartup` when that setting is true.
- `app/src/lib/check-update.ts:21` contacts `https://solomd.app/api/stats`, then falls back to GitHub releases.
- `AGENTS.md` requires full offline operation, and ADR-0017 requires EIDON naming/system identity for this phase.

Impact:

Fresh EIDON installs can perform startup network calls and still reference the legacy `solomd.app` domain. This conflicts with the local-first/offline phase boundary and the rename cleanup.

Expected direction:

Disable startup update checks by default for EIDON or move them behind an explicit opt-in. Replace legacy SoloMD endpoints if the feature is retained later.

## Verification Notes

- Passed: `pnpm lint`, `pnpm test:core`, `pnpm contracts:check`, `pnpm --dir app exec tsc --noEmit --pretty false`, `pnpm build`, `pnpm --dir app test:ui`, `git diff --check main`.
- Rust: one default parallel `cargo test` run showed a transient `runner::agent_tools::tests::list_tags_aggregates` failure. The targeted rerun passed, and `cargo test -- --test-threads=1` passed.

## Residual Risk

- I did not perform a manual Tauri desktop smoke test. The highest-risk manual path remains: open an existing plain Markdown workspace, verify no disk mutation happens, then explicitly trigger migration/content creation and verify FileTree remediation states.
