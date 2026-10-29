import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, nativeTheme, nativeImage, clipboard } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'
import { pathToFileURL } from 'url'
import sharp from 'sharp'
import log from 'electron-log'
import { LibraryManager } from './services/LibraryManager'
import { EnhanceService } from './services/EnhanceService'

// ── Logging Configuration ───────────────────────────────────────────────────

log.initialize()
log.info('App starting...')
Object.assign(console, log.functions) // Redirect console.log/warn/error to electron-log

// Catch unhandled errors
process.on('uncaughtException', (err) => {
  log.error('Uncaught Exception:', err)
})
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// ── Session (persists across launches) ──────────────────────────────────────

interface Session {
  lastLibraryPath: string | null
  recentLibraries: Array<{ path: string; name: string; openedAt: number }>
  aiModelsPath?: string | null
}

function sessionPath(): string {
  return path.join(app.getPath('userData'), 'session.json')
}
async function loadSession(): Promise<Session> {
  try {
    const raw = await fs.readFile(sessionPath(), 'utf8')
    return { recentLibraries: [], lastLibraryPath: null, ...JSON.parse(raw) }
  } catch { return { lastLibraryPath: null, recentLibraries: [] } }
}
async function saveSession(data: Session): Promise<void> {
  try {
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await fs.writeFile(sessionPath(), JSON.stringify(data, null, 2), 'utf8')
  } catch { }
}
async function recordOpened(libraryPath: string, name: string): Promise<void> {
  const session = await loadSession()
  session.recentLibraries = session.recentLibraries.filter(lib => lib.path !== libraryPath)
  session.recentLibraries.unshift({ path: libraryPath, name, openedAt: Date.now() })
  session.recentLibraries = session.recentLibraries.slice(0, 10)
  session.lastLibraryPath = libraryPath
  await saveSession(session)
}

// ── App ──────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null
const library = new LibraryManager()
const enhance = new EnhanceService()
const isDev = !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    backgroundColor: '#000000',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    vibrancy: 'sidebar',
    backgroundMaterial: 'mica',
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  })
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
  }
}

