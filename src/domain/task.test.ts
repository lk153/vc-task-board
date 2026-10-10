import { describe, expect, it } from "vitest";
import { assigneeTone } from "./tone";
import { createTaskSchema, inviteSchema, updateTaskSchema } from "./task";

describe("task schemas", () => {
  const valid = {
    title: "Ship it",
    status: "todo",
    priority: "medium",
    type: null,
    assigneeId: null,
    points: 1.5,
  };

  it("defaults the description and trims text", () => {
    expect(createTaskSchema.parse({ ...valid, title: "  Ship it " })).toMatchObject({
      title: "Ship it",
      description: "",
    });
  });

  it("rejects unknown statuses, priorities and types", () => {
    expect(createTaskSchema.safeParse({ ...valid, status: "blocked" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ ...valid, priority: "urgent" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ ...valid, type: "epic" }).success).toBe(false);
  });

  it("rejects negative points", () => {
    expect(createTaskSchema.safeParse({ ...valid, points: -1 }).success).toBe(false);
  });

  it("requires at least one field to update and a valid position key", () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
    expect(updateTaskSchema.safeParse({ position: "a0" }).success).toBe(true);
    expect(updateTaskSchema.safeParse({ position: "a 0" }).success).toBe(false);
  });

  it("normalises invite emails", () => {
    expect(inviteSchema.parse({ email: " Bea@Example.COM " }).email).toBe("bea@example.com");
  });
});

describe("assigneeTone", () => {
  it("is stable for the same id", () => {
    expect(assigneeTone("user-123")).toBe(assigneeTone("user-123"));
  });
});
