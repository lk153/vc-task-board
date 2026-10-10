// Runs first in the Vercel build (see vercel.json). Fails fast with clear
// instructions when required environment variables are missing, instead of
// a cryptic migration error or a deployment whose sign-in doesn't work.
// Plain Node, no dependencies.

const env = process.env;
const where = env.VERCEL_ENV ?? "local";
const errors = [];
const warnings = [];

if (!env.DATABASE_URL && !env.DATABASE_URL_UNPOOLED) {
  errors.push(
    `DATABASE_URL — connect Neon: Vercel project → Storage → Connect Database → Neon,` +
      ` and include the "${where === "preview" ? "Preview" : "Production"}" environment` +
      ` (for Preview, turn on branching under Deployments Configuration). Then redeploy.`,
  );
}

if (!env.BETTER_AUTH_SECRET) {
  errors.push(
    "BETTER_AUTH_SECRET — Project Settings → Environment Variables. Generate one with:" +
      " openssl rand -base64 32",
  );
} else if (env.BETTER_AUTH_SECRET.length < 32) {
  warnings.push("BETTER_AUTH_SECRET is shorter than 32 characters; use openssl rand -base64 32.");
}

if (where === "production" && !env.BETTER_AUTH_URL) {
  warnings.push(
    "BETTER_AUTH_URL is not set for Production; set it to your site URL, e.g. https://your-app.vercel.app",
  );
}

if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
  warnings.push(
    "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither (Google sign-in stays off).",
  );
}

for (const warning of warnings) console.warn(`⚠ ${warning}`);

if (errors.length > 0) {
  console.error(`\n✖ Missing environment variables for this deployment (${where}):\n`);
  for (const error of errors) console.error(`  - ${error}\n`);
  console.error(
    "Environment variable changes only apply to new deployments: redeploy after adding them.\n",
  );
  process.exit(1);
}

console.log(`✓ Environment looks good (${where}).`);
