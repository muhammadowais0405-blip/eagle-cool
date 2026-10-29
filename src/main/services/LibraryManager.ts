import { EventEmitter } from 'events'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as crypto from 'crypto'
import * as os from 'os'
import { DatabaseService } from './DatabaseService'
import { ProcessingService } from './ProcessingService'
import { WatchService, WatchConfig } from './WatchService'
import log from 'electron-log'
import MiniSearch from 'minisearch'

const SUPPORTED = new Set([
  'png', 'jpg', 'jpeg', 'jfif', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'ico', 'avif',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'mpeg', 'mpg', 'pdf', 'ai', 'psd', 'sketch',
])

function generateId(): string {
  return 'c' + Date.now().toString(36) + crypto.randomBytes(10).toString('hex')
}

function getOrientation(w: number, h: number): 'square' | 'landscape' | 'portrait' {
  if (w === h) return 'square'
  return w > h ? 'landscape' : 'portrait'
}

export class LibraryManager extends EventEmitter {
  libraryRoot: string | null = null
  manifest: any = null
  db: DatabaseService = new DatabaseService()
  processor: ProcessingService = new ProcessingService()
  watchService: WatchService = new WatchService()
  private miniSearch: MiniSearch = new MiniSearch({
    fields: ['name', 'annotation', 'tags'],
    storeFields: ['id'],
    searchOptions: { fuzzy: 0.2, prefix: true }
  })

  constructor() {
    super()
    this.watchService.setImportCallback((paths, folderId) => {
      return this.import({ sourcePaths: paths, targetFolderId: folderId, link: true })
    })
    this.watchService.setUnlinkCallback(async (filePath, folderId) => {
      const items = this.db.getValues()
      const target = items.find(i => i.externalPath === filePath && i.folders.includes(folderId))
      if (target) {
        await this.purgeItem(target.id)
      }
    })
  }

  async open(libraryPath: string) {
    this.libraryRoot = libraryPath
    let forceFolderSync = false

    try {
      const raw = await fs.readFile(path.join(libraryPath, 'library.json'), 'utf8')
      this.manifest = JSON.parse(raw)
      if (!this.manifest.folders || this.manifest.folders.length === 0) forceFolderSync = true
    } catch (err: any) {
      if (err.code === 'ENOENT') forceFolderSync = true
      else throw err
    }

    if (forceFolderSync) {
      try {
        const eagleMetaPath = path.join(libraryPath, 'metadata.json')
        const eagleMeta = JSON.parse(await fs.readFile(eagleMetaPath, 'utf8'))
        const flatFolders: any[] = []
        const flatten = (folders: any[], parentId: string | null = null) => {
          for (const f of folders) {
            flatFolders.push({ id: f.id, name: f.name, parentId, createdAt: f.modificationTime || Date.now() })
            if (f.children?.length > 0) flatten(f.children, f.id)
          }
        }
        if (eagleMeta.folders) flatten(eagleMeta.folders)
        this.manifest = { ...this.manifest, name: eagleMeta.name || path.basename(libraryPath), folders: flatFolders, tags: [], itemCount: 0 }
      } catch (e) { if (!this.manifest) throw new Error('Invalid library folder') }
    }

    await this.db.init(libraryPath)
    const count = this.db.getAllNonDeletedCount()
    
    // If empty DB, start sync in background
    if (count === 0) {
      setImmediate(async () => {
        try {
          log.info('Background sync starting...')
          await this.syncDiskToDb(libraryPath)
          const finalCount = this.db.getAllNonDeletedCount()
          
          // Re-init search index
          const allItems = this.db.getValues()
          this.miniSearch.removeAll()
          this.miniSearch.addAll(allItems.map(i => ({ id: i.id, name: i.name, annotation: i.annotation || '', tags: (i.tags || []).join(' ') })))
          
          this.emit('index:ready', finalCount)
          log.info('Background sync complete. Items:', finalCount)
        } catch (e) {
          log.error('Background sync failed:', e)
        }
      })
    } else {
      const allItems = this.db.getValues()
      this.miniSearch.removeAll()
      this.miniSearch.addAll(allItems.map(i => ({ id: i.id, name: i.name, annotation: i.annotation || '', tags: (i.tags || []).join(' ') })))
      this.emit('index:ready', count)
    }

    this.manifest.lastOpenedAt = Date.now()
    await this.writeManifest(libraryPath, this.manifest)
    if (this.manifest.watchFolders) this.watchService.init(this.manifest.watchFolders)
  }

