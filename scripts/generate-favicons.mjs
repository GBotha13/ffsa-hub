import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const MARK = join(ROOT, "public/brand/ff-mark-white.png");
const BG = "#000000";

async function render(size, outPath, padding = 0.18) {
  const inset = Math.round(size * (1 - padding * 2));
  const mark = await sharp(MARK)
    .trim()
    .resize({ width: inset, height: inset, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(outPath);

  console.log(`✓ ${outPath} (${size}×${size})`);
}

await render(64, join(ROOT, "src/app/icon.png"), 0.18);
await render(180, join(ROOT, "src/app/apple-icon.png"), 0.18);
