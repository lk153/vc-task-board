import type { Priority, Task, TaskType } from "./task";

/** Assignee filter value for tasks with nobody assigned. */
export const UNASSIGNED = "";

export interface TaskFilters {
  query: string;
  priorities: Priority[];
  types: TaskType[];
  /** User ids, or UNASSIGNED. */
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
  if (filters.types.length && (!task.type || !filters.types.includes(task.type))) return false;
  if (filters.assignees.length && !filters.assignees.includes(task.assigneeId ?? UNASSIGNED)) {
    return false;
  }
  return true;
}

/** "3" normally, "2 of 3" when filters hide some tasks. */
export function countLabel(visible: number, total: number, filtering: boolean): string {
  return filtering && visible !== total ? `${visible} of ${total}` : String(total);
}
