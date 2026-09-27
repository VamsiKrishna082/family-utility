// Generates the PWA icons from src/app/icon.svg. Run from the repo root.
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync("src/app/icon.svg", "utf8");
mkdirSync("public/icons", { recursive: true });

// "any" icons: the rounded tile as drawn.
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg), { density: (72 * size) / 32 }).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
}

// Maskable: Android crops to a circle/squircle, so the house sits inside the
// central 80% safe zone on a full-bleed background.
const inner = svg.replace('<rect width="32" height="32" rx="8" fill="#232028"/>', "");
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#232028"/><g transform="translate(4 4)">${inner.replace(/<svg[^>]*>|<\/svg>/g, "")}</g></svg>`;
for (const size of [192, 512]) {
  await sharp(Buffer.from(maskable), { density: (72 * size) / 40 }).resize(size, size).png().toFile(`public/icons/maskable-${size}.png`);
}

// iPhone home screen: square, iOS rounds it itself.
const apple = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#232028"/>${inner.replace(/<svg[^>]*>|<\/svg>/g, "")}</svg>`;
await sharp(Buffer.from(apple), { density: (72 * 180) / 32 }).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
console.log("icons written");
