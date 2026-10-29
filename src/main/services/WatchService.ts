import * as path from 'path'
import * as fs from 'fs/promises'
import { EventEmitter } from 'events'

export interface WatchConfig {
  folderId: string;
  osPath: string;
}

export class WatchService extends EventEmitter {
  private watchers: Map<string, any> = new Map()
  private importCallback: ((srcPaths: string[], folderId: string) => Promise<any>) | null = null
  private unlinkCallback: ((filePath: string, folderId: string) => Promise<any>) | null = null
  private queues: Map<string, string[]> = new Map()
  private timers: Map<string, any> = new Map()

  setImportCallback(cb: (srcPaths: string[], folderId: string) => Promise<any>) {
    this.importCallback = cb
  }

  setUnlinkCallback(cb: (filePath: string, folderId: string) => Promise<any>) {
    this.unlinkCallback = cb
  }

  init(configs: WatchConfig[]) {
    this.stopAll()
    for (const config of configs) {
      this.addWatch(config)
    }
  }

  async addWatch(config: WatchConfig) {
    if (this.watchers.has(config.folderId)) {
      this.removeWatch(config.folderId)
    }

    try {
      const chokidar = await import('chokidar')
      const watcher = chokidar.watch(config.osPath, {
        persistent: true,
        ignoreInitial: false, // Import existing files too
        depth: 0,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        }
      })

      watcher.on('add', (filePath: string) => {
        this.enqueue(config.folderId, filePath)
      })
      watcher.on('unlink', (filePath: string) => {
        if (this.unlinkCallback) {
          this.unlinkCallback(filePath, config.folderId).catch(err => {
            console.error(`[WatchService] Failed to handle unlink for ${filePath}:`, err)
          })
        }
      })

      this.watchers.set(config.folderId, watcher)
      console.log(`[WatchService] Watching ${config.osPath} -> ${config.folderId}`)
    } catch (err) {
      console.error(`[WatchService] Failed to initialize watcher for ${config.osPath}:`, err)
    }
  }

  private enqueue(folderId: string, filePath: string) {
    if (!this.queues.has(folderId)) this.queues.set(folderId, [])
    const queue = this.queues.get(folderId)!
    if (!queue.includes(filePath)) queue.push(filePath)

    if (this.timers.has(folderId)) clearTimeout(this.timers.get(folderId))
    this.timers.set(folderId, setTimeout(() => this.processQueue(folderId), 1000))
  }

  private async processQueue(folderId: string) {
    const queue = this.queues.get(folderId) || []
    if (queue.length === 0) return
    this.queues.set(folderId, [])
    this.timers.delete(folderId)

    if (this.importCallback) {
      console.log(`[WatchService] Processing batch of ${queue.length} files for folder ${folderId}`)
      try {
        await this.importCallback(queue, folderId)
      } catch (err) {
        console.error(`[WatchService] Failed to batch import:`, err)
      }
    }
  }

  removeWatch(folderId: string) {
    const watcher = this.watchers.get(folderId)
    if (watcher) {
      watcher.close()
      this.watchers.delete(folderId)
      if (this.timers.has(folderId)) {
        clearTimeout(this.timers.get(folderId))
        this.timers.delete(folderId)
      }
      this.queues.delete(folderId)
      console.log(`[WatchService] Stopped watching for folder ${folderId}`)
    }
  }

  stopAll() {
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
    this.queues.clear()
  }
}
