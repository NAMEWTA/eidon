> **服务工作流：** `../02-prd/02-prd.md`
> **产物文件名：** `prd.md`

# PRD

## Problem Statement

当前 SoloMD 的本地 Markdown workspace 已经具备编辑、搜索、版本、文件树等基础能力，但它只认识普通文件夹和文件，不认识结构节点、节点身份、模板字段或深度语义。用户可以把资料写进任意层级，也可以从外部随意移动文件夹，系统无法判断哪些目录是稳定知识结构，哪些只是临时普通文件夹。

EIDON 2.0 本期要解决的是「结构化知识 IDE 的数据地基」问题：在保持本地文件可见、Markdown 原生、可迁移的前提下，让 workspace 拥有固定三层【节点】拓扑与多模板 schema。用户需要先定义领域模板，再按 L1/L2/L3 创建节点，把内容明确放在 L3，同时保留现有编辑、搜索、版本能力。

这不是向后兼容旧 SoloMD 形态的小改，而是 EIDON 基于 SoloMD 的 1.x → 2.x 颠覆性产品重构。重构不背旧形态兼容包袱，但必须以现有系统为基底，凡能复用现有实现的一律复用。AI·Agent·Recipes 不在 EIDON 范围，本期只保留旧代码作基底，不挂载、不依赖。

## Solution

本期交付 EIDON「节点 + 模板内核」：在现有 workspace 之上懒初始化 `.eidon/` 系统区与 `.eidon/templates/` 模板目录；把含 `.node/node.json` 的目录识别为结构节点；按物理深度强制 L1/L2/L3；在设置内管理三层【节点】模板；在 FileTree 中清楚区分节点、普通文件夹与结构违规。

用户通过 EIDON 新建结构时，系统只提供合法入口：根下创建 L1 并选择模板，L1 下创建 L2，L2 下创建 L3，L3 及其自由子文件夹才允许承载内容文件。存量普通文件夹不被自动改写，只在前 3 个物理深度被标记为待提升，用户点击后才提升为节点或手动移动 / 删除。

版本、diff、恢复、删除、全文搜索、编辑和自动保存复用现有能力。版本能力归属到 `core/snapshots`，但该模块只薄封装现有 git bridge，不实现 `.eidon/snapshots.git` 或保存 / 快照解耦。磁盘契约统一纳入 zod + golden fixtures，确保删除运行时索引缓存后可从 `.node/` 与 `.eidon/templates/` 100% 重建节点树、身份、字段与 id→path 映射。

## User Stories

1. As a local workspace owner, I want to open my existing folder and keep editing Markdown as before, so that adopting EIDON does not destroy my content files.

2. As a local workspace owner, I want EIDON to initialize `.eidon/templates/` only when I first use node or template features, so that plain Markdown use does not force structure immediately.

3. As a local workspace owner, I want built-in templates such as 档案 / 项目 / 资料 to be ordinary editable files, so that I can modify or delete them without fighting hard-coded defaults.

4. As a local workspace owner, I want to create a template in Settings by defining the names and fields for L1/L2/L3, so that my knowledge structure uses my domain language.

5. As a local workspace owner, I want to keep multiple templates side by side, so that research, engineering, and personal knowledge can use different schemas in one workspace.

6. As a local workspace owner, I want template edits to create a new version while old nodes keep their old schemaVersion, so that improving a schema never corrupts existing node data.

7. As a local workspace owner, I want the UI to enforce creation by physical depth, so that root creates L1, L1 creates L2, L2 creates L3, and no skip-level creation path exists.

8. As a local workspace owner, I want each structure node to carry a stable ULID in `.node/node.json`, so that renaming or moving a node does not break its identity.

9. As a local workspace owner, I want L1/L2 to be pure organization layers and L3 to be the content layer, so that I always know where notes, PDFs, and images belong.

10. As a local workspace owner, I want to fill node fields rendered from the node's template version, so that structural metadata is visible and editable without touching raw JSON.

11. As a local workspace owner, I want FileTree to show nodes, plain folders, levels, templates, and violations distinctly, so that structure is visible directly in navigation.

12. As a local workspace owner, I want ordinary folders in the first three physical depths to offer "promote to node", so that I can gradually convert a flat library into a structured one.

13. As a local workspace owner, I want structure violations to be marked but not auto-fixed, so that EIDON never moves or rewrites my files without my explicit action.

14. As a local workspace owner, I want existing autosave, history, diff, restore, search, watcher, and deletion behavior to keep working, so that the new data layer does not force parallel tools.

15. As a local workspace owner, I want to copy the workspace to another machine and rebuild state from files, so that templates, node IDs, fields, and content remain self-contained.

16. As a local workspace owner, I want the product name, visible copy, and system area to become EIDON / `.eidon`, so that the 2.0 identity is clear and no longer mixed with SoloMD UI.

## Implementation Decisions

- Preserve the existing 三层【代码】 architecture: React UI calls `core`, `core` reaches Rust only through `core/bridge`, and Rust remains a capability shell. This is a hard boundary, not a redesign target.

