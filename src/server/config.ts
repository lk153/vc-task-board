/** Feature switches derived from environment variables (safe to import from pages). */
export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);
