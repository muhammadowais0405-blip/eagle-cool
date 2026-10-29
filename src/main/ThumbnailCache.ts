/**
 * ThumbnailCache
 * ──────────────
 * Generates, stores, and serves thumbnails for library items.
 *
 * Cache layout inside MyMedia.library/:
 *
 *   .thumbs/
 *   ├── sm/   128×128  — sidebar / dense grid
 *   ├── md/   256×256  — standard grid view
 *   └── lg/   512×512  — large grid / hover preview
 *
 * Each thumb is stored as:
 *   .thumbs/<size>/<item-id>.webp
 *
 * Strategy:
 *   - Thumbnails are generated lazily on first request.
 *   - Generation uses Sharp if available, falls back to a pure-Node
 *     JPEG/PNG → canvas-less resize using the `sharp` npm package stubs
 *     or native Electron nativeImage for in-process use.
 *   - A write-through in-memory LRU cache (configurable max entries)
 *     serves repeated requests without disk reads.
 *   - A .thumbs/index.json tracks which item IDs have been generated
 *     at each size, so we never regenerate unnecessarily.
 */

import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThumbSize = 'sm' | 'md' | 'lg';

export interface ThumbSizeConfig {
  width:  number;
  height: number;
}

export const THUMB_SIZES: Record<ThumbSize, ThumbSizeConfig> = {
  sm: { width: 128, height: 128 },
  md: { width: 256, height: 256 },
  lg: { width: 512, height: 512 },
};

export interface ThumbRequest {
  itemId:      string;
  contentPath: string;   // absolute path to content.[ext]
  ext:         string;
  size:        ThumbSize;
}

export interface ThumbResult {
  itemId:    string;
  size:      ThumbSize;
  thumbPath: string;     // absolute path to .webp thumb on disk
  /** Data URL (base64 webp) — populated only if returnDataUrl=true */
  dataUrl?:  string;
}

// ─── LRU Cache ────────────────────────────────────────────────────────────────

class LRUCache<K, V> {
  private map  = new Map<K, V>();

  constructor(private maxSize: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    
    // Extract and re-insert to promote to the end (most recently used)
    const val = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      // map.keys().next().value gets the oldest (first inserted) key in O(1)
      const evicted = this.map.keys().next().value;
      if (evicted !== undefined) this.map.delete(evicted);
    }
    this.map.set(key, value);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  delete(key: K): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

// ─── Generation queue ─────────────────────────────────────────────────────────

interface QueueItem {
  request:       ThumbRequest;
  returnDataUrl: boolean;
  resolve:       (r: ThumbResult) => void;
  reject:        (e: Error) => void;
}

// ─── ThumbnailCache ───────────────────────────────────────────────────────────

export class ThumbnailCache extends EventEmitter {
  private cacheRoot:   string | null = null;
  private index:       Map<string, Set<ThumbSize>> = new Map(); // itemId → Set<size>
  private memCache:    LRUCache<string, Buffer>;
  private queue:       QueueItem[] = [];
  private processing   = false;
  private concurrency  = 4;  // max parallel thumbnail generations
  private activeCount  = 0;
  private sharp:       any = null; // loaded lazily

