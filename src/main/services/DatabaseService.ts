import * as path from 'path'
import * as fs from 'fs/promises'
import log from 'electron-log'

export class DatabaseService {
  private db: any = null
  private libraryRoot: string | null = null

  async init(libraryRoot: string) {
    this.libraryRoot = libraryRoot
    try {
      await fs.mkdir(this.libraryRoot, { recursive: true })
      const Database = require('better-sqlite3')
      this.db = new Database(path.join(this.libraryRoot, 'index.db'))
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('synchronous = NORMAL')
    } catch (err) {
      log.error('Failed to initialize SQLite database:', err)
      throw err
    }

    // Create main table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY, name TEXT, ext TEXT, size INTEGER, width INTEGER, height INTEGER,
        orientation TEXT, duration REAL, importTime INTEGER, lastModified REAL, url TEXT,
        annotation TEXT, phash TEXT, tags TEXT, folders TEXT, isDeleted INTEGER,
        contentFile TEXT, thumbnailFile TEXT, thumbnailStatus TEXT DEFAULT 'pending', thumbnailError TEXT
      )
    `)

    // Migration for existing databases
    const info = this.db.prepare("PRAGMA table_info(items)").all()
    const columns = info.map((c: any) => c.name)
    if (!columns.includes('thumbnailStatus')) {
      this.db.exec("ALTER TABLE items ADD COLUMN thumbnailStatus TEXT DEFAULT 'pending'")
      // Mark existing items with thumbnails as completed
      this.db.exec("UPDATE items SET thumbnailStatus = 'completed' WHERE thumbnailFile IS NOT NULL")
    }
    if (!columns.includes('thumbnailError')) {
      this.db.exec("ALTER TABLE items ADD COLUMN thumbnailError TEXT")
    }
    if (!columns.includes('externalPath')) {
      this.db.exec("ALTER TABLE items ADD COLUMN externalPath TEXT")
    }

    // Create junction tables for efficient searching
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS item_tags (
        item_id TEXT, 
        tag TEXT, 
        PRIMARY KEY (item_id, tag),
        FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS item_folders (
        item_id TEXT, 
        folder_id TEXT, 
        PRIMARY KEY (item_id, folder_id),
        FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_items_isDeleted ON items(isDeleted);
      CREATE INDEX IF NOT EXISTS idx_items_importTime ON items(importTime);
      CREATE INDEX IF NOT EXISTS idx_items_phash ON items(phash) WHERE phash IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_items_ext ON items(ext);
      CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
      
      -- Junction Reverse Indices (for faster tag/folder filtering)
      CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag);
      CREATE INDEX IF NOT EXISTS idx_item_folders_folder ON item_folders(folder_id);
    `)

    this.migrateJunctionTables()
  }

  private migrateJunctionTables() {
    const hasTags = this.db.prepare("SELECT 1 FROM item_tags LIMIT 1").get()
    if (!hasTags) {
      const items = this.db.prepare("SELECT id, tags, folders FROM items").all()
      const insertTag = this.db.prepare("INSERT OR IGNORE INTO item_tags (item_id, tag) VALUES (?, ?)")
      const insertFolder = this.db.prepare("INSERT OR IGNORE INTO item_folders (item_id, folder_id) VALUES (?, ?)")
      
      this.db.transaction(() => {
        for (const item of items) {
          try {
            const tags = JSON.parse(item.tags || '[]')
            const folders = JSON.parse(item.folders || '[]')
            tags.forEach((t: string) => insertTag.run(item.id, t))
            folders.forEach((f: string) => insertFolder.run(item.id, f))
          } catch {}
        }
      })()
    }
  }

  close() {
    if (this.db) { this.db.close(); this.db = null }
  }

  runTransaction(fn: () => void) {
    if (this.db) this.db.transaction(fn)()
  }

  private rowToEntry(row: any): any {
    const infoPath = path.join(this.libraryRoot!, 'images', `${row.id}.info`)
    let thumbPath = row.thumbnailFile ? path.join(infoPath, row.thumbnailFile) : undefined
    
    // Safety fallback: if status is completed but file is null, assume standard thumbnail.webp
    if (!thumbPath && row.thumbnailStatus === 'completed') {
      thumbPath = path.join(infoPath, 'thumbnail.webp')
    }

    // Check for enhanced.png
    let hasEnhanced = false
    try {
      const { existsSync } = require('fs')
      hasEnhanced = existsSync(path.join(infoPath, 'enhanced.png'))
    } catch {}

    return {
      ...row,
      tags: JSON.parse(row.tags || '[]'),
      folders: JSON.parse(row.folders || '[]'),
      isDeleted: row.isDeleted === 1,
      contentPath: row.externalPath || (row.contentFile ? path.join(infoPath, row.contentFile) : path.join(infoPath, `content.${row.ext}`)),
      infoPath,
      thumbnailPath: thumbPath,
      thumbnailStatus: row.thumbnailStatus || 'pending',
      thumbnailError: row.thumbnailError || null,
      hasEnhanced
    }
  }

  private entryToRow(entry: any): any {
    return {
      id: entry.id,
      name: entry.name || '',
      ext: entry.ext || '',
      size: entry.size || 0,
      width: entry.width || 0,
      height: entry.height || 0,
      orientation: entry.orientation || 'square',
      duration: entry.duration || 0,
      importTime: entry.importTime || 0,
      lastModified: entry.lastModified || 0,
      url: entry.url || '',
      annotation: entry.annotation || '',
      phash: entry.phash || null,
      tags: JSON.stringify(entry.tags || []),
      folders: JSON.stringify(entry.folders || []),
      isDeleted: entry.isDeleted ? 1 : 0,
      contentFile: entry.contentPath && !entry.externalPath ? path.basename(entry.contentPath) : (entry.contentFile || null),
      externalPath: entry.externalPath || null,
      thumbnailFile: entry.thumbnailPath ? path.basename(entry.thumbnailPath) : (entry.thumbnailFile || null),
      thumbnailStatus: entry.thumbnailStatus || 'pending',
      thumbnailError: entry.thumbnailError || null
    }
  }

  has(id: string): boolean {
    return !!this.db?.prepare('SELECT 1 FROM items WHERE id = ?').get(id)
  }

  get(id: string): any | undefined {
    const row = this.db?.prepare('SELECT * FROM items WHERE id = ?').get(id)
    return row ? this.rowToEntry(row) : undefined
  }

  set(id: string, entry: any) {
    const row = this.entryToRow(entry)
    const stmt = this.db.prepare(`
      INSERT INTO items (id, name, ext, size, width, height, orientation, duration, importTime, lastModified, url, annotation, phash, tags, folders, isDeleted, contentFile, externalPath, thumbnailFile, thumbnailStatus, thumbnailError)
      VALUES (@id, @name, @ext, @size, @width, @height, @orientation, @duration, @importTime, @lastModified, @url, @annotation, @phash, @tags, @folders, @isDeleted, @contentFile, @externalPath, @thumbnailFile, @thumbnailStatus, @thumbnailError)
      ON CONFLICT(id) DO UPDATE SET
        name=@name, ext=@ext, size=@size, width=@width, height=@height, orientation=@orientation, duration=@duration, importTime=@importTime, lastModified=@lastModified, url=@url, annotation=@annotation, phash=@phash, tags=@tags, folders=@folders, isDeleted=@isDeleted, contentFile=@contentFile, externalPath=@externalPath, thumbnailFile=@thumbnailFile, thumbnailStatus=@thumbnailStatus, thumbnailError=@thumbnailError
    `)
    
    this.db.transaction(() => {
      stmt.run(row)
      // Sync junction tables
      this.db.prepare("DELETE FROM item_tags WHERE item_id = ?").run(id)
      this.db.prepare("DELETE FROM item_folders WHERE item_id = ?").run(id)
      const tags = JSON.parse(row.tags)
      const folders = JSON.parse(row.folders)
      const insertTag = this.db.prepare("INSERT OR IGNORE INTO item_tags (item_id, tag) VALUES (?, ?)")
      const insertFolder = this.db.prepare("INSERT OR IGNORE INTO item_folders (item_id, folder_id) VALUES (?, ?)")
      tags.forEach((t: string) => insertTag.run(id, t))
      folders.forEach((f: string) => insertFolder.run(id, f))
    })()
  }

  delete(id: string) {
    this.db?.prepare('DELETE FROM items WHERE id = ?').run(id)
  }

  getAllNonDeletedCount(): number {
    return (this.db?.prepare('SELECT COUNT(*) as count FROM items WHERE isDeleted = 0').get() as any).count
  }

  findBySize(size: number): any[] {
    const rows = this.db?.prepare('SELECT * FROM items WHERE isDeleted = 0 AND size = ?').all(size)
    return rows ? rows.map((r: any) => this.rowToEntry(r)) : []
  }

  getAllPhashes(): { id: string, phash: string }[] {
    return this.db?.prepare('SELECT id, phash FROM items WHERE isDeleted = 0 AND phash IS NOT NULL').all() as any
  }

  search(query: any = {}) {
    const { text, keyword, ext, tags, folders, isDeleted = false, ids,
      orientation, sizeMin, sizeMax, dateMin, dateMax, untagged, tagged,
      sortBy = 'importTime', sortDir = 'desc', limit = 5000, offset = 0 } = query

    let sql = `SELECT * FROM items WHERE isDeleted = ?`
    const params: any[] = [isDeleted ? 1 : 0]

    if (ids && Array.isArray(ids)) {
      if (ids.length === 0) return { items: [], total: 0 }
      sql += ` AND id IN (${ids.map(() => '?').join(',')})`
      params.push(...ids)
    }

    if (ext && Array.isArray(ext) && ext.length > 0) {
      sql += ` AND ext IN (${ext.map(() => '?').join(',')})`
      params.push(...ext.map(e => e.toLowerCase()))
    }

    if (tags && Array.isArray(tags) && tags.length > 0) {
      // Must have ALL tags
      for (const tag of tags) {
        sql += ` AND id IN (SELECT item_id FROM item_tags WHERE tag = ?)`
        params.push(tag)
      }
    }

    if (folders && Array.isArray(folders) && folders.length > 0) {
      // In ANY of the folders
      sql += ` AND id IN (SELECT item_id FROM item_folders WHERE folder_id IN (${folders.map(() => '?').join(',')}))`
      params.push(...folders)
    }

    if (orientation && Array.isArray(orientation) && orientation.length > 0) {
      sql += ` AND orientation IN (${orientation.map(() => '?').join(',')})`
      params.push(...orientation)
    }

    if (sizeMin !== undefined) { sql += ` AND size >= ?`; params.push(sizeMin) }
    if (sizeMax !== undefined) { sql += ` AND size <= ?`; params.push(sizeMax) }
    if (dateMin !== undefined) { sql += ` AND importTime >= ?`; params.push(dateMin) }
    if (dateMax !== undefined) { sql += ` AND importTime <= ?`; params.push(dateMax) }

    if (untagged) {
      sql += ` AND id NOT IN (SELECT item_id FROM item_tags)`
    } else if (tagged) {
      sql += ` AND id IN (SELECT item_id FROM item_tags)`
    }

    const searchText = text || keyword
    if (searchText && !ids) {
      sql += ` AND (name LIKE ? OR annotation LIKE ? OR id IN (SELECT item_id FROM item_tags WHERE tag LIKE ?))`
      const like = `%${searchText}%`
      params.push(like, like, like)
    }

    const sortMap: Record<string, string> = {
      name: 'name',
      size: 'size',
      type: 'ext',
      importTime: 'importTime',
      lastModified: 'lastModified'
    }
    const orderCol = sortMap[sortBy] || 'importTime'
    const direction = sortDir.toLowerCase() === 'asc' ? 'ASC' : 'DESC'
    
    sql += ` ORDER BY ${orderCol} ${direction}`
    
    // Calculate total before adding LIMIT/OFFSET
    const countSql = `SELECT COUNT(*) as total FROM (${sql})`
    const total = (this.db.prepare(countSql).get(...params) as any).total

    sql += ` LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const rows = this.db.prepare(sql).all(...params)
    return { items: rows.map((r: any) => this.rowToEntry(r)), total }
  }

  getValues(): any[] {
    const rows = this.db.prepare('SELECT * FROM items').all()
    return rows.map((r: any) => this.rowToEntry(r))
  }

  getSidebarCounts() {
    let all = 0, untagged = 0, tagged = 0, trash = 0
    const folderCounts: Record<string, number> = {}
    const folderSizes: Record<string, number> = {}
    
    // Efficient counts via SQL
    all = (this.db.prepare('SELECT COUNT(*) as c FROM items WHERE isDeleted = 0').get() as any).c
    trash = (this.db.prepare('SELECT COUNT(*) as c FROM items WHERE isDeleted = 1').get() as any).c
    tagged = (this.db.prepare('SELECT COUNT(DISTINCT item_id) as c FROM item_tags t JOIN items i ON t.item_id = i.id WHERE i.isDeleted = 0').get() as any).c
    untagged = all - tagged

    const folders = this.db.prepare(`
      SELECT f.folder_id, COUNT(*) as count, SUM(i.size) as totalSize
      FROM item_folders f
      JOIN items i ON f.item_id = i.id
      WHERE i.isDeleted = 0
      GROUP BY f.folder_id
    `).all() as any[]

    for (const f of folders) {
      folderCounts[f.folder_id] = f.count
      folderSizes[f.folder_id] = f.totalSize
    }

    const dupMap: Record<string, number> = {}
    let duplicates = 0
    const dups = this.db.prepare(`
      SELECT phash, size, COUNT(*) as c
      FROM items
      WHERE isDeleted = 0
      GROUP BY COALESCE(phash, 'size-' || size)
      HAVING COUNT(*) > 1
    `).all() as any[]
    
    for (const d of dups) duplicates += d.c

    return { all, untagged, tagged, trash, folders: folderCounts, folderSizes, duplicates }
  }
}
