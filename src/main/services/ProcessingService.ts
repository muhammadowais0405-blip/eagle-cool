import * as path from 'path'
import { Worker } from 'worker_threads'
import { TaskQueue } from './TaskQueue'
import log from 'electron-log'
import { app } from 'electron'

export class ProcessingService {
  private queue = new TaskQueue(4)

  private runWorker(type: 'thumbnail' | 'phash', payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // In dev, the worker is at src/main/workers/thumbnail-worker.ts (transpiled to dist/main/workers/thumbnail-worker.js)
      const workerPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'app.asar', 'dist', 'main', 'workers', 'thumbnail-worker.js')
        : path.join(app.getAppPath(), 'dist', 'main', 'workers', 'thumbnail-worker.js')

      const worker = new Worker(workerPath, {
        workerData: { type, payload }
      })

      const cleanup = () => {
        worker.terminate().catch(() => {})
      }

      worker.on('message', (msg) => {
        resolve(msg)
        cleanup()
      })
      
      worker.on('error', (err) => {
        log.error('Worker error:', err)
        reject(err)
        cleanup()
      })
      
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`))
      })
    })
  }

  async generateThumbnails(entry: any): Promise<any> {
    return this.queue.add(() => this.runWorker('thumbnail', entry))
  }

  async calculatePhash(filePath: string): Promise<string | null> {
    return this.queue.add(() => this.runWorker('phash', filePath))
  }
}
