# R-review Sources

## Scope

- Change: `eidon-base-roadmap` (user message used `edion-base-roadmap`; repository path is `speculo/.speculo/dev/eidon-base-roadmap/`).
- Fixed point: `main`.
- Submitted commits in range: `main...HEAD`.
- Additional scope: current working tree changes and untracked files, because the request asked for the current branch's full contents and referenced `/tmp/eidon-handoff-filetree-inbox-i18n.md`.

## Diff Inputs

- `git merge-base main HEAD` -> `d29510d7bb60`.
- `git log --oneline main..HEAD`.
- `git diff --stat main...HEAD`.
- `git diff --stat main`.
- `git status --short --branch`.
- `git diff --check main`.

## Spec Sources

- `speculo/.speculo/dev/eidon-base-roadmap/prd.md`.
- `speculo/.speculo/dev/eidon-base-roadmap/decision-log.md`.
- `speculo/.speculo/dev/eidon-base-roadmap/roadmap.md`.
- `speculo/.speculo/dev/eidon-base-roadmap/diagnosis.md`.
- `speculo/.speculo/dev/eidon-base-roadmap/regression.md`.
- `/tmp/eidon-handoff-filetree-inbox-i18n.md`.

## Engineering And Standards Sources

- `AGENTS.md`.
- `speculo/.speculo/.config/adr/ADR-0012-core-four-modules-and-rust-domains.md`.
- `speculo/.speculo/.config/adr/ADR-0013-three-layer-node-topology-and-templates.md`.
- `speculo/.speculo/.config/adr/ADR-0014-disk-contract-unification.md`.
- `speculo/.speculo/.config/adr/ADR-0015-snapshots-use-existing-git.md`.
- `speculo/.speculo/.config/adr/ADR-0016-consistency-enforcement-and-marking.md`.
- `speculo/.speculo/.config/adr/ADR-0017-eidon-rename-and-system-dir.md`.
- `speculo/.speculo/.config/adr/ADR-0018-ai-agent-recipes-out-of-scope.md`.
- `speculo/workflows/dev/R-review/checklists/solid.md`.
- `speculo/workflows/dev/R-review/checklists/security.md`.
- `speculo/workflows/dev/R-review/checklists/code-quality.md`.
- `speculo/workflows/dev/R-review/checklists/removal.md`.

## Code Areas Sampled

- `app/src/App.tsx`.
- `app/src/components/FileTree.tsx`.
- `app/src/components/Toolbar.tsx`.
- `app/src/components/TemplateManager.tsx`.
- `app/src/components/NodeCreateDialog.tsx`.
- `app/src/components/NodeInspector.tsx`.
- `app/src/composables/useFiles.ts`.
- `app/src/composables/useCommands.ts`.
- `app/src/stores/nodes.ts`.
- `app/src/stores/templates.ts`.
- `app/src/lib/eidon-paths.ts`.
- `app/src/lib/check-update.ts`.
- `app/src/lib/persistence/settings.ts`.
- `app/src/i18n/translate.ts`.
- `app/core/contracts/*`.
- `app/core/nodes/index.ts`.
- `app/core/templates/index.ts`.
- `app/core/consistency/index.ts`.
- `app/core/snapshots/index.ts`.
- `app/src-tauri/src/runner.rs`.

## Verification Commands

- `pnpm lint` - passed.
- `pnpm test:core` - passed.
- `pnpm contracts:check` - passed.
- `pnpm --dir app exec tsc --noEmit --pretty false` - passed.
- `pnpm build` - passed.
- `pnpm --dir app test:ui` - passed.
- `cd app/src-tauri && cargo test` - one initial parallel run showed a transient `runner::agent_tools::tests::list_tags_aggregates` failure; the targeted rerun passed, and `cargo test -- --test-threads=1` passed.