- Add EIDON data-layer behavior in four `core` modules: `nodes`, `templates`, `snapshots`, and `consistency`. Each module exposes public APIs through its own `index.ts`, avoids UI framework imports, and does not depend on old AI·Agent·Recipes modules.

- Treat disk contracts as the first implementation surface. `node.json`, template schema, and `.eidon/` layout must be represented in `core/contracts` and `fixtures/contracts` before parsers or UI depend on them.

- Use `.node/node.json` as node identity truth. A node carries id, templateId, level, type, schemaVersion, createdAt, fields, references, and flags. `references` and `flags` are contract-level forward compatibility fields; this PRD does not require user-visible reference or soft-state behavior.

- Store templates as versioned immutable files under `.eidon/templates/{templateId}/L{n}.{name}.v{ver}.json`. Editing a template creates a new version; old nodes remain valid under their existing schemaVersion.

- Enforce depth=level at creation time. EIDON-generated structures must only be created as root→L1, L1→L2, L2→L3, and L3→free folders / content.

- Keep scanning read-only. Opening or switching a workspace builds node tree and id→path mappings and detects violations, but never auto-creates `.node/`, never auto-moves content files, and never auto-rewrites node metadata as a repair.

- Reuse `editor/file_ops` for filesystem traversal and `.node/` reads/writes first. Add a minimal Rust scan command only if performance validation shows Core(TS) + existing bridge cannot handle large workspaces acceptably.

- Reuse existing git history for version / diff / restore. `core/snapshots` is an ownership wrapper around the current git bridge, not a new private snapshot system.

- Reuse existing FileTree deletion semantics for this PRD. There is no `.eidon/trash` or recovery pipeline in scope.

- Refactor FileTree into a node-aware navigation surface: hide `.node/`, distinguish structure nodes from plain folders, render level/template affordances, and show the four structure violation categories.

- Add Settings-hosted TemplateManager, NodeCreateDialog, NodeInspector, and nodes/templates stores following current React + Zustand patterns.

- Rename visible product identity from solomd to EIDON and route new system data to `.eidon/`. Old `.solomd/` remains untouched as legacy Agent Recipes state and is not migrated in this PRD.

## Testing Decisions

Test targets for this PRD:

- `core/contracts`: zod parsing and golden fixtures for `node.json`, template schema, and `.eidon/` layout; run `pnpm contracts:check`.

- `core/templates`: first-use initialization, built-in seed write-once behavior, template creation, versioned edit, deletion / orphan template behavior, field type validation, and no resurrection of deleted built-ins.

- `core/nodes`: scan from disk, id→path rebuild, create L1/L2/L3, rename with stable ID, move with stable ID, promote plain folder, and rebuild after deleting runtime index cache.

- `core/consistency`: detection of first-three-depth plain folders, L1/L2 content files, physical depth vs `level` mismatch, and missing / invalid `.node/` metadata; verify detection is read-only.

- `core/snapshots`: wrapper calls existing git bridge behavior without adding snapshot semantics; tests should focus on API mapping rather than re-testing Rust git internals.

- UI behavior: FileTree hides `.node/`, distinguishes nodes and plain folders, only exposes legal create actions, displays violation markers, and routes marker actions to manual remediation; NodeInspector renders the six field types by schemaVersion.

- Integration / acceptance flow: open workspace → initialize templates → create custom template → create L1/L2/L3 → edit Markdown in L3 → autosave and history still work → externally introduce violations → FileTree marks them → promote / move manually → delete index cache → rebuild node tree and fields.

Baseline commands:

- `pnpm lint`
- `pnpm test:core`
- `pnpm contracts:check`
- Targeted Vitest files for the new `core` modules as implementation lands.

## Out of Scope

- AI·Agent·Recipes product behavior, including AI chat, Recipes automation, triggers, RAG, capture, REST, MCP, cloud / GitHub sync, and old Agent panels.

- Private `.eidon/snapshots.git`, save/snapshot decoupling, path↔ID history compensation, or any new snapshot engine.

- `.eidon/trash`, recycle-bin recovery, path conflict restore, reference reconnect, or deletion safety flow beyond existing direct deletion.

- Soft consistency states such as outOfPlace, orphan, disconnected, orphanTemplate panel workflows, automatic completion, automatic organizing, or a standalone consistency panel.

- User-visible backlinks, block references, Todo extraction, semantic / vector search, or AI-native linking. Existing non-AI features that already work may remain visible, but this PRD does not require new implementations for them.

- Multi-user, permission, ACL, audit, collaboration, cloud account, or team workspace features.

- Backward-compatible migration from `.solomd/` Agent Recipes data to `.eidon/`. Legacy `.solomd/` is left in place and outside the EIDON data layer.

## Further Notes

The implementation order should follow the existing roadmap: contracts and rebuildability first, then templates, then node topology and UI, then consistency + reuse wiring, then rename and end-to-end closure.

The highest-risk acceptance invariant is rebuildability: deleting runtime index cache must not destroy or obscure structure because `.node/node.json` and `.eidon/templates/` are the truth source. Every stage that changes disk shape should add focused tests before UI wiring.

Issue tracker mode is disabled for this workflow run: no external issue publication is requested or performed. The natural next workflow is issue slicing or TDD against the test targets above.
