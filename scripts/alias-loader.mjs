// Lets `node --test` resolve the app's "@/…" imports (→ src/…​.ts) the way
// Next does, so pure modules can share code and still be tested directly.
// Use: node --import ./scripts/alias-loader.mjs --experimental-strip-types --test …
import { register } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const base = new URL(specifier.slice(2), src);
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      const candidate = fileURLToPath(base) + ext;
      if (existsSync(candidate)) return next(pathToFileURL(candidate).href, context);
    }
  }
  return next(specifier, context);
}

if (!import.meta.url.includes("?hooks")) register(`${import.meta.url}?hooks`);
