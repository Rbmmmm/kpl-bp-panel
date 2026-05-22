#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const inputs = [
  { size: 16, file: "build/icon_16x16.png" },
  { size: 32, file: "build/icon_32x32.png" },
  { size: 48, file: "build/icon.iconset/icon_48x48.png" },
  { size: 256, file: "build/icon_256x256.png" }
];

const outputPath = path.join(projectRoot, "build/icon.ico");

async function main() {
  const images = await Promise.all(
    inputs.map(async (input) => ({
      size: input.size,
      bytes: await fs.readFile(path.join(projectRoot, input.file))
    }))
  );

  const headerSize = 6;
  const entrySize = 16;
  let imageOffset = headerSize + images.length * entrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = images.map((image) => {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(image.size === 256 ? 0 : image.size, 0);
    entry.writeUInt8(image.size === 256 ? 0 : image.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.bytes.length, 8);
    entry.writeUInt32LE(imageOffset, 12);
    imageOffset += image.bytes.length;
    return entry;
  });

  await fs.writeFile(outputPath, Buffer.concat([header, ...entries, ...images.map((image) => image.bytes)]));
  console.log(`Wrote ${path.relative(projectRoot, outputPath)} with ${images.length} PNG icon entries.`);
}

void main();
