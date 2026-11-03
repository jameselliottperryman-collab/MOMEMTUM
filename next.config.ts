import type { NextConfig } from "next";
const config: NextConfig = {
  output:
    process.env.RELAYWORK_DESKTOP_BUILD === "1" ? "standalone" : undefined,
  serverExternalPackages: ["node:sqlite"],
  devIndicators: false,
  experimental: { proxyClientMaxBodySize: 27 * 1024 * 1024 },
};
export default config;