function registerHandlers() {
  const send = (ch: string, data: any) => mainWindow?.webContents.send(ch, data)
  library.on('item:added', (e: any) => send('event:item-added', e))
  library.on('item:updated', (e: any) => send('event:item-updated', e))
  library.on('item:removed', (id: string) => send('event:item-removed', id))
  library.on('index:ready', (n: any) => send('event:index-ready', n))
  library.on('repair:progress', (p: any) => send('event:repair-progress', p))
  library.on('import:progress', (p: any) => send('event:import-progress', p))
  library.on('export:progress', (p: any) => send('event:export-progress', p))
  enhance.on('progress', (p: any) => send('event:enhance-progress', p))
  enhance.on('batch-progress', (p: any) => send('event:enhance-batch-progress', p))

  ipcMain.handle('item:export', async (_, ids, targetDir, strategy, enhancedStrategy) => library.exportItems(ids, targetDir, strategy, enhancedStrategy))
  ipcMain.handle('item:checkExportConflicts', async (_, ids, targetDir) => library.checkExportConflicts(ids, targetDir))

  ipcMain.handle('library:open', async (_, p: string) => {
    await library.open(p)
    await recordOpened(p, library.manifest.name)
    return { ok: true, info: library.manifest }
  })

  ipcMain.handle('library:create', async (_, p: string, name: string) => {
    const info = await library.create(p, name)
    await recordOpened(p, name)
    return { ok: true, info }
  })

  ipcMain.handle('library:close', async () => {
    await library.close()
    return { ok: true }
  })

  ipcMain.handle('library:info', () => ({ info: library.manifest, stats: {} }))
  ipcMain.handle('library:getSidebarCounts', () => library.getSidebarCounts())
  ipcMain.handle('library:repair', () => library.repairLibrary())
  
  ipcMain.handle('search:query', (_, q) => library.search(q))
  ipcMain.handle('search:similar', (_, id) => library.searchSimilar(id))
  
  ipcMain.handle('item:import', async (_, req) => library.import(req))
  ipcMain.handle('item:importFromUrl', async (_, url, folderId) => library.importFromUrl(url, folderId))
  ipcMain.handle('item:get', async (_, id: string) => ({ entry: library.getItem(id) }))
  ipcMain.handle('item:update', async (_, id: string, patch) => library.updateItem(id, patch))
  ipcMain.handle('item:delete', async (_, id: string) => library.deleteItem(id))
  ipcMain.handle('item:restore', async (_, id: string) => library.restoreItem(id))
  ipcMain.handle('item:purge', async (_, id: string) => library.purgeItem(id))
  ipcMain.handle('item:checkDuplicate', async (_, p: string) => library.checkDuplicate(p))

  ipcMain.handle('folder:create', async (_, n, pId) => ({ ok: true, folder: await library.createFolder(n, pId) }))
  ipcMain.handle('folder:rename', async (_, id, name) => ({ ok: true, folder: await library.updateFolder(id, { name }) }))
  ipcMain.handle('folder:update', async (_, id, patch) => ({ ok: true, folder: await library.updateFolder(id, patch) }))
  ipcMain.handle('folder:delete', async (_, id) => { await library.deleteFolder(id); return { ok: true } })
  ipcMain.handle('folder:list', () => ({ folders: library.getFolders() }))

  ipcMain.handle('library:setWatchFolder', async (_, folderId, osPath) => library.setWatchFolder(folderId, osPath))
  ipcMain.handle('library:removeWatchFolder', async (_, folderId) => library.removeWatchFolder(folderId))
  ipcMain.handle('library:getWatchFolders', () => library.getWatchFolders())

  ipcMain.handle('session:get', async () => loadSession())
  ipcMain.handle('session:set-ai-models-path', async (_, p: string) => {
    const session = await loadSession()
    session.aiModelsPath = p
    await saveSession(session)
    return session
  })
  ipcMain.handle('session:removeRecent', async (_, p) => {
    const session = await loadSession()
    session.recentLibraries = session.recentLibraries.filter(lib => lib.path !== p)
    await saveSession(session)
    return session
  })
  
  // AI Enhancement
  ipcMain.handle('enhance:getModels', async (_, modelsPath: string) => {
    return enhance.getAvailableModels(modelsPath)
  })
  ipcMain.handle('enhance:start', async (_, options) => {
    const meta = await enhance.enhance(options)
    // Auto-sync resolution to DB
    if (options.id) {
      await library.updateItem(options.id, { 
        width: meta.width, 
        height: meta.height, 
        size: meta.size 
      })
    }
    return meta
  })
  ipcMain.handle('enhance:startBatch', async (_, items) => {
    const results = await enhance.enhanceBatch(items)
    // Sync all batch items to DB
    for (const res of results) {
      if (res.id) {
        await library.updateItem(res.id, { 
          width: res.width, 
          height: res.height, 
          size: res.size 
        })
      }
    }
    return results
  })
  ipcMain.handle('enhance:cancel', () => {
    enhance.cancel()
  })
  ipcMain.handle('enhance:delete', async (_, infoPath: string) => {
    const enhancedPath = path.join(infoPath, 'enhanced.png')
    try {
      await fs.unlink(enhancedPath)
      return { ok: true }
    } catch (e) {
      log.error('Failed to delete enhanced image:', e)
      return { ok: false, error: e }
    }
  })

  // Dialogs
  ipcMain.handle('dialog:openLibrary', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.handle('dialog:pickFiles', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile', 'multiSelections'] })
    return r.canceled ? [] : r.filePaths
  })
  ipcMain.handle('dialog:pickFolders', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory', 'multiSelections'] })
    return r.canceled ? [] : r.filePaths
  })
  ipcMain.handle('dialog:pickExportFolder', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.handle('dialog:checkHasLibrary', async (_, p) => {
    try {
      const items = await fs.readdir(p)
      for (const item of items) {
        if (item.toLowerCase().endsWith('.library')) {
          return path.join(p, item)
        }
        if (item === 'library.json') return p
      }
    } catch {}
    return null
  })

  ipcMain.handle('clipboard:writeFiles', (_, paths: string[]) => {
    const textList = paths.join('\n')
    clipboard.writeText(textList)
  })

  ipcMain.handle('clipboard:readImage', async () => {
    const img = clipboard.readImage()
    if (img.isEmpty()) return null
    // Write to temp file
    const tempPath = path.join(app.getPath('temp'), `clipboard_${Date.now()}.png`)
    await fs.writeFile(tempPath, img.toPNG())
    return tempPath
  })

  ipcMain.handle('shell:openPath', async (_, p: string) => {
    return shell.openPath(p)
  })

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    return shell.openExternal(url)
  })

  ipcMain.handle('file:dataUrl', async (_, filePath: string) => {
    try {
      const data = await fs.readFile(filePath)
      const mime = getMimeType(filePath)
      return `data:${mime};base64,${data.toString('base64')}`
    } catch (e) {
      log.error('file:dataUrl failed:', e)
      return null
    }
  })

  ipcMain.handle('item:startNativeDrag', (event, { filePaths, iconPath }: { filePaths: string[], iconPath?: string }) => {
    let dragIcon = nativeImage.createEmpty()
    if (iconPath) {
      try {
        dragIcon = nativeImage.createFromPath(iconPath)
        if (dragIcon.isEmpty()) {
          // Fallback to default icon if path failed to produce image
          dragIcon = nativeImage.createFromPath(path.join(__dirname, '../../renderer/dist/assets/icons/icon.png'))
        }
      } catch (e) {
        log.error('Failed to create nativeImage from path:', iconPath, e)
        dragIcon = nativeImage.createFromPath(path.join(__dirname, '../../renderer/dist/assets/icons/icon.png'))
      }
    } else {
      dragIcon = nativeImage.createFromPath(path.join(__dirname, '../../renderer/dist/assets/icons/icon.png'))
    }

    event.sender.startDrag({
      file: filePaths[0],
      icon: dragIcon
    })
  })

  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())

  ipcMain.handle('window:set-theme', (_, themeId: string) => {
    if (themeId === 'auto') {
      nativeTheme.themeSource = 'system'
    } else {
      nativeTheme.themeSource = themeId.startsWith('dark') ? 'dark' : 'light'
    }
  })

  ipcMain.handle('web:getMetadata', async (_, url: string) => {
    try {
      const response = await net.fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!response.ok) return null
      const html = await response.text()
      
      const titleMatch = html.match(/<title>(.*?)<\/title>/i)
      const ogImageMatch = html.match(/<meta property="og:image" content="(.*?)"/i) || html.match(/<meta name="twitter:image" content="(.*?)"/i)
      const ogDescMatch = html.match(/<meta property="og:description" content="(.*?)"/i) || html.match(/<meta name="description" content="(.*?)"/i)
      
      let previewUrl = ogImageMatch ? ogImageMatch[1] : null
      
      // Fallback to screenshot service if no OG image
      if (!previewUrl) {
        previewUrl = `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=600`
      }

      return {
        title: titleMatch ? titleMatch[1] : null,
        description: ogDescMatch ? ogDescMatch[1] : null,
        previewUrl
      }
    } catch (e) {
      log.error('Failed to get web metadata:', e)
      return null
    }
  })
}


