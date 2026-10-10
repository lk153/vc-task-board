import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { account } from "../db/schema";

/** Sign-in methods linked to a user, e.g. ["credential", "google"]. */
export async function listProviders(userId: string): Promise<string[]> {
  const rows = await db
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, userId));
  return [...new Set(rows.map((row) => row.providerId))];
}
