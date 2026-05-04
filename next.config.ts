import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: [
      "react-markdown",
      "katex",
      "highlight.js",
      "remark-gfm",
      "remark-math",
      "rehype-katex",
      "rehype-highlight",
    ],
  },
  async headers() {
    // The immutable cache only makes sense in prod (where chunk filenames
    // are content-hashed). In dev, Turbopack reuses the same chunk URL
    // across recompiles, so an immutable cache pins the browser to stale
    // bundles and breaks HMR for every editor save.
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/favicon.svg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
