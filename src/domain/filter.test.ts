import { describe, expect, it } from "vitest";
import {
  countLabel,
  EMPTY_FILTERS,
  filterCount,
  isFiltering,
  matchTask,
  pruneFilters,
  UNASSIGNED,
  type TaskFilters,
} from "./filter";
import { sortByName, type Task } from "./task";

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  boardId: "b1",
  title: "[Tech] CSV Download",
  description: "Propose a solution for reporting pages",
  statusId: "todo",
  priority: "high",
  typeId: "tech",
  assigneeId: "u1",
  points: null,
  position: "a0",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("matchTask", () => {
  it("matches everything with no filters", () => {
    expect(matchTask(task(), EMPTY_FILTERS)).toBe(true);
  });

  it("searches title and description, case-insensitively", () => {
    expect(matchTask(task(), { ...EMPTY_FILTERS, query: "csv" })).toBe(true);
    expect(matchTask(task(), { ...EMPTY_FILTERS, query: "REPORTING" })).toBe(true);
    expect(matchTask(task(), { ...EMPTY_FILTERS, query: "  csv  " })).toBe(true);
    expect(matchTask(task(), { ...EMPTY_FILTERS, query: "kafka" })).toBe(false);
  });

  it("ORs values within a group", () => {
    const filters: TaskFilters = { ...EMPTY_FILTERS, priorities: ["low", "high"] };
    expect(matchTask(task({ priority: "high" }), filters)).toBe(true);
    expect(matchTask(task({ priority: "medium" }), filters)).toBe(false);
  });

  it("ANDs across groups", () => {
    const filters: TaskFilters = { ...EMPTY_FILTERS, priorities: ["high"], types: ["bug"] };
    expect(matchTask(task({ priority: "high", typeId: "bug" }), filters)).toBe(true);
    expect(matchTask(task({ priority: "high", typeId: "tech" }), filters)).toBe(false);
  });

  it("never matches a type filter for tasks without a type", () => {
    expect(matchTask(task({ typeId: null }), { ...EMPTY_FILTERS, types: ["tech"] })).toBe(false);
  });

  it("supports filtering for unassigned tasks", () => {
    const filters = { ...EMPTY_FILTERS, assignees: [UNASSIGNED] };
    expect(matchTask(task({ assigneeId: null }), filters)).toBe(true);
    expect(matchTask(task({ assigneeId: "u1" }), filters)).toBe(false);
    expect(
      matchTask(task({ assigneeId: "u1" }), { ...EMPTY_FILTERS, assignees: ["u1", UNASSIGNED] }),
    ).toBe(true);
  });
});

describe("filter helpers", () => {
  it("counts chips but not the search query", () => {
    expect(
      filterCount({ query: "x", priorities: ["low"], types: ["bug", "docs"], assignees: [] }),
    ).toBe(3);
  });

  it("knows when anything is filtering", () => {
    expect(isFiltering(EMPTY_FILTERS)).toBe(false);
    expect(isFiltering({ ...EMPTY_FILTERS, query: "  " })).toBe(false);
    expect(isFiltering({ ...EMPTY_FILTERS, query: "a" })).toBe(true);
    expect(isFiltering({ ...EMPTY_FILTERS, assignees: [UNASSIGNED] })).toBe(true);
  });

  it("drops deleted task types and people from the filters", () => {
    const filters: TaskFilters = {
      ...EMPTY_FILTERS,
      types: ["bug", "gone"],
      assignees: ["u1", "left", UNASSIGNED],
    };
    expect(pruneFilters(filters, new Set(["bug"]), new Set(["u1"]))).toEqual({
      ...filters,
      types: ["bug"],
      assignees: ["u1", UNASSIGNED],
    });
    expect(pruneFilters(filters, new Set(["bug", "gone"]), new Set(["u1", "left"]))).toBe(filters);
  });

  it("lists names alphabetically, ignoring case and accents, with numbers in order", () => {
    const names = ["bug", "Ánh", "Task 10", "Task 2", "Zed"];
    const sorted = sortByName(names.map((name, i) => ({ id: String(i), name })));
    expect(sorted.map((x) => x.name)).toEqual(["Ánh", "bug", "Task 2", "Task 10", "Zed"]);
  });

  it("labels counts as 'x of y' only when filters hide tasks", () => {
    expect(countLabel(3, 3, false)).toBe("3");
    expect(countLabel(3, 3, true)).toBe("3");
    expect(countLabel(1, 3, true)).toBe("1 of 3");
  });
});
