import { create } from "zustand";
import { TOAST_MS } from "@/config/board";
import { EMPTY_FILTERS, type TaskFilters } from "@/domain/filter";

/** UI-only state. Server data lives in TanStack Query; nothing here is persisted. */

export type Editor = { mode: "create"; statusId: string } | { mode: "edit"; taskId: string };

/** Add / edit / delete a board status (column). */
export type StatusDialog =
  { mode: "add" } | { mode: "edit"; statusId: string } | { mode: "delete"; statusId: string };

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
  /** Column shown on mobile (null: the board's default column). */
  mobileStatus: string | null;
  editor: Editor | null;
  confirmDeleteId: string | null;
  dialog: DialogName | null;
  statusDialog: StatusDialog | null;
  toast: Toast | null;
  dragging: boolean;
  /** Selection mode: clicking a card selects it instead of opening the editor. */
  selecting: boolean;
  /** Selected task ids (may include tasks that have since been deleted or filtered out). */
  selected: string[];

  setQuery: (query: string) => void;
  toggleFilter: (group: FilterGroup, value: string) => void;
  clearFilterGroup: (group: FilterGroup) => void;
  clearFilters: () => void;
  setShowFilters: (show: boolean) => void;
  setMobileStatus: (statusId: string) => void;
  openCreate: (statusId: string) => void;
  openEdit: (taskId: string) => void;
  closeEditor: () => void;
  askDelete: (taskId: string) => void;
  cancelDelete: () => void;
  openDialog: (dialog: DialogName) => void;
  closeDialog: () => void;
  openStatusDialog: (dialog: StatusDialog) => void;
  closeStatusDialog: () => void;
  showToast: (message: string, action?: Toast["action"]) => void;
  dismissToast: () => void;
  setDragging: (dragging: boolean) => void;
  startSelecting: () => void;
  /** Leaves selection mode and clears the selection. */
  stopSelecting: () => void;
  /** Selects or deselects a task (and turns selection mode on). */
  toggleSelected: (taskId: string) => void;
  setSelected: (taskIds: string[]) => void;
  /** Fresh filters and panels when switching boards. */
  resetForBoard: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastId = 0;

export const useUi = create<UiState>()((set) => ({
  filters: EMPTY_FILTERS,
  showFilters: false,
  mobileStatus: null,
  editor: null,
  confirmDeleteId: null,
  dialog: null,
  statusDialog: null,
  toast: null,
  dragging: false,
  selecting: false,
  selected: [],

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
  openCreate: (statusId) => set({ editor: { mode: "create", statusId } }),
  openEdit: (taskId) => set({ editor: { mode: "edit", taskId } }),
  closeEditor: () => set({ editor: null }),
  askDelete: (confirmDeleteId) => set({ confirmDeleteId }),
  cancelDelete: () => set({ confirmDeleteId: null }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  openStatusDialog: (statusDialog) => set({ statusDialog }),
  closeStatusDialog: () => set({ statusDialog: null }),
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
  startSelecting: () => set({ selecting: true }),
  stopSelecting: () => set({ selecting: false, selected: [] }),
  toggleSelected: (taskId) =>
    set((s) => ({
      selecting: true,
      selected: s.selected.includes(taskId)
        ? s.selected.filter((id) => id !== taskId)
        : [...s.selected, taskId],
    })),
  setSelected: (selected) => set({ selecting: true, selected }),
  resetForBoard: () =>
    set({
      filters: EMPTY_FILTERS,
      showFilters: false,
      mobileStatus: null,
      editor: null,
      confirmDeleteId: null,
      dialog: null,
      statusDialog: null,
      selecting: false,
      selected: [],
    }),
}));
