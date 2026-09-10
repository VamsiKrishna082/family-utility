import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  // These use native bindings — keep them out of the webpack bundle
  serverExternalPackages: ["googleapis", "@google-cloud/storage", "sharp"],
};

export default config;
