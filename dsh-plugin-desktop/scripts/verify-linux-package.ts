/** Verify the Linux x64 AppImage, DEB package, and unpacked executable. */

import { closeSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Verify a complete in-memory Linux ELF image. */
export function assertElfBinaryBuffer(data: Buffer, label: string, source: string): void {
  if (data.byteLength < 16) {
    throw new Error(`${label} is too small to contain an ELF header: ${source}`)
  }
  // 0x7f, 'E', 'L', 'F'
  if (
    data[0] !== 0x7f
    || data[1] !== 0x45
    || data[2] !== 0x4c
    || data[3] !== 0x46
  ) {
    throw new Error(`${label} does not have a Linux ELF header: ${source}`)
  }
  // 64-bit ELF
  if (data[4] !== 2) {
    throw new Error(`${label} is not a 64-bit ELF binary: ${source}`)
  }
}

/** Verify a Debian .deb archive header. */
export function assertDebArchiveBuffer(data: Buffer, label: string, source: string): void {
  const AR_MAGIC = '!<arch>\n'
  if (data.byteLength < 8 || data.subarray(0, 8).toString('ascii') !== AR_MAGIC) {
    throw new Error(`${label} does not have a valid Debian ar archive header: ${source}`)
  }
}

/** Paths returned after Linux package verification succeeds. */
export interface LinuxPackageArtifacts {
  /** AppImage installer path. */
  readonly appImagePath: string
  /** DEB package path. */
  readonly debPath: string
  /** Unpacked application executable path. */
  readonly applicationPath: string
}

/** Injectable Linux package verification boundary. */
export interface LinuxPackageVerificationOptions {
  /** Desktop package root containing package.json and dist. */
  readonly desktopRoot: string
  /** Product version embedded in the expected artifact name. */
  readonly version: string
}

function readVersion(desktopRoot: string): string {
  const manifest = JSON.parse(readFileSync(join(desktopRoot, 'package.json'), 'utf8')) as {
    version?: unknown
  }
  if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
    throw new Error(`desktop package at ${desktopRoot} has no valid version`)
  }
  return manifest.version
}

/** Verify that a generated Linux artifact has a valid ELF header. */
export function assertElfBinary(path: string, label: string): void {
  const stat = statSync(path)
  if (!stat.isFile() || stat.size < 16) {
    throw new Error(`${label} is not a non-empty regular file: ${path}`)
  }
  if ((stat.mode & 0o111) === 0) {
    throw new Error(`${label} is not marked executable: ${path}`)
  }
  const descriptor = openSync(path, 'r')
  const header = Buffer.alloc(16)
  try {
    const bytesRead = readSync(descriptor, header, 0, header.byteLength, 0)
    if (bytesRead !== header.byteLength) {
      throw new Error(`${label} could not read ELF header: ${path}`)
    }
    assertElfBinaryBuffer(header, label, path)
  } finally {
    closeSync(descriptor)
  }
}

/** Verify that a generated Debian package has a valid ar archive signature. */
export function assertDebArchive(path: string, label: string): void {
  const stat = statSync(path)
  if (!stat.isFile() || stat.size < 8) {
    throw new Error(`${label} is not a non-empty regular file: ${path}`)
  }
  const descriptor = openSync(path, 'r')
  const header = Buffer.alloc(8)
  try {
    const bytesRead = readSync(descriptor, header, 0, header.byteLength, 0)
    if (bytesRead !== header.byteLength) {
      throw new Error(`${label} could not read ar header: ${path}`)
    }
    assertDebArchiveBuffer(header, label, path)
  } finally {
    closeSync(descriptor)
  }
}

function defaultOptions(): LinuxPackageVerificationOptions {
  const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  return {
    desktopRoot,
    version: readVersion(desktopRoot),
  }
}

/**
 * Verify the exact AppImage, DEB package, and unpacked application executable.
 * @param options - Artifact root and expected product version.
 * @returns The verified artifact paths.
 */
export function verifyLinuxPackage(
  options: LinuxPackageVerificationOptions = defaultOptions(),
): LinuxPackageArtifacts {
  const distDir = join(options.desktopRoot, 'dist')
  const appImagePath = join(
    distDir,
    `DSH-Desktop-${options.version}-x86_64.AppImage`,
  )
  const debPath = join(
    distDir,
    `DSH-Desktop-${options.version}-amd64.deb`,
  )
  const applicationPath = join(distDir, 'linux-unpacked', 'dsh-plugin-desktop')

  assertElfBinary(appImagePath, 'Linux AppImage')
  assertDebArchive(debPath, 'Linux DEB package')
  assertElfBinary(applicationPath, 'unpacked Linux application')
  return { appImagePath, debPath, applicationPath }
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    const verified = verifyLinuxPackage()
    console.log(`Linux package verification passed: ${verified.appImagePath} and ${verified.debPath}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
