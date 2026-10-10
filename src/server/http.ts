import "server-only";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { auth } from "./auth";
import { HttpError, invalid, unauthorized } from "./errors";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
}

/** The signed-in user for this request, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalid("The request body must be JSON.");
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Invalid request.";
    return Response.json({ error: { code: "invalid", message } }, { status: 422 });
  }
  console.error(error);
  return Response.json(
    { error: { code: "internal", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

/**
 * Wraps a Route Handler: returned values become JSON (undefined → 204) and
 * thrown HttpError / ZodError become `{ error: { code, message } }`.
 */
export function route<Context>(handler: (request: Request, context: Context) => Promise<unknown>) {
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      const result = await handler(request, context);
      if (result instanceof Response) return result;
      if (result === undefined) return new Response(null, { status: 204 });
      return Response.json(result);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
