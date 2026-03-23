/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BACKEND_URL:
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001",
  },
  // Allow shared package imports
  transpilePackages: ["@ai-trader/shared"],
};

module.exports = nextConfig;
