import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { auth } from "@/server/auth";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { listProviders } from "@/server/services/accounts";
import { listBoards, PERSONAL_BOARD_NAME } from "@/server/services/boards";

const signUp = (name: string, email: string, password = "password123") =>
  auth.api.signUpEmail({ body: { name, email, password } });

describe("first sign-up", () => {
  it("creates the account with a personal board", async () => {
    const { user: created } = await signUp("  Ada Lovelace  ", "Ada@Example.com");
    const [row] = await db.select().from(user).where(eq(user.id, created.id));

    expect(row.name).toBe("Ada Lovelace");
    expect(row.email).toBe("ada@example.com");
    expect(row.emailVerified).toBe(false); // the app sends no email
    expect(await listBoards(created.id)).toEqual([
      expect.objectContaining({ name: PERSONAL_BOARD_NAME, role: "owner" }),
    ]);
    expect(await listProviders(created.id)).toEqual(["credential"]);
  });

  it("rejects short passwords and duplicate emails", async () => {
    await expect(signUp("Short", "short@example.com", "1234567")).rejects.toThrow();
    await signUp("First", "taken@example.com");
    await expect(signUp("Second", "TAKEN@example.com")).rejects.toThrow();
  });

  it("signs in with the password it was created with", async () => {
    await signUp("Grace Hopper", "grace@example.com");
    const ok = await auth.api.signInEmail({
      body: { email: "grace@example.com", password: "password123" },
    });
    expect(ok.user.email).toBe("grace@example.com");
    await expect(
      auth.api.signInEmail({ body: { email: "grace@example.com", password: "wrong-password" } }),
    ).rejects.toThrow();
  });
});