  private async syncDiskToDb(libraryPath: string) {
    const imagesPath = path.join(libraryPath, 'images')
    try {
      const entries = await fs.readdir(imagesPath, { withFileTypes: true })
      const infoDirs = entries.filter(e => e.isDirectory() && e.name.endsWith('.info'))
      for (const dir of infoDirs) {
        try {
          const infoPath = path.join(imagesPath, dir.name)
          const metadata = JSON.parse(await fs.readFile(path.join(infoPath, 'metadata.json'), 'utf8'))
          const id = metadata.id
          const files = await fs.readdir(infoPath)
          const contentFile = files.find(f => f.toLowerCase().startsWith('content.')) || files.find(f => f.toLowerCase().startsWith(`${id.toLowerCase()}.`))
          const entry = { ...metadata, contentPath: metadata.externalPath || (contentFile ? path.join(infoPath, contentFile) : ''), infoPath, isDeleted: !!metadata.isDeleted }
          const thumbFiles = ['thumbnail.webp', 'thumbnail.png', `${id}_thumbnail.png`]
          for (const tf of thumbFiles) {
            const tp = path.join(infoPath, tf)
            try {
              await fs.access(tp)
              entry.thumbnailPath = tp
              entry.thumbnailFile = tf
              entry.thumbnailStatus = 'completed'
              break
            } catch {}
          }
          if (!entry.thumbnailStatus) entry.thumbnailStatus = 'pending'
          this.db.set(id, entry)
        } catch {}
      }
    } catch {}
  }

  async create(libraryPath: string, name: string) {
    await fs.mkdir(path.join(libraryPath, 'images'), { recursive: true })
    this.manifest = { version: '1.0.0', name, createdAt: Date.now(), lastOpenedAt: Date.now(), folders: [], tags: [], itemCount: 0 }
    await this.writeManifest(libraryPath, this.manifest)
    this.libraryRoot = libraryPath
    await this.db.init(libraryPath)
    this.miniSearch.removeAll()
    this.emit('index:ready', 0)
    return this.manifest
  }

  async setWatchFolder(folderId: string, osPath: string) {
    if (!this.manifest) return
    this.manifest.watchFolders = (this.manifest.watchFolders || []).filter((f: any) => f.folderId !== folderId)
    this.manifest.watchFolders.push({ folderId, osPath })
    await this.writeManifest(this.libraryRoot!, this.manifest)
    this.watchService.addWatch({ folderId, osPath })
  }

  async removeWatchFolder(folderId: string) {
    if (!this.manifest?.watchFolders) return
    const watchFolder = this.manifest.watchFolders.find((f: any) => f.folderId === folderId)
    if (!watchFolder) return

    this.manifest.watchFolders = this.manifest.watchFolders.filter((f: any) => f.folderId !== folderId)
    await this.writeManifest(this.libraryRoot!, this.manifest)
    this.watchService.removeWatch(folderId)

    // Purge linked items
    const items = this.db.getValues()
    const linkedItems = items.filter(i => i.externalPath && i.folders.includes(folderId) && i.externalPath.startsWith(watchFolder.osPath))
    for (const item of linkedItems) {
      await this.purgeItem(item.id)
    }
  }

  getWatchFolders() { return this.manifest?.watchFolders ?? [] }

