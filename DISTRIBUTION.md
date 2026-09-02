# DSH Desktop Distribution Guide

This document details all methods for distributing **DSH Desktop** to end-users across Linux distributions (Ubuntu/Debian, Fedora, Arch, etc.), including direct downloads, automated GitHub Releases, APT repositories (`apt`/`apt-get`), Snap Store, and Flathub.

---

## Table of Contents

1. [GitHub Releases (Standard & Recommended)](#1-github-releases)
2. [Hosting an APT / apt-get Repository](#2-hosting-an-apt-repository)
   - [Method A: GitHub Pages APT Repo (Automated & Free)](#method-a-github-pages-apt-repository)
   - [Method B: Ubuntu Launchpad PPA](#method-b-ubuntu-launchpad-ppa)
   - [Method C: Cloudsmith / PackageCloud](#method-c-cloudsmith--packagecloud)
3. [Canonical Snap Store (Ubuntu Snap)](#3-canonical-snap-store)
4. [Flathub (Flatpak)](#4-flathub-flatpak)
5. [Summary Comparison](#5-summary-comparison)

---

## 1. GitHub Releases

The simplest and most transparent distribution method. Users download the `.deb` or `.AppImage` directly from your GitHub Releases page.

### Automated GitHub Release Workflow

An automated workflow is configured in `.github/workflows/release.yml`. When you push a Git version tag (e.g., `v2.0.3`):

```bash
git tag v2.0.3
git push origin v2.0.3
```

GitHub Actions automatically:
1. Builds the native Linux `.deb` and `.AppImage` artifacts.
2. Builds the Windows installer (`.exe`) and portable executable.
3. Publishes a new GitHub Release with all downloadable assets attached.

### User Installation Instructions

**Option A — Install `.deb`:**
```bash
wget https://github.com/nicolodon/dsh-linux/releases/latest/download/DSH-Desktop-2.0.3-amd64.deb
sudo apt install ./DSH-Desktop-2.0.3-amd64.deb
```

**Option B — Run `.AppImage` (Portable):**
```bash
wget https://github.com/nicolodon/dsh-linux/releases/latest/download/DSH-Desktop-2.0.3-x86_64.AppImage
chmod +x DSH-Desktop-2.0.3-x86_64.AppImage
./DSH-Desktop-2.0.3-x86_64.AppImage
```

---

## 2. Hosting an APT Repository

Hosting a dedicated APT repository allows users to install and update DSH Desktop using standard `apt update && apt install dsh-plugin-desktop` or `apt-get`.

### Method A: GitHub Pages APT Repository

You can host a signed Debian package repository directly on GitHub Pages using the `gh-pages` branch.

#### 1. Generate a GPG Signing Key
```bash
gpg --quick-generate-key "DSH Desktop Release <dev@dshdesktop.cn>" rsa4096 encr 0
gpg --armor --export "DSH Desktop Release" > gpg.key
gpg --armor --export-secret-keys "DSH Desktop Release" > gpg.private.key
```

#### 2. Add Secrets to GitHub Repository
In `Settings -> Secrets and variables -> Actions`:
- `GPG_PRIVATE_KEY`: Content of `gpg.private.key`
- `GPG_PASSPHRASE`: Passphrase for the key (if set)

#### 3. User Setup & Installation
Once deployed to GitHub Pages (`https://nicolodon.github.io/dsh-linux/`):

```bash
# 1. Download & trust repository signing key
curl -fsSL https://nicolodon.github.io/dsh-linux/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/dsh-desktop.gpg

# 2. Add APT repository source list
echo "deb [signed-by=/etc/apt/keyrings/dsh-desktop.gpg] https://nicolodon.github.io/dsh-linux/ stable main" | sudo tee /etc/apt/sources.list.d/dsh-desktop.list

# 3. Update and install
sudo apt update
sudo apt install dsh-plugin-desktop
```

---

### Method B: Ubuntu Launchpad PPA

Personal Package Archives (PPAs) are the canonical mechanism for Ubuntu:

1. Create an account on [Launchpad.net](https://launchpad.net).
2. Create a PPA (e.g. `ppa:username/dsh-desktop`).
3. Upload source package via `debuild -S` and `dput`.
4. Users install with:
   ```bash
   sudo add-apt-repository ppa:<username>/dsh-desktop
   sudo apt update
   sudo apt install dsh-plugin-desktop
   ```

---

### Method C: Cloudsmith / PackageCloud

SaaS package hosts with automated one-line installer scripts:

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/<org>/<repo>/setup.deb.sh' | sudo -E bash
sudo apt install dsh-plugin-desktop
```

---

## 3. Canonical Snap Store

Snap packages run sandboxed and auto-update on Ubuntu, Manjaro, Fedora, and Debian.

### 1. Build Snap Package
Add `"snap"` to the `linux.target` array in `dsh-plugin-desktop/package.json`:

```json
"linux": {
  "target": ["AppImage", "deb", "snap"]
}
```

### 2. Register and Publish
```bash
# Install Snapcraft
sudo snap install snapcraft --classic

# Log in with your Ubuntu One / Snapcraft account
snapcraft login

# Register application name
snapcraft register dsh-desktop

# Upload and release to stable channel
snapcraft upload dsh-plugin-desktop/dist/dsh-desktop_*.snap --release=stable
```

### 3. User Installation
```bash
sudo snap install dsh-desktop
```

---

## 4. Flathub (Flatpak)

Flathub is the universal Linux app store supported across all major distributions.

1. Fork [flathub/flathub](https://github.com/flathub/flathub).
2. Create manifest `cn.dshdesktop.DSHDesktop.yml` referencing the GitHub release tarball/AppImage.
3. Submit a Pull Request to Flathub.
4. Once merged, users can install via GNOME Software / KDE Discover or CLI:
   ```bash
   flatpak install flathub cn.dshdesktop.DSHDesktop
   flatpak run cn.dshdesktop.DSHDesktop
   ```

---

## 5. Summary Comparison

| Method | Audience | Update Mechanism | Setup Effort |
|---|---|---|---|
| **GitHub Releases (.deb / .AppImage)** | Tech users, direct downloads | Manual download / built-in updater | ⚡ Immediate |
| **APT Repository (GitHub Pages)** | Ubuntu & Debian users | `sudo apt update && sudo apt upgrade` | 🟢 Easy (1 workflow) |
| **Snap Store (Snapcraft)** | Ubuntu desktop default | Background auto-update | 🟡 Moderate (Account required) |
| **Flathub (Flatpak)** | Universal (Fedora, Arch, Steam Deck, Ubuntu) | `flatpak update` / App Center | 🟡 Moderate (PR submission) |
