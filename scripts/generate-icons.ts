/**
 * Generates minimal placeholder PNG icons for the PWA manifest.
 * Run once: npx tsx scripts/generate-icons.ts
 *
 * Creates a solid slate-blue square with "LN" text.
 * For production, replace with proper branded icons.
 */

import { createWriteStream } from 'fs'
import { deflateSync, crc32 } from 'zlib'
import path from 'path'

const SIZES = [192, 512]
const BG_COLOR = { r: 30, g: 41, b: 59 }   // slate-800 (#1e293b)
const FG_COLOR = { r: 96, g: 165, b: 250 }  // blue-400 (#60a5fa)

function writePNG(size: number, outPath: string) {
  // Build raw pixel data (RGB, no alpha for simplicity)
  const rowLen = size * 3
  const raw = Buffer.alloc(size * (1 + rowLen))  // +1 for filter byte per row

  for (let y = 0; y < size; y++) {
    const offset = y * (1 + rowLen)
    raw[offset] = 0  // filter type: None

    for (let x = 0; x < size; x++) {
      const px = offset + 1 + x * 3
      // Simple "LN" block letters using coordinate math
      const cx = Math.floor((x / size) * 10)
      const cy = Math.floor((y / size) * 10)

      // Letter L: columns 1-2, rows 1-8, plus bottom bar columns 1-4
      const isL =
        (cx >= 1 && cx <= 2 && cy >= 1 && cy <= 8) ||
        (cx >= 1 && cx <= 4 && cy >= 7 && cy <= 8)

      // Letter N: columns 6-9, rows 1-8, plus diagonal
      const isN =
        (cx >= 6 && cx <= 7 && cy >= 1 && cy <= 8) ||
        (cx >= 8 && cx <= 9 && cy >= 1 && cy <= 8) ||
        (cx === 7 && cy >= 3 && cy <= 5) ||
        (cx === 8 && cy >= 2 && cy <= 4)

      const isLetter = isL || isN
      const color = isLetter ? FG_COLOR : BG_COLOR

      raw[px] = color.r
      raw[px + 1] = color.g
      raw[px + 2] = color.b
    }
  }

  const compressed = deflateSync(raw)
  const out = createWriteStream(outPath)

  function chunk(type: string, data: Buffer) {
    const typeBuf = Buffer.from(type, 'ascii')
    const lenBuf = Buffer.alloc(4)
    lenBuf.writeUInt32BE(data.length, 0)

    const crcInput = Buffer.concat([typeBuf, data])
    const crcBuf = Buffer.alloc(4)
    // Use simple CRC32 via zlib (hack: piggyback on zlib's CRC)
    crcBuf.writeInt32BE(crc32(crcInput) | 0, 0)

    return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)    // width
  ihdr.writeUInt32BE(size, 4)    // height
  ihdr[8] = 8                    // bit depth
  ihdr[9] = 2                    // color type: RGB
  ihdr[10] = 0                   // compression
  ihdr[11] = 0                   // filter
  ihdr[12] = 0                   // interlace

  const idat = compressed
  const iend = Buffer.alloc(0)

  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', iend),
  ])

  out.write(png)
  out.end()
  console.log(`✓ ${outPath} (${size}×${size})`)
}

const iconsDir = path.join(process.cwd(), 'public', 'icons')

for (const size of SIZES) {
  writePNG(size, path.join(iconsDir, `icon-${size}.png`))
}
