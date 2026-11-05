import type { NextConfig } from "next";

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
  // The dictionary JSON is read with fs at runtime; make sure serverless
  // bundles (e.g. Vercel) ship it alongside every route.
  outputFileTracingIncludes: {
    "/*": ["./data/generated/**/*"],
  },
  // The checker moved to the home page; keep old links working (query is preserved).
  async redirects() {
    return [{ source: "/check", destination: "/", permanent: false }];
  },
};

export default nextConfig;
