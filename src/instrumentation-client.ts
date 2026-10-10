import { initBotId } from "botid/client/core";

// Invisible bot check on sign-up / sign-in. Only on Vercel, where the server
// side (Better Auth captcha plugin) verifies it.
if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
  initBotId({
    protect: [
      { path: "/api/auth/sign-up/email", method: "POST" },
      { path: "/api/auth/sign-in/email", method: "POST" },
    ],
  });
}
