/**
 * Prototype icon bridge: lucide-react → static SVG strings for window.Icons.
 *
 * ⚠ DESIGN-ONLY PROTOTYPE — esm.sh imports below are NOT permitted in the real app.
 * Real implementation imports lucide-react locally (bundled by Vite), per NFR-3
 * (完全离线、无任何联网依赖) and §3.3 of the technical architecture document.
 * Keeps existing dangerouslySetInnerHTML call sites; real app uses lucide-react components directly.
 */
import React from "https://esm.sh/react@18.3.1";
import { renderToStaticMarkup } from "https://esm.sh/react-dom@18.3.1/server";
import {
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  ChevronsLeftRight,
  Cloud,
  Columns2,
  Ellipsis,
  File,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderTree,
  GitBranch,
  History,
  Image,
  LayoutTemplate,
  List,
  PanelLeft,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from "https://esm.sh/lucide-react@0.511.0?deps=react@18.3.1";

const DEFAULT = { size: 14, strokeWidth: 1.75 };

function svg(Icon, props = {}) {
  return renderToStaticMarkup(React.createElement(Icon, { ...DEFAULT, ...props }));
}

window.Icons = {
  chev: (open) =>
    svg(ChevronRight, {
      size: 12,
      style: {
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform .12s",
      },
    }),
  folder: svg(Folder),
  folderOpen: svg(FolderOpen),
  nodeFolder: svg(FolderTree),
  file: svg(File),
  doc: svg(FileText),
  image: svg(Image),
  template: svg(LayoutTemplate),
  search: svg(Search),
  settings: svg(Settings, { size: 16 }),
  outline: svg(List),
  fields: svg(PanelLeft),
  history: svg(History),
  plus: svg(Plus),
  more: svg(Ellipsis),
  split: svg(Columns2),
  close: svg(X),
  collapse: svg(ChevronsLeftRight),
  refresh: svg(RefreshCw),
  newfile: svg(FilePlus),
  pin: svg(Pin, { size: 10, fill: "currentColor" }),
  branch: svg(GitBranch),
  pen: svg(Pencil),
  check: svg(Check, { size: 12, strokeWidth: 2 }),
  cloud: svg(Cloud, { size: 12 }),
  trash: svg(Trash2),
  restore: svg(RotateCcw, { size: 12 }),
  undo: svg(Undo2, { size: 12 }),
  consistency: svg(ShieldAlert),
  warning: svg(TriangleAlert),
};

window.dispatchEvent(new Event("eidon-icons-ready"));