  async import(request: any) {
    const succeeded: any[] = [], failed: any[] = []
    const collectPaths = async (p: string, paths: string[]) => {
      const s = await fs.stat(p)
      if (s.isDirectory() && request.recursive) {
        for (const entry of await fs.readdir(p)) await collectPaths(path.join(p, entry), paths)
      } else if (!s.isDirectory()) paths.push(p)
    }
    const allPaths: string[] = []
    for (const p of request.sourcePaths) await collectPaths(p, allPaths)

    const total = allPaths.length
    for (let i = 0; i < total; i++) {
      const srcPath = allPaths[i]
      this.emit('import:progress', { done: i, total, current: path.basename(srcPath) })
      try {
        const ext = path.extname(srcPath).replace('.', '').toLowerCase()
        if (!SUPPORTED.has(ext)) throw new Error('Unsupported')
        const id = generateId(), infoPath = path.join(this.libraryRoot!, 'images', `${id}.info`)
        let contentPath = ''
        let size = 0, mtimeMs = Date.now()
        await fs.mkdir(infoPath, { recursive: true })
        if (request.link) {
          contentPath = srcPath
          const stat = await fs.stat(srcPath)
          size = stat.size
          mtimeMs = stat.mtimeMs
        } else {
          contentPath = path.join(infoPath, `content.${ext}`)
          if (request.move) await fs.rename(srcPath, contentPath); else await fs.copyFile(srcPath, contentPath)
          const stat = await fs.stat(contentPath)
          size = stat.size
          mtimeMs = stat.mtimeMs
        }
        const metadata: any = { id, name: path.basename(srcPath), ext, size, width: 0, height: 0, orientation: 'square', duration: 0, importTime: Date.now(), lastModified: mtimeMs, tags: [], folders: request.targetFolderId ? [request.targetFolderId] : [], isDeleted: false, thumbnailStatus: 'pending' }
        if (request.link) metadata.externalPath = srcPath
        await fs.writeFile(path.join(infoPath, 'metadata.json'), JSON.stringify(metadata, null, 2))
        const entry = { ...metadata, contentPath, infoPath }
        this.db.set(id, entry)
        this.miniSearch.add({ id, name: metadata.name, annotation: '', tags: '' })
        this.emit('item:added', entry)
        succeeded.push({ id, name: metadata.name })
        
        // Start processing (Thumbnail + PHash)
        this.processor.generateThumbnails(entry).then(async res => {
          // Verify the worker actually produced a thumbnail file
          const ok = res.thumbnailPath && await fs.access(res.thumbnailPath).then(() => true).catch(() => false)
          if (!ok) {
            log.warn(`Worker reported success but thumb missing for ${id}: ${res.thumbnailPath}`)
            return this.updateItem(id, {
              thumbnailStatus: 'failed',
              thumbnailError: 'Worker did not produce thumbnail file'
            })
          }
          this.updateItem(id, {
            thumbnailPath: res.thumbnailPath,
            thumbnailStatus: res.status,
            width: res.width || 0,
            height: res.height || 0
          })
        }).catch((err) => {
          log.warn(`Thumbnail generation failed for ${id}:`, err?.message || err)
          this.updateItem(id, {
            thumbnailStatus: 'failed',
            thumbnailError: err?.message || 'Unknown error'
          })
        })


        if (['png', 'jpg', 'jpeg', 'jfif', 'webp', 'bmp'].includes(ext)) {
          this.processor.calculatePhash(contentPath).then(phash => {
            if (phash) this.updateItem(id, { phash })
          }).catch(() => {})
        }

      } catch (e: any) { failed.push({ path: srcPath, reason: e.message }) }
    }
    this.emit('import:progress', { done: total, total, current: 'Done' })
    return { succeeded, failed }
  }

