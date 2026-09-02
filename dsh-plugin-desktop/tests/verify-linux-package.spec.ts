import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertDebArchive,
  assertDebArchiveBuffer,
  assertElfBinary,
  assertElfBinaryBuffer,
  verifyLinuxPackage,
} from '../scripts/verify-linux-package.ts'

const VALID_ELF = Buffer.from([
  0x7f, 0x45, 0x4c, 0x46, // \x7fELF
  0x02,                   // 64-bit
  0x01,                   // little endian
  0x01,                   // version
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
])

const VALID_DEB_HEADER = Buffer.from('!<arch>\ndebian-binary   0           0     0     644     4         `\n4\n')

describe('Linux package artifact verification', () => {
  it('accepts a valid 64-bit ELF binary buffer', () => {
    expect(() => assertElfBinaryBuffer(VALID_ELF, 'ELF', 'test')).not.toThrow()
  })

  it('rejects an ELF binary buffer that is too small', () => {
    expect(() => assertElfBinaryBuffer(Buffer.from([0x7f, 0x45]), 'ELF', 'test'))
      .toThrow('too small to contain an ELF header')
  })

  it('rejects a buffer with an invalid ELF magic', () => {
    const invalid = Buffer.from(VALID_ELF)
    invalid[0] = 0x00
    expect(() => assertElfBinaryBuffer(invalid, 'ELF', 'test'))
      .toThrow('does not have a Linux ELF header')
  })

  it('rejects a 32-bit ELF binary', () => {
    const elf32 = Buffer.from(VALID_ELF)
    elf32[4] = 1 // 32-bit
    expect(() => assertElfBinaryBuffer(elf32, 'ELF', 'test'))
      .toThrow('is not a 64-bit ELF binary')
  })

  it('accepts a valid Debian ar archive header', () => {
    expect(() => assertDebArchiveBuffer(VALID_DEB_HEADER, 'DEB', 'test')).not.toThrow()
  })

  it('rejects an invalid Debian ar archive header', () => {
    expect(() => assertDebArchiveBuffer(Buffer.from('PK\x03\x04zip'), 'DEB', 'test'))
      .toThrow('does not have a valid Debian ar archive header')
  })

  it('verifies generated AppImage, DEB, and unpacked binary in dist directory', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'dsh-linux-verify-test-'))
    const distDir = join(tempRoot, 'dist')
    const unpackedDir = join(distDir, 'linux-unpacked')
    mkdirSync(unpackedDir, { recursive: true })

    const appImagePath = join(distDir, 'DSH-Desktop-2.0.3-x86_64.AppImage')
    const debPath = join(distDir, 'DSH-Desktop-2.0.3-amd64.deb')
    const appPath = join(unpackedDir, 'dsh-plugin-desktop')

    writeFileSync(appImagePath, VALID_ELF, { mode: 0o755 })
    writeFileSync(debPath, VALID_DEB_HEADER, { mode: 0o644 })
    writeFileSync(appPath, VALID_ELF, { mode: 0o755 })

    try {
      const result = verifyLinuxPackage({
        desktopRoot: tempRoot,
        version: '2.0.3',
      })
      expect(result).toEqual({
        appImagePath,
        debPath,
        applicationPath: appPath,
      })
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it('rejects when an AppImage is not marked executable', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'dsh-linux-verify-test-'))
    const distDir = join(tempRoot, 'dist')
    mkdirSync(distDir, { recursive: true })
    const appImagePath = join(distDir, 'DSH-Desktop-2.0.3-x86_64.AppImage')
    writeFileSync(appImagePath, VALID_ELF, { mode: 0o644 }) // not executable

    try {
      expect(() => assertElfBinary(appImagePath, 'Linux AppImage'))
        .toThrow('is not marked executable')
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it('validates a deb file on disk with assertDebArchive', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'dsh-linux-verify-deb-'))
    const debPath = join(tempRoot, 'test.deb')
    writeFileSync(debPath, VALID_DEB_HEADER, { mode: 0o644 })

    try {
      expect(() => assertDebArchive(debPath, 'Linux DEB')).not.toThrow()
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})
