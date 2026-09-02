/** Generate multi-resolution PNG icons for Linux hicolor icon themes. */

import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const buildRoot = join(packageRoot, 'build')
const iconDir = join(buildRoot, 'icons')
const source = join(buildRoot, 'app-icon.png')

const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]

export async function generateLinuxIcons() {
  await mkdir(iconDir, { recursive: true })
  await Promise.all(
    SIZES.map(async size => {
      const dest = join(iconDir, `${String(size)}x${String(size)}.png`)
      await sharp(source)
        .resize(size, size, { kernel: sharp.kernel.lanczos3 })
        .png({ compressionLevel: 9 })
        .toFile(dest)
    }),
  )
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && fileURLToPath(import.meta.url) === invokedPath) {
  await generateLinuxIcons()
}
