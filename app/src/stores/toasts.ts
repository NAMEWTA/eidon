/**
 * toasts store（Zustand v5）。从 Pinia `defineStore('toasts')` 1:1 迁移：
 * 字段/action 同名，自动消失逻辑（setTimeout → dismiss）逐字保留。
 */
import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  timeout: number;
}

interface ToastsState {
  items: Toast[];
}

interface ToastsActions {
  push(message: string, kind?: ToastKind, timeout?: number): number;
  success(message: string, timeout?: number): number;
  error(message: string, timeout?: number): number;
  info(message: string, timeout?: number): number;
  warning(message: string, timeout?: number): number;
  dismiss(id: number): void;
}

let nextId = 1;

export const useToastsStore = create<ToastsState & ToastsActions>()((set, get) => ({
  items: [],
  push(message, kind = 'info', timeout = 2800) {
    const id = nextId++;
    set({ items: [...get().items, { id, message, kind, timeout }] });
    if (timeout > 0) {
      setTimeout(() => get().dismiss(id), timeout);
    }
    return id;
  },
  success(message, timeout = 2200) {
    return get().push(message, 'success', timeout);
  },
  error(message, timeout = 5000) {
    return get().push(message, 'error', timeout);
  },
  info(message, timeout = 2800) {
    return get().push(message, 'info', timeout);
  },
  warning(message, timeout = 3500) {
    return get().push(message, 'warning', timeout);
  },
  dismiss(id) {
    set({ items: get().items.filter((t) => t.id !== id) });
  },
}));
