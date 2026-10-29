# Eagle Media Manager — Local Setup Guide

## Prerequisites

Install these once if you don't have them:

1. **Node.js 18+** — https://nodejs.org (click "LTS" download)
2. **Git** (optional, only needed if you clone) — https://git-scm.com

Check you have Node:
```bash
node --version   # should print v18.x or higher
npm --version    # should print 9.x or higher
```

---

## Setup (do this once)

```bash
# 1. Enter the project folder
cd eagle-media-manager

# 2. Install all dependencies (~2 minutes, downloads Electron + Vue + Vite)
npm install
```

---

## Run in Development Mode

```bash
npm run dev
```

This starts two processes in parallel:
- **Vite** on `http://localhost:5173` (the Vue frontend with hot reload)
- **Electron** (waits for Vite, then opens the app window)

The DevTools panel opens automatically in a separate window — you can close it.

---

## First use

1. Click **"Open Library…"** in the sidebar
2. A folder picker opens — **create a new folder** or pick an existing one.
   - If the folder has no `library.json` it creates a new library there.
   - If it already has one it opens the existing library.
3. Click **Import Files** or **drag and drop** images/videos onto the gallery.
4. Click any card to open the Inspector on the right.

---

## Where your data lives

Everything is stored **locally on your machine** in the library folder you chose:

```
YourLibraryFolder/          ← the folder you picked
├── library.json            ← library name, folders, tags
└── images/
    └── c1abc...xyz.info/   ← one folder per imported file
        ├── content.png     ← your original file (copied in)
        └── metadata.json   ← name, tags, notes, dimensions, etc.
```

**Nothing is sent anywhere.** No accounts, no cloud, no telemetry.

To back up your library: zip the folder. To move it: copy the folder.

---

## Build a distributable app (optional)

```bash
# Install electron-builder
npm install --save-dev electron-builder

# Add to package.json scripts:
#   "package": "npm run build && electron-builder"

npm run build     # compiles TypeScript + Vite
npm run package   # creates a .dmg / .exe / .AppImage
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `node: command not found` | Install Node from nodejs.org |
| `npm install` hangs | Check internet connection, try `npm install --prefer-offline` |
| White screen on launch | Wait 5 seconds — Vite is still starting. Reload with Cmd/Ctrl+R |
| `electron` not found | Run `npm install` again |
| Drag and drop not working | Files must be images/video — check supported formats below |

## Supported formats

Images: `png jpg jpeg jfif gif webp svg bmp tiff ico avif`  
Video:  `mp4 mov avi mkv webm m4v`  
Docs:   `pdf ai psd sketch`
