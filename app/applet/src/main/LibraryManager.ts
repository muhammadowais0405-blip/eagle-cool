import { MediaItem } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class LibraryManager {
  private libraryPath: string;
  private indexCache: MediaItem[] = [];

  constructor(libraryPath: string) {
    this.libraryPath = libraryPath;
  }

  // Helper to save index.json
  private async saveIndex() {
    const indexPath = path.join(this.libraryPath, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(this.indexCache, null, 2));
  }

  // Helper to save individual item metadata
  private async saveItemMetadata(item: MediaItem) {
    const itemDir = path.join(this.libraryPath, 'images', `${item.id}.info`);
    const metadataPath = path.join(itemDir, 'metadata.json');
    try {
      await fs.writeFile(metadataPath, JSON.stringify(item, null, 2));
    } catch (error) {
      console.error(`Failed to save metadata for ${item.id}`, error);
    }
  }

  /**
   * Area 1: Soft Delete
   */
  async moveToTrash(id: string): Promise<void> {
    const itemIndex = this.indexCache.findIndex(i => i.id === id);
    if (itemIndex === -1) throw new Error('Item not found');

    const item = this.indexCache[itemIndex];
    item.isDeleted = true;
    item.deletedAt = Date.now();

    // Sync to metadata.json
    await this.saveItemMetadata(item);
    // Sync to index.json
    await this.saveIndex();
  }

  /**
   * Area 2: Restore
   */
  async restoreFromTrash(id: string): Promise<void> {
    const itemIndex = this.indexCache.findIndex(i => i.id === id);
    if (itemIndex === -1) throw new Error('Item not found');

    const item = this.indexCache[itemIndex];
    item.isDeleted = false;
    item.deletedAt = undefined;

    // Sync to metadata.json
    await this.saveItemMetadata(item);
    // Sync to index.json
    await this.saveIndex();
  }

  /**
   * Area 3: Permanent Delete
   */
  async permanentlyDelete(id: string): Promise<void> {
    const itemIndex = this.indexCache.findIndex(i => i.id === id);
    if (itemIndex === -1) throw new Error('Item not found');

    const itemDir = path.join(this.libraryPath, 'images', `${id}.info`);
    
    try {
      // Remove the directory and all its contents (content.ext, metadata.json, thumbnails)
      await fs.rm(itemDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to permanently delete files for ${id}`, error);
    }

    // Remove from index
    this.indexCache.splice(itemIndex, 1);
    await this.saveIndex();
  }

  async emptyTrash(): Promise<void> {
    const deletedItems = this.indexCache.filter(i => i.isDeleted);
    for (const item of deletedItems) {
      await this.permanentlyDelete(item.id);
    }
  }

  /**
   * Fetching items with filtering
   */
  getItems(includeDeleted = false): MediaItem[] {
    if (includeDeleted) {
      return this.indexCache.filter(i => i.isDeleted);
    }
    return this.indexCache.filter(i => !i.isDeleted);
  }
}