  async importFromUrl(url: string, folderId?: string) {
    if (!this.libraryRoot) return { ok: false, reason: 'No library open' }
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`)
      const buffer = Buffer.from(await response.arrayBuffer())
      
      const ext = (path.extname(new URL(url).pathname).replace('.', '') || 'png').toLowerCase()
      const id = generateId(), infoPath = path.join(this.libraryRoot, 'images', `${id}.info`)
      const contentPath = path.join(infoPath, `content.${ext}`)
      
      await fs.mkdir(infoPath, { recursive: true })
      await fs.writeFile(contentPath, buffer)
      
      const stat = await fs.stat(contentPath)
      const metadata = { 
        id, name: path.basename(new URL(url).pathname) || 'downloaded', 
        ext, size: stat.size, width: 0, height: 0, orientation: 'square', duration: 0, 
        importTime: Date.now(), lastModified: Date.now(), tags: [], 
        folders: folderId ? [folderId] : [], isDeleted: false, thumbnailStatus: 'pending',
        url
      }
      
      await fs.writeFile(path.join(infoPath, 'metadata.json'), JSON.stringify(metadata, null, 2))
      const entry = { ...metadata, contentPath, infoPath }
      this.db.set(id, entry)
      this.miniSearch.add({ id, name: metadata.name, annotation: '', tags: '' })
      this.emit('item:added', entry)
      
      this.processor.generateThumbnails(entry).then(async res => {
        const ok = res.thumbnailPath && await fs.access(res.thumbnailPath).then(() => true).catch(() => false)
        if (!ok) {
          log.warn(`Worker reported success but thumb missing for ${id}: ${res.thumbnailPath}`)
          return this.updateItem(id, {
            thumbnailStatus: 'failed',
            thumbnailError: 'Worker did not produce thumbnail file'
          })
        }
        this.updateItem(id, {
          thumbnailPath: res.thumbnailPath,
          thumbnailStatus: res.status,
          width: res.width || 0,
          height: res.height || 0
        })
      }).catch((err) => {
        log.warn(`Thumbnail generation failed for ${id}:`, err?.message || err)
        this.updateItem(id, {
          thumbnailStatus: 'failed',
          thumbnailError: err?.message || 'Unknown error'
        })
      })


      if (['png', 'jpg', 'jpeg', 'jfif', 'webp', 'bmp'].includes(ext)) {
        this.processor.calculatePhash(contentPath).then(phash => {
          if (phash) this.updateItem(id, { phash })
        }).catch(() => {})
      }
      
      return { ok: true, id }
    } catch (e: any) {
      log.error('URL import failed:', e)
      throw e
    }
  }

  async checkDuplicate(p: string) {
    try {
      const stat = await fs.stat(p)
      const potential = this.db.findBySize(stat.size)
      if (potential.length === 0) return null

      // If we have files with the same size, we must compare hashes
      const computeHash = async (filePath: string) => {
        const buffer = await fs.readFile(filePath)
        return crypto.createHash('md5').update(buffer).digest('hex')
      }

      const targetHash = await computeHash(p)
      for (const entry of potential) {
        const entryHash = await computeHash(entry.contentPath)
        if (entryHash === targetHash) return entry
      }

      return null
    } catch (e) {
      log.error('checkDuplicate failed:', e)
      return null
    }
  }

  async searchSimilar(id: string) {
    const entry = this.db.get(id)
    if (!entry || !entry.phash) return { items: [], total: 0 }
    
    const all = this.db.getAllPhashes()
    const matches = all
      .map(item => ({ id: item.id, dist: this.getHammingDistance(entry.phash, item.phash) }))
      .filter(m => m.dist < 10)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 50)
      
    const items = matches.map(m => this.db.get(m.id)).filter(Boolean)
    return { items, total: items.length }
  }

  async repairLibrary() {
    if (!this.libraryRoot) return { ghostsRemoved: 0, orphansRecovered: 0, itemsSynced: 0 }
    log.info('Starting library repair at:', this.libraryRoot)
    const all = this.db.getValues(), total = all.length
    let ghostCount = 0, orphanedCount = 0, syncCount = 0
    
    // 1. Validate existing items
    for (let i = 0; i < total; i++) {
      const entry = all[i]
      if (i % 10 === 0 || i === total - 1) {
        this.emit('repair:progress', { done: i + 1, total: total + 1, current: `Checking ${entry.name}...` })
      }
      
      // Check if metadata.json exists
      const metadataPath = path.join(entry.infoPath, 'metadata.json')
      let diskMeta: any = null
      try {
        const raw = await fs.readFile(metadataPath, 'utf8')
        diskMeta = JSON.parse(raw)
      } catch (err) {
        log.warn(`Ghost item found (missing or invalid metadata): ${entry.id} (${entry.name})`)
        this.db.delete(entry.id)
        if (this.miniSearch.has(entry.id)) this.miniSearch.remove({ id: entry.id })
        this.emit('item:removed', entry.id)
        ghostCount++
        continue
      }
      
      try {
        // Sync metadata if changed
        const needsSync = 
          diskMeta.name !== entry.name || 
          JSON.stringify(diskMeta.tags) !== JSON.stringify(entry.tags) ||
          JSON.stringify(diskMeta.folders) !== JSON.stringify(entry.folders) ||
          diskMeta.isDeleted !== entry.isDeleted
          
        if (needsSync) {
          const synced = { ...entry, ...diskMeta }
          // Use direct db.set to avoid writing back to disk immediately if we just read it
          this.db.set(entry.id, synced)
          if (this.miniSearch.has(entry.id)) {
            this.miniSearch.replace({ id: synced.id, name: synced.name, annotation: synced.annotation || '', tags: (synced.tags || []).join(' ') })
          }
          this.emit('item:updated', synced)
          syncCount++
        }
        
        // Check content file
        const contentExists = await fs.access(entry.contentPath).then(() => true).catch(() => false)
        if (!contentExists) {
          const files = await fs.readdir(entry.infoPath)
          const found = files.find(f => f.toLowerCase().startsWith('content.'))
          if (found) {
            const newPath = path.join(entry.infoPath, found)
            await this.updateItem(entry.id, { contentPath: newPath })
          } else {
            await this.updateItem(entry.id, { thumbnailStatus: 'failed', thumbnailError: 'Content file missing' })
          }
        }
        
        // Check thumbnail
        if (entry.thumbnailStatus === 'failed' || !entry.thumbnailStatus || (entry.thumbnailStatus === 'pending' && !entry.thumbnailPath) || (entry.thumbnailStatus === 'completed' && entry.thumbnailPath && !(await fs.access(entry.thumbnailPath).then(() => true).catch(() => false)))) {
          log.info(`Thumbnail missing or failed for ${entry.id}, re-queueing...`)
          const patch = { thumbnailStatus: 'pending', thumbnailPath: null, thumbnailFile: null }
          await this.updateItem(entry.id, patch)
          this.processor.generateThumbnails({ ...entry, ...patch }).then(async res => {
            const ok = res.thumbnailPath && await fs.access(res.thumbnailPath).then(() => true).catch(() => false)
            if (!ok) {
              log.warn(`Repair: worker reported success but thumb missing for ${entry.id}: ${res.thumbnailPath}`)
              return this.updateItem(entry.id, {
                thumbnailStatus: 'failed',
                thumbnailError: 'Worker did not produce thumbnail file'
              })
            }
            this.updateItem(entry.id, {
              thumbnailPath: res.thumbnailPath,
              thumbnailStatus: res.status,
              width: res.width || entry.width,
              height: res.height || entry.height
            })
          }).catch((err) => {
            log.warn(`Repair: thumbnail generation failed for ${entry.id}:`, err?.message || err)
            this.updateItem(entry.id, {
              thumbnailStatus: 'failed',
              thumbnailError: err?.message || 'Unknown error'
            })
          })
        }

        // Check PHash if missing for images
        if (!entry.phash && ['png', 'jpg', 'jpeg', 'jfif', 'webp', 'bmp'].includes(entry.ext)) {
          this.processor.calculatePhash(entry.contentPath).then(phash => {
            if (phash) this.updateItem(entry.id, { phash })
          }).catch(() => {})
        }
      } catch (err) {
        log.error(`Error repairing item ${entry.id}:`, err)
      }
    }
    
    // 2. Recover orphans
    this.emit('repair:progress', { done: total, total: total + 1, current: 'Searching for orphaned files...' })
    const imagesPath = path.join(this.libraryRoot, 'images')
    try {
      await fs.access(imagesPath)
      const dirs = await fs.readdir(imagesPath, { withFileTypes: true })
      for (const dir of dirs) {
        if (!dir.isDirectory() || !dir.name.endsWith('.info')) continue
        
        const id = dir.name.replace('.info', '')
        if (!this.db.has(id)) {
          try {
            const infoPath = path.join(imagesPath, dir.name)
            const meta = JSON.parse(await fs.readFile(path.join(infoPath, 'metadata.json'), 'utf8'))
            const files = await fs.readdir(infoPath)
            const contentFile = files.find(f => f.toLowerCase().startsWith('content.')) || 
                              files.find(f => f.toLowerCase().startsWith(`${id.toLowerCase()}.`))
            
            const restored = { 
              ...meta, 
              contentPath: meta.externalPath || (contentFile ? path.join(infoPath, contentFile) : ''), 
              infoPath,
              isDeleted: !!meta.isDeleted
            }
            
            const thumbFiles = ['thumbnail.webp', 'thumbnail.png', `${id}_thumbnail.png`]
            for (const tf of thumbFiles) {
              const tp = path.join(infoPath, tf)
              try {
                await fs.access(tp)
                restored.thumbnailPath = tp
                restored.thumbnailFile = tf
                restored.thumbnailStatus = 'completed'
                break
              } catch {}
            }
            if (!restored.thumbnailStatus) restored.thumbnailStatus = 'pending'
            
            this.db.set(id, restored)
            this.miniSearch.add({ id, name: meta.name, tags: (meta.tags || []).join(' ') })
            this.emit('item:added', restored)
            orphanedCount++
            log.info(`Recovered orphaned item: ${id} (${meta.name})`)
          } catch (err) {
            log.error(`Failed to recover orphan ${dir.name}:`, err)
          }
        }
      }
    } catch (err) {
      log.error('Error scanning for orphans:', err)
    }
    
    this.emit('repair:progress', null)
    log.info('Repair complete.', { ghostCount, orphanedCount, syncCount })
    return { ghostsRemoved: ghostCount, orphansRecovered: orphanedCount, itemsSynced: syncCount }
  }

  async createFolder(name: string, parentId: string | null = null) {
    if (!this.manifest) return null
    const folder = { id: generateId(), name, parentId, createdAt: Date.now() }
    this.manifest.folders.push(folder)
    await this.writeManifest(this.libraryRoot!, this.manifest)
    return folder
  }

  async updateFolder(id: string, patch: any) {
    if (!this.manifest) return null
    const folder = this.manifest.folders.find((f: any) => f.id === id)
    if (!folder) return null
    Object.assign(folder, patch)
    await this.writeManifest(this.libraryRoot!, this.manifest)
    return folder
  }

  async deleteFolder(id: string) {
    if (!this.manifest) return
    const idsToDelete = new Set([id])
    const collect = (pId: string) => {
      for (const f of this.manifest.folders) {
        if (f.parentId === pId && !idsToDelete.has(f.id)) { idsToDelete.add(f.id); collect(f.id) }
      }
    }
    collect(id)

    // Clean up watch folders if they exist
    for (const folderId of idsToDelete) {
      if (this.manifest.watchFolders?.some((f: any) => f.folderId === folderId)) {
        await this.removeWatchFolder(folderId)
      }
    }

    // Move items in these folders to trash
    const folderIds = Array.from(idsToDelete)
    const { items } = this.db.search({ folders: folderIds, limit: 1000000 })
    for (const item of items) {
      await this.updateItem(item.id, { isDeleted: 1 })
    }

    this.manifest.folders = this.manifest.folders.filter((f: any) => !idsToDelete.has(f.id))
    await this.writeManifest(this.libraryRoot!, this.manifest)
  }

  async updateItem(id: string, patch: any) {
    const entry = this.db.get(id); if (!entry) return null
    const updated = { ...entry, ...patch }; this.db.set(id, updated)
    if (this.miniSearch.has(id)) this.miniSearch.replace({ id, name: updated.name, annotation: updated.annotation || '', tags: (updated.tags || []).join(' ') })
    await fs.writeFile(path.join(entry.infoPath, 'metadata.json'), JSON.stringify(updated, null, 2)).catch(() => {})
    this.emit('item:updated', updated); return updated
  }

  async exportItems(ids: string[], targetDir: string, 
    conflictStrategy: Record<string, 'rename' | 'overwrite' | 'skip'> = {},
    enhancedStrategy: Record<string, 'original' | 'enhanced'> = {}
  ) {
    await fs.mkdir(targetDir, { recursive: true })
    const total = ids.length
    const results = { succeeded: 0, failed: 0, skipped: 0 }

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      const entry = this.db.get(id)
      if (!entry || !entry.contentPath) {
        results.failed++
        continue
      }

      this.emit('export:progress', { done: i, total, current: entry.name })

      try {
        let sourcePath = entry.contentPath
        let ext = entry.ext
        
        // Handle Enhanced Version Selection
        if (enhancedStrategy[id] === 'enhanced') {
          const enhancedPath = path.join(entry.infoPath, 'enhanced.png')
          try {
            await fs.access(enhancedPath)
            sourcePath = enhancedPath
            ext = 'png' // Enhancements are always PNG
          } catch {}
        }

        const baseName = entry.name.endsWith(`.${entry.ext}`) ? entry.name.slice(0, -(entry.ext.length + 1)) : entry.name
        let targetName = `${baseName}.${ext}`
        let targetPath = path.join(targetDir, targetName)

        const strategy = conflictStrategy[id]
        const exists = await fs.access(targetPath).then(() => true).catch(() => false)

        if (exists && !strategy) {
          throw new Error('File already exists')
        }

        if (strategy === 'skip') {
          results.skipped++
          continue
        }

        if (strategy === 'rename') {
          let counter = 1
          while (await fs.access(targetPath).then(() => true).catch(() => false)) {
            targetName = `${baseName} (${counter}).${ext}`
            targetPath = path.join(targetDir, targetName)
            counter++
          }
        }

        // Copy the file
        await fs.copyFile(sourcePath, targetPath)
        results.succeeded++
      } catch (err) {
        log.error(`Export failed for ${entry.name}:`, err)
        results.failed++
      }
    }

    this.emit('export:progress', { done: total, total, current: 'Done' })
    return results
  }

  async checkExportConflicts(ids: string[], targetDir: string) {
    const conflicts: Array<{ id: string, name: string, existingPath: string }> = []
    for (const id of ids) {
      const entry = this.db.get(id)
      if (!entry) continue
      const targetPath = path.join(targetDir, `${entry.name}${entry.name.endsWith('.' + entry.ext) ? '' : '.' + entry.ext}`)
      const exists = await fs.access(targetPath).then(() => true).catch(() => false)
      if (exists) {
        conflicts.push({ id, name: entry.name, existingPath: targetPath })
      }
    }
    return conflicts
  }
  search(query: any) {
    if (query.text) {
      const results = this.miniSearch.search(query.text)
      if (results.length > 0) query.ids = results.map(r => r.id)
    }
    return this.db.search(query)
  }
  getSidebarCounts() { return this.db.getSidebarCounts() }
  async close() { await this.db.close() }
  async deleteItem(id: string) { return this.updateItem(id, { isDeleted: true }) }
  async restoreItem(id: string) { return this.updateItem(id, { isDeleted: false }) }
  async purgeItem(id: string) {
    const entry = this.db.get(id); if (!entry) return
    await fs.rm(entry.infoPath, { recursive: true, force: true })
    this.db.delete(id); if (this.miniSearch.has(id)) this.miniSearch.remove({ id }); this.emit('item:removed', id)
  }
  getFolders() { return this.manifest?.folders ?? [] }
  getItem(id: string) { return this.db.get(id) }

  async writeManifest(root: string, manifest: any) { 
    await fs.writeFile(path.join(root, 'library.json'), JSON.stringify(manifest, null, 2)) 
  }

  private getHammingDistance(h1: string, h2: string): number {
    if (!h1 || !h2 || h1.length !== h2.length) return 999
    let dist = 0
    for (let i = 0; i < h1.length; i++) {
      let xor = parseInt(h1[i], 16) ^ parseInt(h2[i], 16)
      while (xor > 0) { dist += xor & 1; xor >>= 1 }
    }
    return dist
  }
}
