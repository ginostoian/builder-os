import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Uploads go through Server Actions: library CSVs (1 MB), photos (shrunk to under 2 MB) and project files
    // (4 MB, src/core/files.ts). Vercel caps a request at 4.5 MB whatever this says.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
