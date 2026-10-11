import { describe, expect, it } from "vitest";
import {
  columnTasks,
  positionAtEnd,
  positionBetween,
  planBulkMove,
  positionForMove,
  sortTasks,
} from "./ordering";
import type { Task } from "./task";

const item = (id: string, position: string) => ({ id, position });

describe("positionBetween", () => {
  it("creates keys that sort between their neighbours", () => {
    const first = positionBetween(null, null);
    const after = positionBetween(first, null);
    const before = positionBetween(null, first);
    const middle = positionBetween(first, after);
    expect([after, first, middle, before].sort()).toEqual([before, first, middle, after]);
  });

  it("falls back instead of throwing when neighbours are equal or inverted", () => {
    expect(positionBetween("a1", "a1") > "a1").toBe(true);
    expect(positionBetween("a2", "a1") > "a2").toBe(true);
  });

  it("only produces base-62 keys", () => {
    let key = positionBetween(null, null);
    for (let i = 0; i < 50; i++) key = positionBetween(null, key);
    expect(key).toMatch(/^[0-9A-Za-z]+$/);
  });
});

describe("sortTasks", () => {
  it("orders by position, then id for ties", () => {
    const sorted = sortTasks([item("b", "a1"), item("c", "a0"), item("a", "a1")]);
    expect(sorted.map((t) => t.id)).toEqual(["c", "a", "b"]);
  });

  it('uses byte order (uppercase before lowercase), like Postgres COLLATE "C"', () => {
    expect(sortTasks([item("x", "a0"), item("y", "Zz")]).map((t) => t.id)).toEqual(["y", "x"]);
  });
});

describe("column helpers", () => {
  const tasks = [
    { ...item("1", "a1"), statusId: "todo" },
    { ...item("2", "a0"), statusId: "todo" },
    { ...item("3", "a0"), statusId: "done" },
  ] as Task[];

  it("returns one column, sorted", () => {
    expect(columnTasks(tasks, "todo").map((t) => t.id)).toEqual(["2", "1"]);
  });

  it("appends after the last card", () => {
    expect(positionAtEnd(columnTasks(tasks, "todo")) > "a1").toBe(true);
    expect(positionAtEnd([])).toBe(positionBetween(null, null));
  });
});

describe("positionForMove", () => {
  const column = [item("a", "a0"), item("b", "a1"), item("c", "a2")];

  it("places a card at the start, middle or end", () => {
    const start = positionForMove(column, "new", 0);
    const middle = positionForMove(column, "new", 1);
    const end = positionForMove(column, "new", 3);
    expect(start < "a0").toBe(true);
    expect("a0" < middle && middle < "a1").toBe(true);
    expect(end > "a2").toBe(true);
  });

  it("ignores the moved card itself when reordering within a column", () => {
    // Move "a" to the end: it should land after "c".
    expect(positionForMove(column, "a", 2) > "a2").toBe(true);
    // Move "c" to the top.
    expect(positionForMove(column, "c", 0) < "a0").toBe(true);
  });

  it("clamps out-of-range indexes", () => {
    expect(positionForMove(column, "new", 99) > "a2").toBe(true);
    expect(positionForMove(column, "new", -5) < "a0").toBe(true);
  });
});

describe("planBulkMove", () => {
  const tasks = [
    { id: "a", statusId: "todo", position: "a0" },
    { id: "b", statusId: "todo", position: "a1" },
    { id: "c", statusId: "todo", position: "a2" },
    { id: "d", statusId: "done", position: "a0" },
  ] as const;

  it("appends moved tasks to the end of the target column, in the order given", () => {
    const plan = planBulkMove(tasks, [
      { id: "c", statusId: "done" },
      { id: "a", statusId: "done" },
    ]);
    expect(plan.map((m) => m.id)).toEqual(["c", "a"]);
    expect(plan.every((m) => m.statusId === "done")).toBe(true);
    const [c, a] = plan;
    expect("a0" < c.position && c.position < a.position).toBe(true);
  });

  it("leaves tasks that are already in the target column alone", () => {
    expect(planBulkMove(tasks, [{ id: "d", statusId: "done" }])).toEqual([]);
  });

  it("uses explicit positions as-is (Undo)", () => {
    expect(planBulkMove(tasks, [{ id: "d", statusId: "todo", position: "a05" }])).toEqual([
      { id: "d", statusId: "todo", position: "a05" },
    ]);
  });

  it("skips unknown ids and handles several target columns", () => {
    const plan = planBulkMove(tasks, [
      { id: "zzz", statusId: "done" },
      { id: "a", statusId: "review" },
      { id: "b", statusId: "backlog" },
    ]);
    expect(plan.map((m) => [m.id, m.statusId])).toEqual([
      ["a", "review"],
      ["b", "backlog"],
    ]);
  });

  it("doesn't count tasks that are leaving when finding the end of a column", () => {
    // Moving every todo task to done: the done column's end is after "d".
    const plan = planBulkMove(tasks, [
      { id: "a", statusId: "done" },
      { id: "b", statusId: "done" },
    ]);
    expect(plan.every((m) => m.position > "a0")).toBe(true);
  });
});
