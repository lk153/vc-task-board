import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Keeps invite tokens in /invite/... URLs from leaking to other sites.
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// BotID's client challenge is proxied through these rewrites (active on Vercel).
export default withBotId(nextConfig);
