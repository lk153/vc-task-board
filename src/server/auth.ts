import "server-only";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { captcha, oAuthProxy } from "better-auth/plugins";
import { checkBotId } from "botid/server";
import { LIMITS } from "@/config/board";
import { googleEnabled } from "./config";
import { db } from "./db/client";
import { authSchema } from "./db/schema";
import { createPersonalBoard } from "./services/boards";

const env = process.env;
const https = (host: string | undefined) => (host ? `https://${host}` : undefined);

/** Production uses BETTER_AUTH_URL; Preview deployments use their own branch URL. */
const baseURL =
  env.VERCEL_ENV === "preview"
    ? (https(env.VERCEL_BRANCH_URL) ?? https(env.VERCEL_URL))
    : env.BETTER_AUTH_URL;

const productionURL = https(env.VERCEL_PROJECT_PRODUCTION_URL) ?? env.BETTER_AUTH_URL;

const plugins: BetterAuthPlugin[] = [];

// Google only allows registered callback URLs, so Preview deployments send the
// sign-in through Production and back. Needs the same secret in both.
if (googleEnabled && env.OAUTH_PROXY_SECRET && productionURL) {
  plugins.push(oAuthProxy({ productionURL, secret: env.OAUTH_PROXY_SECRET }));
}

// Invisible bot check on sign-up / sign-in. BotID only works on Vercel.
if (env.VERCEL === "1") {
  plugins.push(captcha({ provider: "vercel-botid", checkBotId }));
}

export const auth = betterAuth({
  appName: "VC Task Board",
  baseURL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [https(env.VERCEL_URL), https(env.VERCEL_BRANCH_URL), productionURL].filter(
    (origin): origin is string => Boolean(origin),
  ),
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),

  // The app sends no email, so addresses can't be confirmed. Nothing relies on
  // a password account's email being verified (see IMPLEMENTATION_PLAN §3.6).
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  socialProviders: googleEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
          prompt: "select_account",
        },
      }
    : {},

  account: {
    accountLinking: {
      enabled: true,
      // Never merge a Google sign-in into an existing (unverified) password
      // account; people connect Google from the user menu instead.
      disableImplicitLinking: true,
    },
  },

  // Counters live in Postgres so every serverless instance shares them.
  rateLimit: { storage: "database" },

  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => ({
          data: { ...newUser, name: newUser.name.trim().slice(0, LIMITS.name) || "New user" },
        }),
        after: async (created) => {
          await createPersonalBoard(created.id);
        },
      },
    },
  },

  plugins,
});

export type Auth = typeof auth;
