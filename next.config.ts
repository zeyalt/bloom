import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Let a phone or tablet on the same network (or this laptop's hotspot) load the dev
// server: Next blocks dev assets for any host not listed. Read at start-up, so a new
// network address needs a dev-server restart. Has no effect on production builds.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter(a => a && a.family === "IPv4" && !a.internal)
  .map(a => a!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
  async redirects() {
    return [
      // Schedule was merged into the home agenda
      { source: "/schedule", destination: "/", permanent: false },
    ];
  },
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
