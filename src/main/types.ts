// ─── Core Metadata ────────────────────────────────────────────────────────────
export interface ItemMetadata {
  id: string;                  // Unique CUID
  name: string;                // Display name (editable)
  ext: string;                 // File extension: png, mp4, gif …
  size: number;                // File size in bytes
  width: number;               // Image / Video width in px
  height: number;              // Image / Video height in px
  orientation: 'portrait' | 'landscape' | 'square';
  duration: number;            // Seconds (0 for stills)
  lastModified: number;        // System file mtime (epoch ms)
  importTime: number;          // When added to library (epoch ms)
  phash?: string;              // 64-bit Perceptual Hash
  url: string;                 // Original source URL if applicable
  externalPath?: string;       // Original source OS path if linked (not imported)
  tags: string[];              // Array of tag strings
  annotation: string;          // User notes / description
  folders: string[];           // Array of Folder IDs
  isDeleted: boolean;          // Soft-delete / Trash flag
  thumbnailStatus: 'pending' | 'completed' | 'failed';
  thumbnailError?: string;     // Error message if processing failed
}

// ─── Folder ───────────────────────────────────────────────────────────────────

export interface FolderRecord {
  id: string;
  name: string;
  description?: string;        // Optional folder description/notes
  createdAt: number;
  parentId: string | null;     // null = root-level folder
  color?: string;              // Optional accent color
  isPinned?: boolean;
  sortIndex?: number;
}

// ─── Library manifest stored at MyMedia.library/library.json ─────────────────

export interface LibraryManifest {
  version: string;             // Schema version for migrations
  name: string;                // Human-readable library name
  createdAt: number;
  lastOpenedAt: number;
  folders: FolderRecord[];
  tags: string[];              // Global tag registry
  itemCount: number;           // Cached total for quick display
}

// ─── In-Memory Search Index entry (lean subset of full metadata) ──────────────

export interface IndexEntry {
  id: string;
  name: string;
  ext: string;
  size: number;
  width: number;
  height: number;
  orientation: ItemMetadata['orientation'];
  duration: number;
  importTime: number;
  phash?: string;
  externalPath?: string;
  tags: string[];
  folders: string[];
  isDeleted: boolean;
  thumbnailStatus: ItemMetadata['thumbnailStatus'];
  thumbnailError?: string;
  // Resolved at index-load time — not stored in metadata.json
  contentPath: string;         // Absolute path to content.[ext]
  infoPath: string;            // Absolute path to [id].info/
}

// ─── Import request (from renderer → main) ───────────────────────────────────

export interface ImportRequest {
  sourcePaths: string[];       // Absolute paths to files on disk
  targetFolderId?: string;     // Destination folder ID (optional)
  sourceUrl?: string;          // For URL-imported items
  move?: boolean;              // true = move, false = copy (default)
  link?: boolean;              // true = link externally, do not copy
}

export interface ImportResult {
  succeeded: ImportedItem[];
  failed: FailedItem[];
}

export interface ImportedItem {
  id: string;
  name: string;
  ext: string;
}

export interface FailedItem {
  sourcePath: string;
  reason: string;
}

// ─── Query / Search ───────────────────────────────────────────────────────────

export interface SearchQuery {
  text?: string;               // Fuzzy match against name + tags
  ext?: string[];              // Filter by extension(s)
  tags?: string[];             // Must have ALL of these tags
  folders?: string[];          // Must be in ANY of these folders
  orientation?: ItemMetadata['orientation'];
  isDeleted?: boolean;         // Default: false (exclude trash)
  sortBy?: 'importTime' | 'name' | 'size' | 'width';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  items: IndexEntry[];
  total: number;
}

// ─── IPC channel names ────────────────────────────────────────────────────────

export const IPC = {
  // Library lifecycle
  LIBRARY_CREATE:   'library:create',
  LIBRARY_OPEN:     'library:open',
  LIBRARY_CLOSE:    'library:close',
  LIBRARY_INFO:     'library:info',

  // Items
  ITEM_IMPORT:      'item:import',
  ITEM_GET:         'item:get',
  ITEM_UPDATE:      'item:update',
  ITEM_DELETE:      'item:delete',
  ITEM_RESTORE:     'item:restore',
  ITEM_PURGE:       'item:purge',

  // Search / index
  SEARCH:           'search:query',
  INDEX_READY:      'index:ready',
  INDEX_PROGRESS:   'index:progress',

  // Folders
  FOLDER_CREATE:    'folder:create',
  FOLDER_RENAME:    'folder:rename',
  FOLDER_UPDATE:    'folder:update',
  FOLDER_DELETE:    'folder:delete',
  FOLDER_LIST:      'folder:list',

  // Tags
  TAG_RENAME:       'tag:rename',
  TAG_DELETE:       'tag:delete',
  TAG_LIST:         'tag:list',

  // Events pushed from main → renderer
  EVENT_IMPORT_PROGRESS: 'event:import-progress',
  EVENT_ITEM_ADDED:      'event:item-added',
  EVENT_ITEM_UPDATED:    'event:item-updated',
  EVENT_ITEM_REMOVED:    'event:item-removed',
} as const;
