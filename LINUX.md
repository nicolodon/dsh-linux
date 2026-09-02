# DSH Desktop for Linux (Ubuntu 24.04+)

This guide documents how to build, run, test, and package **DSH Desktop** natively on Linux, with primary focus on **Ubuntu 24.04 LTS (Noble Numbat)**.

---

## 1. Prerequisites & System Setup

### Node.js and Package Manager
- **Node.js**: `^22.19.0` or `>=24.0.0` (Node 22 LTS recommended)
- **Yarn**: `4.18.0` (managed automatically via Corepack)
- **pnpm**: Managed automatically by submodules / DSH CLI

### System Libraries (Ubuntu 24.04 LTS)

Install the required build tools and Electron runtime dependencies:

```bash
sudo apt update
sudo apt install -y \
  git \
  build-essential \
  bubblewrap \
  zstd \
  libfuse2t64 \
  libssl3 \
  libnss3 \
  libatk1.0-0t64 \
  libatk-bridge2.0-0t64 \
  libcups2t64 \
  libdrm2 \
  libgbm1 \
  libasound2t64
```

> **Note on Ubuntu 24.04 packages**: Several shared libraries carry the `t64` suffix (64-bit time_t transition). On older Debian/Ubuntu releases (e.g., 22.04), the equivalent packages are `libfuse2`, `libatk1.0-0`, `libatk-bridge2.0-0`, `libcups2`, and `libasound2`.

Enable Corepack:

```bash
corepack enable
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
```

---

## 2. Workspace Initialization

Clone the repository and initialize submodules:

```bash
git submodule update --init --recursive
corepack yarn install --immutable
```

---

## 3. Development Workflow

### Build
Compile all TypeScript packages and native UI bundles:

```bash
corepack yarn build
```

### Typecheck & Test
Run the full static typechecker and Vitest test suite:

```bash
corepack yarn typecheck
corepack yarn test
```

### Full Headless Quality Gate
Verify runtime closure, documentation, licenses, and architecture boundaries:

```bash
corepack yarn check
```

### Dev Mode Launch
Start the desktop application in development mode:

```bash
corepack yarn dev
```

---

## 4. Packaging for Linux

DSH Desktop supports two primary distribution formats for Linux x64:
- **AppImage**: Standalone, portable executable requiring no installation.
- **DEB**: Debian/Ubuntu package with desktop integration and menu shortcuts.

### Build Distribution Packages

```bash
corepack yarn dist:linux
```

This runs preflight checks, packages both formats with `electron-builder`, and executes `verify-linux-package.ts` to validate ELF headers, AppImage execution permissions, and Debian archive integrity.

The resulting artifacts are placed in `dsh-plugin-desktop/dist/`:
- `dsh-plugin-desktop/dist/DSH-Desktop-<version>-x86_64.AppImage`
- `dsh-plugin-desktop/dist/DSH-Desktop-<version>-amd64.deb`
- `dsh-plugin-desktop/dist/linux-unpacked/` (unpacked directory)

### Preflight Verification Only

```bash
corepack yarn workspace dsh-plugin-desktop check:linux-package
```

---

## 5. Installing & Running Artifacts

### Running the AppImage
```bash
chmod +x dsh-plugin-desktop/dist/DSH-Desktop-*.AppImage
./dsh-plugin-desktop/dist/DSH-Desktop-*.AppImage
```

### Installing the Debian Package
```bash
sudo dpkg -i dsh-plugin-desktop/dist/DSH-Desktop-*.deb
# Or using apt to auto-resolve dependencies:
sudo apt install ./dsh-plugin-desktop/dist/DSH-Desktop-*.deb
```

After installation, **DSH Desktop** is available in the applications menu (`Development` / `Utility` categories) and can also be launched from terminal via:
```bash
dsh-desktop
```

---

## 6. Architecture & Platform Adaptation Notes

- **Unmodified Upstream**: The `deepseek-harness/` submodule remains unmodified. All desktop capabilities are provided by `dsh-plugin-desktop`.
- **Window Chrome**: Linux uses native system window decoration and controls, ensuring seamless integration with GNOME, KDE Plasma, and other Wayland/X11 window managers.
- **Tray Support**: Tray icons use the 32-bit PNG brand assets (`tray-icon-blue.png` / `@2x`) compatible with StatusNotifier / AppIndicator.
- **Sandbox**: Local sandbox isolation uses `bubblewrap` (`bwrap`) on Linux, matching upstream DSH security guarantees.
