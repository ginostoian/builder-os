import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Library CSV imports send the file's text to a Server Action (capped at 1 MB in src/core/library-import.ts).
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
