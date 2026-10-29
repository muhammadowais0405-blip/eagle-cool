import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';

export interface FileStats {
  size: number;
  lastModified: number;
  ext: string;
}

export interface MediaDimensions {
  width: number;
  height: number;
  duration: number;   // 0 for stills
}

export type Orientation = 'portrait' | 'landscape' | 'square';

// ─── File Stats ───────────────────────────────────────────────────────────────

export async function getFileStats(filePath: string): Promise<FileStats> {
  const stat = await fs.stat(filePath);
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  return {
    size: stat.size,
    lastModified: stat.mtimeMs,
    ext,
  };
}

// ─── Orientation ──────────────────────────────────────────────────────────────

export function getOrientation(width: number, height: number): Orientation {
  if (width === height) return 'square';
  return width > height ? 'landscape' : 'portrait';
}

// ─── PNG Dimensions (pure Node — reads IHDR chunk) ───────────────────────────

async function readPngDimensions(filePath: string): Promise<{ width: number; height: number }> {
  const fd = await fs.open(filePath, 'r');
  const buf = Buffer.alloc(24);
  await fd.read(buf, 0, 24, 0);
  await fd.close();
  // PNG signature = 8 bytes, IHDR chunk = 4 len + 4 type + 4 W + 4 H
  const width  = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

// ─── JPEG Dimensions (scan SOF markers) ──────────────────────────────────────

async function readJpegDimensions(filePath: string): Promise<{ width: number; height: number }> {
  const buf = await readBytes(filePath, 65536); // read up to 64 KB
  let i = 0;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    // SOF0–SOF3, SOF5–SOF7, SOF9–SOF11, SOF13–SOF15
    const isSOF = (marker >= 0xc0 && marker <= 0xc3) ||
                  (marker >= 0xc5 && marker <= 0xc7) ||
                  (marker >= 0xc9 && marker <= 0xcb) ||
                  (marker >= 0xcd && marker <= 0xcf);
    if (isSOF && i + 9 < buf.length) {
      const height = buf.readUInt16BE(i + 5);
      const width  = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    if (i + 3 < buf.length) {
      const segLen = buf.readUInt16BE(i + 2);
      i += 2 + segLen;
    } else break;
  }
  return { width: 0, height: 0 };
}

// ─── GIF Dimensions (header bytes 6-9) ───────────────────────────────────────

async function readGifDimensions(filePath: string): Promise<{ width: number; height: number }> {
  const buf = await readBytes(filePath, 10);
  const width  = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  return { width, height };
}

// ─── WebP Dimensions ─────────────────────────────────────────────────────────

async function readWebpDimensions(filePath: string): Promise<{ width: number; height: number }> {
  const buf = await readBytes(filePath, 30);
  // RIFF....WEBPVP8 or VP8L or VP8X
  const format = buf.slice(12, 16).toString('ascii');
  if (format === 'VP8 ') {
    const width  = (buf.readUInt16LE(26) & 0x3fff) + 1;
    const height = (buf.readUInt16LE(28) & 0x3fff) + 1;
    return { width, height };
  }
  if (format === 'VP8L') {
    const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
    const width  = ((b0 | (b1 << 8)) & 0x3fff) + 1;
    const height = (((b1 >> 6) | (b2 << 2) | (b3 << 10)) & 0x3fff) + 1;
    return { width, height };
  }
  if (format === 'VP8X') {
    const width  = buf.readUIntLE(24, 3) + 1;
    const height = buf.readUIntLE(27, 3) + 1;
    return { width, height };
  }
  return { width: 0, height: 0 };
}

// ─── SVG Dimensions (parse viewBox / width / height attrs) ───────────────────

async function readSvgDimensions(filePath: string): Promise<{ width: number; height: number }> {
  const buf = await readBytes(filePath, 1024);
  const text = buf.toString('utf8');
  const vb = text.match(/viewBox=["'][\s]*(\S+)[\s]+(\S+)[\s]+(\S+)[\s]+(\S+)["']/);
  if (vb) return { width: parseFloat(vb[3]), height: parseFloat(vb[4]) };
  const w = text.match(/width=["']([0-9.]+)/);
  const h = text.match(/height=["']([0-9.]+)/);
  return {
    width:  w ? parseFloat(w[1]) : 0,
    height: h ? parseFloat(h[1]) : 0,
  };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function extractDimensions(filePath: string, ext: string): Promise<MediaDimensions> {
  try {
    switch (ext.toLowerCase()) {
      case 'png':
        const png = await readPngDimensions(filePath);
        return { ...png, duration: 0 };

      case 'jpg':
      case 'jpeg':
        const jpg = await readJpegDimensions(filePath);
        return { ...jpg, duration: 0 };

      case 'gif':
        const gif = await readGifDimensions(filePath);
        // Approximate GIF frame detection — treat all as animated (duration unknown without full decode)
        return { ...gif, duration: 0 };

      case 'webp':
        const webp = await readWebpDimensions(filePath);
        return { ...webp, duration: 0 };

      case 'svg':
      case 'svgz':
        const svg = await readSvgDimensions(filePath);
        return { ...svg, duration: 0 };

      default:
        // For video/audio and unknown types, return zeroes.
        // Real implementation would use ffprobe here.
        return { width: 0, height: 0, duration: 0 };
    }
  } catch {
    return { width: 0, height: 0, duration: 0 };
  }
}

// ─── Supported media types ────────────────────────────────────────────────────

export const SUPPORTED_IMAGE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'svgz',
  'bmp', 'tiff', 'tif', 'ico', 'avif', 'heic', 'heif',
]);

export const SUPPORTED_VIDEO_EXTS = new Set([
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v',
]);

export const SUPPORTED_DOCUMENT_EXTS = new Set([
  'pdf', 'ai', 'psd', 'sketch', 'fig', 'xd',
]);

export const ALL_SUPPORTED_EXTS = new Set([
  ...SUPPORTED_IMAGE_EXTS,
  ...SUPPORTED_VIDEO_EXTS,
  ...SUPPORTED_DOCUMENT_EXTS,
]);

export function isSupported(ext: string): boolean {
  return ALL_SUPPORTED_EXTS.has(ext.toLowerCase());
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readBytes(filePath: string, count: number): Promise<Buffer> {
  const fd = await fs.open(filePath, 'r');
  const buf = Buffer.alloc(count);
  const { bytesRead } = await fd.read(buf, 0, count, 0);
  await fd.close();
  return buf.subarray(0, bytesRead);
}
