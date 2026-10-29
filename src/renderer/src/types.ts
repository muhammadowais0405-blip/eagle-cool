// Shared types used by both renderer and main process logic.
// The full type definitions live in src/main/types.ts (main process).
// This file contains the subset needed by renderer components.

export interface IndexEntry {
  id:          string
  name:        string
  ext:         string
  size:        number
  width:       number
  height:      number
  orientation: 'portrait' | 'landscape' | 'square'
  duration:    number
  importTime:  number
  phash?:      string
  tags:        string[]
  folders:     string[]
  isDeleted:   boolean
  thumbnailStatus: 'pending' | 'completed' | 'failed'
  thumbnailError?: string
  contentPath: string
  infoPath:    string
}

export interface FolderRecord {
  id:        string
  name:      string
  createdAt: number
  parentId:  string | null
  color?:    string
}

export interface LibraryManifest {
  version:      string
  name:         string
  createdAt:    number
  lastOpenedAt: number
  folders:      FolderRecord[]
  tags:         string[]
  itemCount:    number
}

export interface SearchQuery {
  text?:        string
  ext?:         string[]
  tags?:        string[]
  folders?:     string[]
  orientation?: 'portrait' | 'landscape' | 'square'
  isDeleted?:   boolean
  sortBy?:      'importTime' | 'name' | 'size' | 'width'
  sortDir?:     'asc' | 'desc'
  limit?:       number
  offset?:      number
}
