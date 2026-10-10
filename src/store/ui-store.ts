import { create } from "zustand";
import { DEFAULT_STATUS, TOAST_MS } from "@/config/board";
import { EMPTY_FILTERS, type TaskFilters } from "@/domain/filter";
import type { Status } from "@/domain/task";

/** UI-only state. Server data lives in TanStack Query; nothing here is persisted. */

export type Editor = { mode: "create"; status: Status } | { mode: "edit"; taskId: string };

export type DialogName =
  "share" | "newBoard" | "renameBoard" | "deleteBoard" | "leaveBoard" | "changePassword";

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

export type FilterGroup = Exclude<keyof TaskFilters, "query">;

interface UiState {
  filters: TaskFilters;
  showFilters: boolean;
  /** Column shown on mobile. */
  mobileStatus: Status;
  editor: Editor | null;
  confirmDeleteId: string | null;
  dialog: DialogName | null;
  toast: Toast | null;
  dragging: boolean;

  setQuery: (query: string) => void;
  toggleFilter: (group: FilterGroup, value: string) => void;
  clearFilterGroup: (group: FilterGroup) => void;
  clearFilters: () => void;
  setShowFilters: (show: boolean) => void;
  setMobileStatus: (status: Status) => void;
  openCreate: (status: Status) => void;
  openEdit: (taskId: string) => void;
  closeEditor: () => void;
  askDelete: (taskId: string) => void;
  cancelDelete: () => void;
  openDialog: (dialog: DialogName) => void;
  closeDialog: () => void;
  showToast: (message: string, action?: Toast["action"]) => void;
  dismissToast: () => void;
  setDragging: (dragging: boolean) => void;
  /** Fresh filters and panels when switching boards. */
  resetForBoard: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastId = 0;

export const useUi = create<UiState>()((set) => ({
  filters: EMPTY_FILTERS,
  showFilters: false,
  mobileStatus: DEFAULT_STATUS,
  editor: null,
  confirmDeleteId: null,
  dialog: null,
  toast: null,
  dragging: false,

  setQuery: (query) => set((s) => ({ filters: { ...s.filters, query } })),
  toggleFilter: (group, value) =>
    set((s) => {
      const current = s.filters[group] as string[];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { filters: { ...s.filters, [group]: next } };
    }),
  clearFilterGroup: (group) => set((s) => ({ filters: { ...s.filters, [group]: [] } })),
  clearFilters: () => set((s) => ({ filters: { ...EMPTY_FILTERS, query: s.filters.query } })),
  setShowFilters: (showFilters) => set({ showFilters }),
  setMobileStatus: (mobileStatus) => set({ mobileStatus }),
  openCreate: (status) => set({ editor: { mode: "create", status } }),
  openEdit: (taskId) => set({ editor: { mode: "edit", taskId } }),
  closeEditor: () => set({ editor: null }),
  askDelete: (confirmDeleteId) => set({ confirmDeleteId }),
  cancelDelete: () => set({ confirmDeleteId: null }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  showToast: (message, action) => {
    clearTimeout(toastTimer);
    const id = ++toastId;
    set({ toast: { id, message, action } });
    toastTimer = setTimeout(
      () => set((s) => (s.toast?.id === id ? { toast: null } : s)),
      action ? TOAST_MS.undo : TOAST_MS.default,
    );
  },
  dismissToast: () => {
    clearTimeout(toastTimer);
    set({ toast: null });
  },
  setDragging: (dragging) => set({ dragging }),
  resetForBoard: () =>
    set({
      filters: EMPTY_FILTERS,
      showFilters: false,
      mobileStatus: DEFAULT_STATUS,
      editor: null,
      confirmDeleteId: null,
      dialog: null,
    }),
}));
