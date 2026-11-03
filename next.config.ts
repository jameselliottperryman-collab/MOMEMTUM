import type { NextConfig } from "next";
const config: NextConfig = {
  output:
    process.env.RELAYWORK_DESKTOP_BUILD === "1" ? "standalone" : undefined,
  serverExternalPackages: ["node:sqlite"],
  devIndicators: false,
};
export default config;
