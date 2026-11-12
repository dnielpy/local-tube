import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:8000";
// In production Caddy serves /browser/; in development the browser container listens on 3010.
const browserUrl = process.env.BROWSER_DEV_URL ?? "http://localhost:3010";

const nextConfig: NextConfig = {
  output: "standalone",
  // KasmVNC under /browser/ needs its trailing slash.
  skipTrailingSlashRedirect: true,
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
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
      { source: "/browser/:path*", destination: `${browserUrl}/browser/:path*` },
    ];
  },
};

export default nextConfig;
