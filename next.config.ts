import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["react-markdown", "katex", "highlight.js", "remark-gfm", "remark-math", "rehype-katex", "rehype-highlight"],
  },
};

export default nextConfig;