  constructor(opts: { memoryCacheSize?: number } = {}) {
    super();
    this.memCache = new LRUCache(opts.memoryCacheSize ?? 500);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async init(libraryRoot: string): Promise<void> {
    this.cacheRoot = path.join(libraryRoot, '.thumbs');

    // Create size subdirs
    for (const size of Object.keys(THUMB_SIZES) as ThumbSize[]) {
      await fs.mkdir(path.join(this.cacheRoot, size), { recursive: true });
    }

    // Load index
    await this.loadIndex();

    // Try to load Sharp
    try {
      this.sharp = require('sharp');
    } catch {
      this.sharp = null;
    }
  }

  async destroy(): Promise<void> {
    await this.saveIndex();
    this.memCache.clear();
    this.queue = [];
    this.cacheRoot = null;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Get or generate a thumbnail.
   * Returns a ThumbResult with the absolute path to the webp on disk.
   * If returnDataUrl=true also returns a base64 data URL (for IPC transfer).
   */
  async getThumb(req: ThumbRequest, returnDataUrl = false): Promise<ThumbResult> {
    this.assertInit();

    const key       = this.cacheKey(req.itemId, req.size);
    const thumbPath = this.thumbPath(req.itemId, req.size);

    // ── Memory hit ──────────────────────────────────────────────────────────
    if (this.memCache.has(key)) {
      const buf = this.memCache.get(key)!;
      return {
        itemId: req.itemId,
        size:   req.size,
        thumbPath,
        dataUrl: returnDataUrl
          ? `data:image/webp;base64,${buf.toString('base64')}`
          : undefined,
      };
    }

    // ── Disk hit ────────────────────────────────────────────────────────────
    if (this.hasIndex(req.itemId, req.size)) {
      try {
        const buf = await fs.readFile(thumbPath);
        this.memCache.set(key, buf);
        return {
          itemId: req.itemId,
          size:   req.size,
          thumbPath,
          dataUrl: returnDataUrl
            ? `data:image/webp;base64,${buf.toString('base64')}`
            : undefined,
        };
      } catch {
        // File missing despite index — remove from index and let it fall through to generate
        this.removeIndex(req.itemId, req.size);
      }
    }

    // ── Generate ────────────────────────────────────────────────────────────
    return this.enqueue(req, returnDataUrl);
  }

  /**
   * Request multiple thumbnails in one call — returns a stream of results
   * via the 'thumb:ready' event as each one completes.
   */
  queueBatch(requests: ThumbRequest[]): void {
    this.assertInit();
    for (const req of requests) {
      if (!this.hasIndex(req.itemId, req.size)) {
        // generate() already emits 'thumb:ready' — just enqueue, no extra emit
        this.enqueue(req, false).catch(() => {});
      }
    }
  }

  /**
   * Evict all thumbs for a deleted / purged item.
   */
  async evict(itemId: string): Promise<void> {
    for (const size of Object.keys(THUMB_SIZES) as ThumbSize[]) {
      const p = this.thumbPath(itemId, size);
      try { await fs.unlink(p); } catch {}
      this.memCache.delete(this.cacheKey(itemId, size));
    }
    this.index.delete(itemId);
  }

  /**
   * Returns the thumb path if it exists in the index (disk may still be
   * generating). Used by the renderer to speculatively set img.src.
   */
  getCachedPath(itemId: string, size: ThumbSize): string | null {
    if (!this.hasIndex(itemId, size)) return null;
    return this.thumbPath(itemId, size);
  }

  getStats() {
    return {
      indexedItems: this.index.size,
      memCacheSize: this.memCache.size,
      queueDepth:   this.queue.length,
      activeCount:  this.activeCount,
    };
  }

  // ── Generation pipeline ──────────────────────────────────────────────────

  private enqueue(req: ThumbRequest, returnDataUrl: boolean): Promise<ThumbResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ request: req, returnDataUrl, resolve, reject });
      this.drain();
    });
  }

  private drain(): void {
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.activeCount++;
      this.generate(item.request)
        .then(result => {
          if (item.returnDataUrl) {
            const buf = this.memCache.get(this.cacheKey(item.request.itemId, item.request.size));
            if (buf) result.dataUrl = `data:image/webp;base64,${buf.toString('base64')}`;
          }
          this.emit('thumb:ready', result);
          item.resolve(result);
          this.activeCount--;
          this.drain();
        })
        .catch(err => {
          item.reject(err instanceof Error ? err : new Error(String(err)));
          this.activeCount--;
          this.drain();
        });
    }
  }

  private async generate(req: ThumbRequest): Promise<ThumbResult> {
    const thumbPath  = this.thumbPath(req.itemId, req.size);
    const { width, height } = THUMB_SIZES[req.size];

    if (this.sharp) {
      await this.generateWithSharp(req.contentPath, thumbPath, width, height);
    } else {
      await this.generateFallback(req.contentPath, thumbPath, req.ext, width, height);
    }

    // Cache to memory
    const buf = await fs.readFile(thumbPath);
    this.memCache.set(this.cacheKey(req.itemId, req.size), buf);
    this.setIndex(req.itemId, req.size);

    return {
      itemId:    req.itemId,
      size:      req.size,
      thumbPath,
    };
  }

  /**
   * Primary: use Sharp (best quality, supports all formats).
   * Sharp must be installed: npm install sharp
   */
  private async generateWithSharp(
    srcPath: string,
    destPath: string,
    width: number,
    height: number,
  ): Promise<void> {
    await this.sharp(srcPath)
      .resize(width, height, {
        fit:      'inside',   // preserve aspect ratio, fit within box
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toFile(destPath);
  }

  /**
   * Fallback: Electron nativeImage resize → PNG buffer written to disk.
   * Available in the main process without additional npm packages.
   * Falls back further to copying the original if nativeImage unavailable.
   */
  private async generateFallback(
    srcPath: string,
    destPath: string,
    ext: string,
    width: number,
    height: number,
  ): Promise<void> {
    // Try Electron nativeImage (available in main process)
    try {
      const { nativeImage } = require('electron');
      const img     = nativeImage.createFromPath(srcPath);
      const size    = img.getSize();
      const scale   = Math.min(width / size.width, height / size.height, 1);
      const resized = img.resize({
        width:   Math.round(size.width  * scale),
        height:  Math.round(size.height * scale),
        quality: 'good',
      });
      await fs.writeFile(destPath.replace('.webp', '.png'), resized.toPNG());
      // Re-point thumbPath to .png for fallback
      await fs.rename(destPath.replace('.webp', '.png'), destPath);
      return;
    } catch {}

    // Last resort: symlink or copy original (no resize — still usable for preview)
    await fs.copyFile(srcPath, destPath);
  }

  // ── Index helpers ────────────────────────────────────────────────────────

  private hasIndex(itemId: string, size: ThumbSize): boolean {
    return this.index.get(itemId)?.has(size) ?? false;
  }

  private setIndex(itemId: string, size: ThumbSize): void {
    if (!this.index.has(itemId)) this.index.set(itemId, new Set());
    this.index.get(itemId)!.add(size);
  }

  private removeIndex(itemId: string, size: ThumbSize): void {
    this.index.get(itemId)?.delete(size);
  }

  private async loadIndex(): Promise<void> {
    const indexPath = path.join(this.cacheRoot!, 'index.json');
    try {
      const raw  = await fs.readFile(indexPath, 'utf8');
      const data = JSON.parse(raw) as Record<string, ThumbSize[]>;
      for (const [id, sizes] of Object.entries(data)) {
        this.index.set(id, new Set(sizes));
      }
    } catch {
      // Fresh cache — index doesn't exist yet
    }
  }

  async saveIndex(): Promise<void> {
    if (!this.cacheRoot) return;
    const data: Record<string, ThumbSize[]> = {};
    for (const [id, sizes] of this.index.entries()) {
      data[id] = [...sizes];
    }
    const indexPath = path.join(this.cacheRoot, 'index.json');
    const tmp       = indexPath + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(data), 'utf8');
    await fs.rename(tmp, indexPath);
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  private cacheKey(itemId: string, size: ThumbSize): string {
    return `${itemId}:${size}`;
  }

  private thumbPath(itemId: string, size: ThumbSize): string {
    return path.join(this.cacheRoot!, size, `${itemId}.webp`);
  }

  private assertInit(): void {
    if (!this.cacheRoot) throw new Error('ThumbnailCache not initialised — call init() first.');
  }
}
