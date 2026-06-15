# Welcome to EIDON

Thanks for trying EIDON — a fast, native Markdown editor built with Tauri 2.

This tour is **four short notes**. Open any tab to keep reading.

## What's open right now

| Tab | What it covers |
| --- | --- |
| **Welcome** | This page. |
| **Markdown syntax** | Quick reference — headings, lists, code, tables, math, mermaid. |
| **Live edit** | How inline rendering reveals raw Markdown at your caret. |
| **Shortcuts** | The keyboard map you actually need. |

## The 60-second start

1. Type — your file is autosaved in memory until you hit `Ctrl+S` (or `Cmd+S` on Mac).
2. Press `Ctrl+Shift+P` to cycle the layout: **Editor → Split → Preview → Reading**. The editor's **Source ⇄ Live edit** is a separate toolbar toggle (works in both Editor and Split).
3. Drop an image into the editor: it's pasted as a relative path (and you can configure where with the `imageRoot` front-matter key).
4. Open a folder via `File → Open Folder…` to browse files in the side tree.

## A few things EIDON does that other editors don't

- **Native print → PDF** with `Ctrl+Shift+Alt+P` (no headless Chrome required).
- **Live edit** — the toolbar's Source ⇄ Live edit toggle: inline rendering that shows raw Markdown only on your caret's line, available in both Editor and Split layouts.
- **Front-matter `imageRoot`** lets every paste/drop write to a custom image folder per document.

> Tip: press `Ctrl+K` (or `Cmd+K`) to open the **command palette** — it lists everything EIDON can do.

That's it. Close these tutorial tabs whenever you're done — they live only in memory and won't write to disk unless you `Save As`.

— *the EIDON team*