// Must be called before app is ready to allow video streaming and bypass CSP
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, supportFetchAPI: true, stream: true } }
])
app.whenReady().then(() => {
  protocol.handle('media', async (req) => {
    const url = new URL(req.url)
    // url.pathname for media://local/C:/path will be "/C:/path"
    // However, if we used media://local/${encodeURIComponent(path)}, 
    // it might be "/local/C%3A%2Fpath" or similar depending on the URL constructor.
    
    let filePath = decodeURIComponent(url.pathname)
    if (filePath.startsWith('/local/')) {
      filePath = filePath.slice('/local/'.length)
    }

    // On Windows, the pathname might still have a leading slash if not removed by the slice
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.slice(1)
    }

    // Prefer enhanced.png if it exists in the same folder
    const forceOriginal = url.searchParams.get('original') === '1'
    const dir = path.dirname(filePath)
    const enhancedPath = path.join(dir, 'enhanced.png')
    let finalPath = filePath
    if (!forceOriginal) {
      try {
        await fs.access(enhancedPath)
        finalPath = enhancedPath
      } catch {}
    }

    const upscale = url.searchParams.get('upscale') === '1'

    try {
      const stats = await fs.stat(finalPath)

      // Dynamic Lanczos3 Upscaling for small images
      if (upscale && !finalPath.toLowerCase().endsWith('.mp4') && !finalPath.toLowerCase().endsWith('.webm')) {
        const image = sharp(finalPath, { failOn: 'none' })
        const meta = await image.metadata()

        // Only upscale if the largest side is under 1500px
        const maxSide = Math.max(meta.width || 0, meta.height || 0)
        if (maxSide > 0 && maxSide < 1500) {
          const buffer = await image
            .resize({ 
              width: (meta.width || 0) * 2, 
              kernel: 'lanczos3' 
            })
            .toBuffer()
          return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: { 
              'Content-Type': getMimeType(finalPath),
              'Cache-Control': 'public, max-age=3600'
            }
          })
        }
      }

      const fileSize = stats.size
      const range = req.headers.get('range')
      const headers: Record<string, string> = {
        'Content-Type': getMimeType(finalPath),
        'Cache-Control': 'public, max-age=3600'
      }

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-")
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunksize = (end - start) + 1

        const stream = (await import('fs')).createReadStream(finalPath, { start, end })
        
        return new Response(stream as any, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            ...headers,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize.toString(),
          }
        })
      } else {
        const stream = (await import('fs')).createReadStream(finalPath)
        return new Response(stream as any, {
          status: 200,
          headers: {
            ...headers,
            'Content-Length': fileSize.toString(),
          }
        })
      }
    } catch (e) {
      log.error('Protocol error:', e)
      return new Response('File not found', { status: 404 })
    }
  })
  createWindow(); registerHandlers()
})

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mimes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  }
  return mimes[ext] || 'application/octet-stream'
}
