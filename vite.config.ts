import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import electron from 'vite-plugin-electron'

export default defineConfig({
  root: 'src/renderer',
  plugins: [
    vue(),
    electron([
      {
        entry: path.resolve(__dirname, 'src/main/main.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist/main'),
            rollupOptions: {
              external: ['sharp', 'fluent-ffmpeg', '@ffmpeg-installer/ffmpeg', '@ffprobe-installer/ffprobe', 'chokidar', 'imghash', 'better-sqlite3'],
            },
          },
        },
      },
      {
        entry: path.resolve(__dirname, 'src/main/workers/thumbnail-worker.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist/main/workers'),
            rollupOptions: {
              external: ['sharp', 'fluent-ffmpeg', '@ffmpeg-installer/ffmpeg', '@ffprobe-installer/ffprobe', 'imghash'],
            },
          },
        },
      },
      {
        entry: path.resolve(__dirname, 'src/preload/preload.ts'),
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist/preload'),
          },
        },
      },
    ]),
  ],
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
})
