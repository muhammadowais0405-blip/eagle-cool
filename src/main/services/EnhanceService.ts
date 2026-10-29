import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs/promises'
import { EventEmitter } from 'events'
import log from 'electron-log'

export class EnhanceService extends EventEmitter {
  private currentProcess: any = null

  async getAvailableModels(modelsPath: string): Promise<string[]> {
    try {
      const files = await fs.readdir(modelsPath)
      // realesrgan-ncnn-vulkan models are usually .param and .bin pairs.
      // We list the .param files without extension.
      return files
        .filter(f => f.endsWith('.param'))
        .map(f => f.replace('.param', ''))
    } catch (e) {
      log.error('Failed to list models:', e)
      return []
    }
  }

  async enhance(options: {
    inputPath: string,
    outputPath: string,
    modelsPath: string,
    modelName: string,
    scale?: number,
    sharpen?: boolean,
    colorBoost?: boolean,
    tileSize?: number
  }): Promise<{ width: number, height: number, size: number }> {
    if (this.currentProcess) {
      throw new Error('Enhancement already in progress')
    }

    const binaryName = process.platform === 'win32' ? 'realesrgan-ncnn-vulkan.exe' : 'realesrgan-ncnn-vulkan'
    
    let binaryPath = path.join(options.modelsPath, binaryName)
    try {
      await fs.access(binaryPath)
    } catch {
      const parentBinaryPath = path.join(path.dirname(options.modelsPath), binaryName)
      try {
        await fs.access(parentBinaryPath)
        binaryPath = parentBinaryPath
      } catch {
        throw new Error(`Upscaler binary not found. Please ensure ${binaryName} is in the models folder or its parent folder.`)
      }
    }

    const tempOutputPath = options.outputPath + '.tmp.png'

    return new Promise((resolve, reject) => {
      // realesrgan-ncnn-vulkan args
      const args = [
        '-i', options.inputPath,
        '-o', tempOutputPath,
        '-m', options.modelsPath,
        '-n', options.modelName,
        '-s', '4'
      ]

      if (options.tileSize) {
        args.push('-t', options.tileSize.toString())
      }
      
      log.info('Executing AI Upscale (4x):', binaryPath, args.join(' '))
      this.currentProcess = spawn(binaryPath, args)

      this.currentProcess.stderr.on('data', (data: Buffer) => {
        const line = data.toString()
        const match = line.match(/(\d+\.\d+)%/)
        if (match) {
          const progress = parseFloat(match[1])
          this.emit('progress', progress * 0.85)
        }
      })

      this.currentProcess.on('close', async (code: number) => {
        this.currentProcess = null
        if (code !== 0) {
          return reject(new Error(`Enhancement failed with code ${code}`))
        }

        try {
          this.emit('progress', 90)
          const sharp = (await import('sharp')).default
          const metadataOrig = await sharp(options.inputPath).metadata()
          const scale = options.scale || 4
          const targetW = Math.round((metadataOrig.width || 0) * scale)
          
          let pipeline = sharp(tempOutputPath)
          
          if (scale !== 4) {
            pipeline = pipeline.resize({ width: targetW, kernel: 'lanczos3' })
          }

          if (options.sharpen) {
            pipeline = pipeline.sharpen({ sigma: 1, m1: 2, m2: 20 })
          }

          if (options.colorBoost) {
            pipeline = pipeline.modulate({ saturation: 1.1, brightness: 1.02 }).convolve({
              width: 3, height: 3,
              kernel: [0, 0, 0, 0, 1.1, 0, 0, 0, 0]
            })
          }

          log.info(`Applying post-processing (scale=${scale})...`)
          await pipeline.toFile(options.outputPath)
          
          await fs.unlink(tempOutputPath)
          
          // Get final metadata for database sync
          const finalMeta = await sharp(options.outputPath).metadata()
          const stats = await fs.stat(options.outputPath)
          
          this.emit('progress', 100)
          resolve({
            width: finalMeta.width || 0,
            height: finalMeta.height || 0,
            size: stats.size
          })
        } catch (e) {
          reject(e)
        }
      })

      this.currentProcess.on('error', (err: Error) => {
        this.currentProcess = null
        reject(err)
      })
    })
  }

  async enhanceBatch(items: Array<{
    inputPath: string,
    outputPath: string,
    modelsPath: string,
    modelName: string,
    scale?: number,
    sharpen?: boolean,
    colorBoost?: boolean,
    tileSize?: number
  }>): Promise<Array<{ id: string, width: number, height: number, size: number }>> {
    if (this.currentProcess) throw new Error('Enhancement already in progress')
    
    const results: any[] = []
    const total = items.length
    for (let i = 0; i < total; i++) {
      const item = items[i]
      
      const onProgress = (p: number) => {
        const globalProgress = ((i) / total * 100) + (p / total)
        this.emit('batch-progress', {
          current: i + 1,
          total,
          percent: globalProgress,
          itemPercent: p
        })
      }

      this.on('progress', onProgress)
      try {
        const meta = await this.enhance(item)
        results.push({ ...meta, id: (item as any).id })
      } finally {
        this.off('progress', onProgress)
      }
    }
    return results
  }

  cancel() {
    if (this.currentProcess) {
      this.currentProcess.kill()
      this.currentProcess = null
    }
  }
}
