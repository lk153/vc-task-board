import { createAuthClient } from "better-auth/react";

/** Better Auth client for sign-in, sign-up, sign-out and account actions (same origin). */
export const authClient = createAuthClient();

/** Friendly text for Better Auth client errors. */
export function authErrorMessage(error: { status?: number; code?: string; message?: string }) {
  if (error.status === 429) return "Too many attempts. Wait a few seconds and try again.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Wrong email or password.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Sign in instead.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters for your password.";
    case "PASSWORD_TOO_LONG":
      return "Use at most 128 characters for your password.";
    case "INVALID_PASSWORD":
      return "Your current password is wrong.";
    case "INVALID_EMAIL":
      return "Enter a valid email address.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

/** Only allow same-site relative paths as post-sign-in destinations. */
export function safeNext(next: string | null | undefined, fallback = "/") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
