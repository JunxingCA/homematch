import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Use Next's existing image dependency; the source is the "Lights On" night logo.
const require = createRequire(import.meta.resolve("next/package.json"));
const sharp = require("sharp");
const root = new URL("../", import.meta.url);
const logo = await readFile(
  new URL("public/homematch-logo-lights-night.svg", root),
);
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
    .resize({
      width: Math.round(size * ratio),
      height: Math.round(size * ratio),
      fit: "inside",
    })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: "#101a2e" },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(new URL(name, directory).pathname);
}
// A PNG-backed ICO also covers browsers requesting the conventional root URL.
const png = await readFile(new URL("favicon-32.png", directory));
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico[6] = 32;
ico[7] = 32;
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
await writeFile(new URL("public/favicon.ico", root), Buffer.concat([ico, png]));
console.log(
  "Generated five PNG icons and a root favicon.ico from the existing logo.",
);
