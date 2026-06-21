import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // HMR configuration for dev server
  webpackDevMiddleware: {
    watchOptions: {
      poll: 1000,
      aggregateTimeout: 300,
    },
  },
  onDemandEntries: {
    maxInactiveAge: 25000,
    pagesBufferLength: 5,
  },
  // Allow cross-origin requests from the Google Fonts CDN in dev
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
