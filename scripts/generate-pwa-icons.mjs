import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";

// Use Next's existing image dependency; the source is our existing vector logo.
const require = createRequire(import.meta.resolve("next/package.json"));
const sharp = require("sharp");
const root = new URL("../", import.meta.url);
const logo = await readFile(new URL("public/homematch-logo.svg", root));
const directory = new URL("public/pwa/", root);
await mkdir(directory, { recursive: true });
for (const [name, size, ratio] of [
  ["icon-192.png", 192, 0.7],
  ["icon-512.png", 512, 0.7],
  ["icon-maskable-512.png", 512, 0.6],
  ["apple-touch-icon.png", 180, 0.7],
  ["favicon-32.png", 32, 0.9],
]) {
  const mark = await sharp(logo)
    .resize(Math.round(size * ratio))
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: "#101313" },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(new URL(name, directory).pathname);
}
console.log("Generated five HomeMatch icons from the existing logo.");
