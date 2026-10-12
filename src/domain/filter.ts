import type { Priority, Task } from "./task";

/** Assignee filter value for tasks with nobody assigned. */
export const UNASSIGNED = "";

export interface TaskFilters {
  query: string;
  priorities: Priority[];
  /** Task type ids. */
  types: string[];
  /** Person ids, or UNASSIGNED. */
  assignees: string[];
}

export const EMPTY_FILTERS: TaskFilters = { query: "", priorities: [], types: [], assignees: [] };

export function filterCount(filters: TaskFilters): number {
  return filters.priorities.length + filters.types.length + filters.assignees.length;
}

export function isFiltering(filters: TaskFilters): boolean {
  return filters.query.trim() !== "" || filterCount(filters) > 0;
}

/** OR within a filter group, AND across groups; search is a case-insensitive substring match. */
export function matchTask(task: Task, filters: TaskFilters): boolean {
  const query = filters.query.trim().toLowerCase();
  if (query && !`${task.title} ${task.description}`.toLowerCase().includes(query)) return false;
  if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false;
  if (filters.types.length && (!task.typeId || !filters.types.includes(task.typeId))) return false;
  if (filters.assignees.length && !filters.assignees.includes(task.assigneeId ?? UNASSIGNED)) {
    return false;
  }
  return true;
}

/** "3" normally, "2 of 3" when filters hide some tasks. */
export function countLabel(visible: number, total: number, filtering: boolean): string {
  return filtering && visible !== total ? `${visible} of ${total}` : String(total);
}

/**
 * Drops filter values for task types and people that no longer exist (deleted
 * here or by someone else). Returns the same object when nothing changed.
 */
export function pruneFilters(
  filters: TaskFilters,
  typeIds: ReadonlySet<string>,
  personIds: ReadonlySet<string>,
): TaskFilters {
  const types = filters.types.filter((id) => typeIds.has(id));
  const assignees = filters.assignees.filter((id) => id === UNASSIGNED || personIds.has(id));
  return types.length === filters.types.length && assignees.length === filters.assignees.length
    ? filters
    : { ...filters, types, assignees };
}
