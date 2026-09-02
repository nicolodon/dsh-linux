# Porting DSH Desktop to Ubuntu 24.04 — Concrete Plan

**Target repo:** `anywhere-labs/deepseek-harness-desktop` (a.k.a. "DSH Desktop", ~21.4k stars)
**Goal:** Build and run the desktop client natively on Ubuntu 24.04 LTS
**License:** MIT — forking and porting is permitted
**Status of upstream:** Official installers exist only for Windows x64 (NSIS) and macOS Universal (DMG). The restriction is in the packaging pipeline, not the core architecture.

---

## 0. Why this port is feasible

- The app runs a **pinned, unmodified** `deepseek-harness/` submodule — upstream `dsh` is a Node/TypeScript local service + web UI that already works on Linux (requires Node ^22.19 or >=24).
- The desktop shell (window, tray, terminal, updater, workspace config) is implemented as a **DSH plugin** in `dsh-plugin-desktop/`, written in TypeScript on the same cross-platform runtime.
- Root repo uses Yarn workspaces; the harness submodule keeps its own pnpm workspace.
- Expected work: **packaging + platform guards**, not a rewrite.

---

## 1. Environment setup (Ubuntu 24.04)

Ubuntu 24.04's apt ships Node 18, which is too old for `dsh` (crashes with a `parseEnv` SyntaxError at launch). Install Node 22 from NodeSource:

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # must be v22.19+

# Tooling and runtime deps
sudo apt install -y git build-essential bubblewrap zstd libfuse2t64 libssl3 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 libgbm1 libasound2t64
corepack enable
```

> Note: on 24.04 several Electron runtime libs carry the `t64` suffix. If `apt` reports a missing name, search with `apt search <libname>` and pick the `t64` variant.

---

## 2. Phase 1 — Clone and smoke-test in dev mode

```bash
git clone https://github.com/anywhere-labs/deepseek-harness-desktop.git
cd deepseek-harness-desktop
git submodule update --init --recursive

corepack yarn install --immutable
corepack yarn dev
```

**Checkpoint:** If the shell is Electron-based (likely), `yarn dev` may already launch a working window on Linux unmodified. Test:

- [ ] Window opens and loads the local web UI
- [ ] Settings → Models accepts a DeepSeek API key
- [ ] Workspace can be selected (composer unlocks)
- [ ] A simple agent task runs end-to-end
- [ ] Tray icon appears (or fails — see Phase 2)

If `yarn dev` fails, capture the error — it identifies the first platform-specific code to patch.

---

## 3. Phase 2 — Audit and patch platform-specific code

Find every platform branch:

```bash
grep -rn "win32\|darwin" --include="*.ts" --include="*.tsx" --include="*.js" . | grep -v node_modules
grep -rn "nsis\|dmg\|\.ico\|\.icns" --include="*.ts" --include="*.json" --include="*.yml" . | grep -v node_modules
```

Patch the four usual suspects:

### 3.1 Tray icon
Linux needs a PNG (and often a StatusNotifier/AppIndicator theme-friendly variant). Guard icon selection:

```ts
const iconName = process.platform === 'linux' ? 'tray.png' : process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.ico';
```

### 3.2 Auto-updater
NSIS/DMG update logic is win32/mac-only. Disable or stub on Linux:

```ts
if (process.platform === 'linux') {
  // No auto-update; rely on AppImage/deb reinstall
} else {
  autoUpdater.checkForUpdatesAndNotify();
}
```

### 3.3 Window chrome
Custom title bars often assume macOS traffic lights or Windows snap behavior. Verify `titleBarStyle`, `frame`, and window-control IPC handlers behave on Linux; fall back to native frame if broken.

### 3.4 Service start/stop scripts
Any `.cmd`/PowerShell helpers need bash equivalents (systemd user service or a simple spawn wrapper):

```bash
#!/usr/bin/env bash
# scripts/install-service-linux.sh — sketch
exec dsh serve --port 3080
```

---

## 4. Phase 3 — Linux packaging

Add a Linux target to the builder config (check for `electron-builder.yml`, `electron-builder.json`, or a `build` block in `dsh-plugin-desktop/package.json`):

```yaml
appId: io.github.anywherelabs.dshdesktop
productName: DSH Desktop
linux:
  target:
    - AppImage
    - deb
  category: Utility
  icon: build/icon.png
  maintainer: "you <you@example.com>"
  desktop:
    Name: DSH Desktop
    Comment: Desktop client for DeepSeek Harness
```

Build:

```bash
corepack yarn dist --linux
# or, if scripts are split:
corepack yarn workspace dsh-plugin-desktop run dist --linux
```

**Checkpoint:**

- [ ] `dist/*.AppImage` and `dist/*.deb` are produced
- [ ] AppImage runs after `chmod +x` (requires `libfuse2t64`, installed in Phase 1)
- [ ] `sudo dpkg -i dist/*.deb` installs and creates a working launcher entry
- [ ] Icon renders correctly in the GNOME dock and tray

---

## 5. Phase 4 — Validation matrix

| Test | Expected |
|---|---|
| Cold start | Web UI loads in the window within ~5 s |
| API key config | Persists across restarts |
| Agent task run | Turn loop, tool calls, and session log work |
| Plugin install | Desktop shell installs/loads DSH plugins |
| Sandbox | `bubblewrap` backend active (check dsh logs) |
| Headless fallback | `dsh web` still reachable at `http://127.0.0.1:3080` if the shell crashes |

---

## 6. Fallbacks if the port stalls

1. **Official harness, no desktop shell:** `sudo npm install -g @deepseek-ai/dsh && dsh web` — full functionality in the browser, English UI.
2. **Existing Linux wrapper:** `liguobao/dsh-desktop` ships a Linux x64 AppImage with an English README (smaller project, but zero porting work).
3. **Remote server:** run `dsh web` on a GPU box and tunnel: `ssh -N -L 3080:127.0.0.1:3080 user@server`.

---

## 7. Risks and notes

- Ecosystem is a two-week-old **developer preview**; upstream promises breaking changes between release candidates. Pin versions (`dsh --version`, submodule commit) and document them.
- The repo pins the harness via a submodule — **do not** upgrade it casually; the desktop shell is version-matched to it.
- Without reading the full source, a hard platform dependency inside `dsh-plugin-desktop/` can't be ruled out. Phase 2's grep audit settles this within the first hour.
- To contribute the port back, open a PR adding the `linux` builder target + platform guards — MIT license, independent community project.

---

## 8. Deliverables checklist

- [ ] Fork created and submodule pinned
- [ ] Dev mode runs on Ubuntu 24.04
- [ ] Platform guards patched (tray, updater, window chrome, service scripts)
- [ ] `AppImage` + `.deb` artifacts built
- [ ] Validation matrix passed
- [ ] `LINUX.md` added to the fork documenting build steps
