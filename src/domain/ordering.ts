import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import type { Task } from "./task";

/**
 * Card order within a column is a fractional-indexing key compared by byte
 * order (Postgres column uses COLLATE "C"; JS `<` on ASCII strings matches).
 * Ties — possible when two people insert at the same spot — break on id.
 */
export function compareTasks(a: Pick<Task, "position" | "id">, b: Pick<Task, "position" | "id">) {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortTasks<T extends Pick<Task, "position" | "id">>(tasks: readonly T[]): T[] {
  return [...tasks].sort(compareTasks);
}

export function columnTasks<T extends Pick<Task, "statusId" | "position" | "id">>(
  tasks: readonly T[],
  statusId: string,
): T[] {
  return sortTasks(tasks.filter((task) => task.statusId === statusId));
}

/** A key that sorts between `before` and `after` (either may be null for an open end). */
export function positionBetween(before: string | null, after: string | null): string {
  // Equal or inverted neighbours only happen after concurrent edits; fall back
  // to "just after `before`" rather than throwing.
  if (before !== null && after !== null && before >= after) return generateKeyBetween(before, null);
  return generateKeyBetween(before, after);
}

/** Key for a card appended to the end of a column. */
export function positionAtEnd(tasksInColumn: readonly Pick<Task, "position" | "id">[]): string {
  const last = sortTasks(tasksInColumn).at(-1);
  return positionBetween(last?.position ?? null, null);
}

/**
 * Key for moving `taskId` to `index` within `targetColumn` (the column's tasks
 * in display order, which may or may not already contain the moved task).
 */
export function positionForMove(
  targetColumn: readonly Pick<Task, "position" | "id">[],
  taskId: string,
  index: number,
): string {
  const others = targetColumn.filter((task) => task.id !== taskId);
  const clamped = Math.max(0, Math.min(index, others.length));
  const before = others[clamped - 1]?.position ?? null;
  const after = others[clamped]?.position ?? null;
  return positionBetween(before, after);
}

export interface TaskMove {
  id: string;
  statusId: string;
  /** Exact position (used by Undo). Without it the task goes to the end of `status`. */
  position?: string;
}

export interface PlannedMove {
  id: string;
  statusId: string;
  position: string;
}

/**
 * Where each task in a bulk move ends up. Shared by the client (optimistic
 * update) and the server, so both compute the same positions.
 *
 * - With `position`: the task goes exactly there (Undo restores this way).
 * - Without: the task is appended to the end of the target column, in the
 *   order given. Tasks already in that column stay where they are.
 * - Ids not found in `tasks` (deleted, or another board) are skipped.
 */
export function planBulkMove(
  tasks: readonly Pick<Task, "id" | "statusId" | "position">[],
  moves: readonly TaskMove[],
): PlannedMove[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const planned: PlannedMove[] = [];
  const appendTo = new Map<string, string[]>();

  for (const move of moves) {
    const current = byId.get(move.id);
    if (!current) continue;
    if (move.position) {
      planned.push({ id: move.id, statusId: move.statusId, position: move.position });
    } else if (current.statusId !== move.statusId) {
      appendTo.set(move.statusId, [...(appendTo.get(move.statusId) ?? []), move.id]);
    }
  }

  const leaving = new Set([...appendTo.values()].flat());
  for (const [statusId, ids] of appendTo) {
    const staying = tasks.filter((t) => t.statusId === statusId && !leaving.has(t.id));
    const last = sortTasks(staying).at(-1)?.position ?? null;
    const keys = generateNKeysBetween(last, null, ids.length);
    ids.forEach((id, i) => planned.push({ id, statusId, position: keys[i] }));
  }
  return planned;
}
