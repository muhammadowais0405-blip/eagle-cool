import { parentPort, workerData } from 'worker_threads'
import * as path from 'path'
import * as fs from 'fs/promises'
import sharp from 'sharp'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'

const ffmpegPath = ffmpegInstaller.path.replace('app.asar', 'app.asar.unpacked')
const ffprobePath = ffprobeInstaller.path.replace('app.asar', 'app.asar.unpacked')

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

async function processThumbnail(entry: any) {
  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'jfif', 'webp', 'bmp', 'tiff', 'avif', 'pdf', 'ai', 'psd'])
  const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'mpeg', 'mpg', 'm4v'])
  const ext = entry.ext.toLowerCase()

  let thumbnailPath: string | undefined
  let previewPath: string | undefined
  let spritePath: string | undefined

  if (IMAGE_EXTS.has(ext)) {
    thumbnailPath = path.join(entry.infoPath, 'thumbnail.webp')
    const input = (ext === 'pdf' || ext === 'ai' || ext === 'psd') ? `${entry.contentPath}[0]` : entry.contentPath
    
    const sharpInstance = sharp(input, { failOn: 'none' })
    const meta = await sharpInstance.metadata()
    
    await sharpInstance
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbnailPath)

    if ((meta.width && meta.width > 2000) || (meta.height && meta.height > 2000)) {
      previewPath = path.join(entry.infoPath, 'preview.webp')
      await sharp(input, { failOn: 'none' })
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(previewPath)
    }
    return { 
      status: 'completed',
      thumbnailPath, 
      previewPath, 
      spritePath,
      width: meta.width || 0,
      height: meta.height || 0
    }
  } else if (VIDEO_EXTS.has(ext)) {
    const tmpPng = path.join(entry.infoPath, 'thumbnail_tmp.png')
    thumbnailPath = path.join(entry.infoPath, 'thumbnail.webp')

    const metadata: any = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`ffprobe timed out for ${entry.contentPath}`))
      }, 15000)

      ffmpeg.ffprobe(entry.contentPath, (err, data) => {
        clearTimeout(timeoutId)
        if (err) reject(err)
        else resolve(data)
      })
    })

    const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video')
    const width = videoStream?.width || 0
    const height = videoStream?.height || 0
    const duration = metadata.format.duration || 0

    if (!videoStream) {
      throw new Error(`No video stream found in: ${path.basename(entry.contentPath)}`)
    }

    // Try multiple seek strategies - different MP4 files fail at different timestamps
    // (B-frames, missing keyframes, codec-specific seek behaviour, etc.)
    const seekAttempts = [
      Math.max(0, duration * 0.1),  // 10% in
      Math.max(0, duration * 0.5),  // 50% in
      1,                            // 1 second
      0,                            // very first frame
    ].filter((t, i, a) => a.indexOf(t) === i && (duration === 0 || t <= duration))

    let screenshotOk = false
    let lastError: Error | null = null
    for (const ts of seekAttempts) {
      try {
        // Remove stale tmp file from previous attempts
        await fs.unlink(tmpPng).catch(() => {})

        await new Promise<void>((resolve, reject) => {
          const cmd = ffmpeg(entry.contentPath)
            .seekInput(ts)
            .frames(1)
            .outputOptions(['-f', 'image2']) // ensure image2 muxer
            .output(tmpPng)
            
          const timeoutId = setTimeout(() => {
            try { cmd.kill('SIGKILL') } catch (e) {}
            reject(new Error(`Thumbnail extraction timed out at ts=${ts}`))
          }, 15000) // 15 seconds timeout per seek attempt

          cmd
            .on('end', () => {
              clearTimeout(timeoutId)
              resolve()
            })
            .on('error', (err: Error) => {
              clearTimeout(timeoutId)
              reject(err)
            })
            .run()
        })

        if (await fs.stat(tmpPng).then(s => s.size > 0).catch(() => false)) {
          try {
            await sharp(tmpPng).metadata() // verify image is valid
            screenshotOk = true
            break
          } catch (e: any) {
            lastError = e instanceof Error ? e : new Error(String(e))
          }
        }
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err))
        // try next timestamp
      }
    }

    if (!screenshotOk) {
      // Fallback: Generate a generic placeholder instead of throwing to prevent the whole item from failing
      await sharp({
        create: {
          width: 400,
          height: 400,
          channels: 4,
          background: { r: 50, g: 50, b: 50, alpha: 1 }
        }
      })
        .webp({ quality: 80 })
        .toFile(thumbnailPath)
        
      console.warn(`Failed to extract frame from video: ${path.basename(entry.contentPath)}, using fallback. Error: ${lastError?.message}`)
      
      return { 
        status: 'completed',
        thumbnailPath, 
        previewPath: undefined, 
        spritePath: undefined,
        width,
        height,
        duration,
        warning: 'Fallback thumbnail generated due to extraction failure'
      }
    }

    await sharp(tmpPng)
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbnailPath)
    await fs.unlink(tmpPng).catch(() => {})


    // Sprite generation
    spritePath = path.join(entry.infoPath, 'sprite.webp')
    const maxFrames = 10
    const interval = Math.max(duration / maxFrames, 1)

    try {
      const extractedFrames: string[] = []
      
      // 1. Target fast seeking for individual frames (sequential to prevent high I/O or memory spikes)
      for (let idx = 0; idx < maxFrames; idx++) {
        const ts = idx * interval
        if (ts > duration) break
        
        const tmpFramePath = path.join(entry.infoPath, `sprite_frame_${idx}.png`)
        try {
          await new Promise<void>((resolve, reject) => {
            const cmd = ffmpeg(entry.contentPath)
              .seekInput(ts)
              .frames(1)
              .outputOptions(['-f', 'image2'])
              .output(tmpFramePath)

            const timeoutId = setTimeout(() => {
              try { cmd.kill('SIGKILL') } catch (e) {}
              reject(new Error(`Sprite frame extraction timed out at ts=${ts}`))
            }, 10000) // 10s timeout per frame

            cmd
              .on('end', () => {
                clearTimeout(timeoutId)
                resolve()
              })
              .on('error', (err: Error) => {
                clearTimeout(timeoutId)
                reject(err)
              })
              .run()
          })

          if (await fs.access(tmpFramePath).then(() => true).catch(() => false)) {
             extractedFrames.push(tmpFramePath)
          }
        } catch (err) {
          // Ignore error for individual frame, just skip
          await fs.unlink(tmpFramePath).catch(() => {})
        }
      }

      if (extractedFrames.length > 0) {
        // 2. Stitch frames together using Sharp
        const targetWidth = 240
        const targetHeight = (width && height) ? Math.round((height / width) * targetWidth) : 135
        const totalWidth = targetWidth * extractedFrames.length
        
        const resizedBuffers = await Promise.all(extractedFrames.map(p => 
          sharp(p).resize(targetWidth, targetHeight).toBuffer()
        ))

        await sharp({
          create: {
            width: totalWidth,
            height: targetHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          }
        })
        .composite(resizedBuffers.map((buffer, idx) => ({
          input: buffer,
          left: idx * targetWidth,
          top: 0
        })))
        .webp({ quality: 75, effort: 4 })
        .toFile(spritePath)
      } else {
        spritePath = undefined
      }

      // Cleanup temp frames
      for (const p of extractedFrames) {
         await fs.unlink(p).catch(() => {})
      }
    } catch (err) {
      spritePath = undefined
    }

    return { 
      status: 'completed',
      thumbnailPath, 
      previewPath, 
      spritePath,
      width,
      height,
      duration
    }
  }
  return { status: 'completed' }
}

async function calculatePhash(filePath: string) {
  const imghash = await import('imghash')
  return await imghash.default.hash(filePath)
}

if (parentPort) {
  const { type, payload } = workerData
  if (type === 'thumbnail') {
    processThumbnail(payload).then(res => parentPort!.postMessage(res)).catch(err => parentPort!.postMessage({ status: 'failed', error: err.message }))
  } else if (type === 'phash') {
    calculatePhash(payload).then(res => parentPort!.postMessage(res)).catch(() => parentPort!.postMessage(null))
  }
}
