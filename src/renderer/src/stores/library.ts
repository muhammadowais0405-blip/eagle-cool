import { ref, reactive, shallowRef, computed } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'

export interface IndexEntry {
  id: string; name: string; ext: string; size: number
  width: number; height: number; orientation: string
  importTime: number; tags: string[]; folders: string[]
  isDeleted: boolean; contentPath: string; infoPath: string
  thumbnailPath?: string; previewPath?: string; duration?: number
  thumbnailStatus: 'pending' | 'completed' | 'failed'
  thumbnailError?: string
}
export interface FolderRecord { id: string; name: string; description?: string; color?: string; icon?: string; createdAt: number; parentId: string | null; isPinned?: boolean; sortIndex?: number }
export interface LibraryManifest {
  name: string; version: string; createdAt: number
  folders: FolderRecord[]; tags: string[]; itemCount: number
}
export interface RecentLibrary { path: string; name: string; openedAt: number }

export const useLibraryStore = defineStore('library', () => {
  // ─── State ──────────────────────────────────────────────────────────────────

  const libraryInfo = shallowRef<LibraryManifest | null>(null)
  const libraryPath = ref<string | null>(null)
  const items = shallowRef<IndexEntry[]>([])
  const selectedItems = ref<IndexEntry[]>([])
  const lastSelected = shallowRef<IndexEntry | null>(null)
  const shiftAnchor = shallowRef<IndexEntry | null>(null)
  const fullMeta = shallowRef<any | null>(null)
  const totalCount = ref(0)
  const isLoading = ref(false)
  const isRestoring = ref(false)
  const recentLibraries = ref<RecentLibrary[]>([])
  const importProgress = ref<{ done: number; total: number; current: string } | null>(null)
  const repairProgress = ref<{ done: number; total: number; current: string } | null>(null)
  const thumbCache = reactive<Record<string, string>>({})
  const recentlyViewed = shallowRef<IndexEntry[]>([])
  const allTagsList = ref<string[]>([])
  const sidebarCounts = ref<{ 
    all: number; 
    untagged: number; 
    tagged: number; 
    trash: number; 
    folders: Record<string, number>; 
    folderSizes: Record<string, number>; 
    duplicates: number 
  }>({
    all: 0, untagged: 0, tagged: 0, trash: 0, folders: {}, folderSizes: {}, duplicates: 0
  })

  // ─── Getters ────────────────────────────────────────────────────────────────

  const selectedItem = computed(() => selectedItems.value.length === 1 ? selectedItems.value[0] : null)

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function refreshSidebarCounts() {
    sidebarCounts.value = await window.api.invoke('library:getSidebarCounts')
  }

  async function fetchThumb(item: IndexEntry) {
    if (thumbCache[item.id]) return

    const ext = item.ext.toLowerCase()
    const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'jfif', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico', 'avif'])
    const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'mpeg', 'mpg'])

    if (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) return

    // Prefer a verified thumbnail path; fall back to the source file if thumbnail
    // is missing or the generation failed. The renderer's <img> will use the
    // onImgError handler in Gallery.vue to fall back further if even this URL
    // is broken (e.g. a stale `media://` URL to a deleted file).
    const targetPath = item.thumbnailPath || item.contentPath
    if (targetPath) {
      thumbCache[item.id] = `media://local/${encodeURIComponent(targetPath)}`
    }
  }


  const lastQuery = shallowRef<Record<string, any>>({})

  function itemMatchesQuery(entry: IndexEntry, q: Record<string, any>) {
    const isDeleted = !!q.isDeleted
    if (!!entry.isDeleted !== isDeleted) return false
    
    if (q.ext && q.ext.length > 0) {
      const extSet = new Set((q.ext as string[]).map(e => e.toLowerCase()))
      if (!entry.ext || !extSet.has(entry.ext.toLowerCase())) return false
    }
    if (q.tags && q.tags.length > 0) {
      if (!q.tags.every((t: string) => (entry.tags || []).includes(t))) return false
    }
    if (q.folders && q.folders.length > 0) {
      if (!q.folders.some((f: string) => (entry.folders || []).includes(f))) return false
    }
    if (q.orientation && q.orientation.length > 0) {
      const orient = entry.orientation || (entry.width === entry.height ? 'square' : entry.width > entry.height ? 'landscape' : 'portrait')
      if (!q.orientation.includes(orient)) return false
    }
    if (q.sizeMin !== undefined && entry.size < q.sizeMin) return false
    if (q.sizeMax !== undefined && entry.size > q.sizeMax) return false
    if (q.dateMin !== undefined && entry.importTime < q.dateMin) return false
    if (q.dateMax !== undefined && entry.importTime > q.dateMax) return false
    if (q.untagged && (entry.tags && entry.tags.length > 0)) return false
    if (q.tagged && (!entry.tags || entry.tags.length === 0)) return false
    const text = q.text || q.keyword
    if (text) {
      const textLower = text.toLowerCase()
      if (!(entry.name || '').toLowerCase().includes(textLower) &&
          !(entry.tags || []).some(t => t.toLowerCase().includes(textLower))) return false
    }
    return true
  }

  async function search(query: Record<string, any> = {}) {
    if (!libraryInfo.value) return
    isLoading.value = true
    lastQuery.value = query
    try {
      const r = await window.api.invoke('search:query', { ...query, limit: 10000 })
      items.value = r.items; totalCount.value = r.total
      r.items.forEach((e: IndexEntry) => {
        if (!thumbCache[e.id]) fetchThumb(e)
      })
      const infoR = await window.api.invoke('library:info')
      if (infoR.info) {
        libraryInfo.value = infoR.info
        allTagsList.value = infoR.info.tags || []
      }
      await refreshSidebarCounts()
    } finally { isLoading.value = false }
  }

  let unsubs: Array<() => void> = []

  function initEvents() {
    unsubs.forEach(u => u()); unsubs = [
      window.api.on('event:item-added', (entry: IndexEntry) => {
        if (itemMatchesQuery(entry, lastQuery.value)) {
          items.value = [entry, ...items.value]; totalCount.value++
          fetchThumb(entry)
        }
        refreshSidebarCounts()
      }),
      window.api.on('event:item-updated', (entry: IndexEntry) => {
        const idx = items.value.findIndex(i => i.id === entry.id)
        if (idx !== -1) { 
          if (itemMatchesQuery(entry, lastQuery.value)) {
            const arr = [...items.value]; arr[idx] = entry; items.value = arr 
          } else {
            items.value = items.value.filter(i => i.id !== entry.id)
            totalCount.value = Math.max(0, totalCount.value - 1)
          }
        } else if (itemMatchesQuery(entry, lastQuery.value)) {
          items.value = [entry, ...items.value]; totalCount.value++
        }

        const selIdx = selectedItems.value.findIndex(i => i.id === entry.id)
        if (selIdx !== -1) {
          if (itemMatchesQuery(entry, lastQuery.value)) {
            const newSel = [...selectedItems.value]
            newSel[selIdx] = entry
            selectedItems.value = newSel
          } else {
            selectedItems.value = selectedItems.value.filter(i => i.id !== entry.id)
            if (selectedItems.value.length === 0) fullMeta.value = null
          }
        }

        if (entry.thumbnailPath) {
          thumbCache[entry.id] = `media://local/${encodeURIComponent(entry.thumbnailPath)}`
        } else if (!thumbCache[entry.id]) {
          fetchThumb(entry)
        }
        refreshSidebarCounts()
      }),
      window.api.on('event:item-removed', (id: string) => {
        items.value = items.value.filter(i => i.id !== id)
        totalCount.value = Math.max(0, totalCount.value - 1)
        selectedItems.value = selectedItems.value.filter(i => i.id !== id)
        if (selectedItems.value.length === 0) fullMeta.value = null
        refreshSidebarCounts()
      }),
      window.api.on('event:repair-progress', (p: any) => {
        repairProgress.value = p
      }),
      window.api.on('event:import-progress', (p: any) => {
        importProgress.value = p
        if (!p) {
          if (importToastId) {
            toast.dismiss(importToastId)
            importToastId = null
          }
          return
        }

        if (!importToastId) {
          importToastId = toast.loading(`Importing ${p.total} items...`, {
            description: `Processing: ${p.current}`,
            duration: Infinity
          })
        } else {
          toast.loading(`Importing ${p.done} / ${p.total} items...`, {
            id: importToastId,
            description: `Processing: ${p.current}`
          })
        }

        if (p.done >= p.total) {
          toast.success(`Successfully imported ${p.total} items`, {
            id: importToastId,
            duration: 4000
          })
          importToastId = null
        }
      }),
    ]
  }

  let importToastId: string | number | null = null

  async function _openPath(p: string): Promise<boolean> {
    try {
      const r = await window.api.invoke('library:open', p)
      if (!r.ok) return false
      libraryInfo.value = r.info; libraryPath.value = p
      recentlyViewed.value = []
      
      for (const key in thumbCache) delete thumbCache[key]

      const s = await window.api.invoke('session:get')
      recentLibraries.value = s.recentLibraries ?? []
      initEvents(); await search({}); await fetchWatchFolders(); return true
    } catch { return false }
  }

  async function restoreLastLibrary(): Promise<boolean> {
    if (isRestoring.value) return !!libraryInfo.value
    isRestoring.value = true
    try {
      const session = await window.api.invoke('session:get')
      recentLibraries.value = session.recentLibraries ?? []
      if (!session.lastLibraryPath) return false
      return await _openPath(session.lastLibraryPath)
    } finally { isRestoring.value = false }
  }

  async function createLibrary(p: string, name: string) {
    const r = await window.api.invoke('library:create', p, name)
    if (r.ok) {
      libraryInfo.value = r.info; libraryPath.value = p
      const s = await window.api.invoke('session:get')
      recentLibraries.value = s.recentLibraries ?? []
      initEvents(); await search({})
    }
    return r
  }

  async function openLibrary(p: string) { return _openPath(p) }

  async function pickAndOpenLibrary() {
    const chosen = await window.api.invoke('dialog:openLibrary')
    if (!chosen) return
    
    let targetPath = chosen
    if (!chosen.toLowerCase().endsWith('.library')) {
       const innerLib = await window.api.invoke('dialog:checkHasLibrary', chosen)
       if (innerLib) targetPath = innerLib
    }

    const opened = await _openPath(targetPath)
    if (!opened) {
      if (targetPath !== chosen) {
         toast.error(`Failed to open the inner library at:\n${targetPath}\n\nIt might be corrupted or lack metadata.`)
         return
      }
      const name = chosen.split(/[\\/]/).pop()?.replace(/\.library$/i, '') ?? 'My Library'
      await createLibrary(chosen, name)
    }
  }

  async function createNewLibrary() {
    const chosen = await window.api.invoke('dialog:openLibrary')
    if (!chosen) return false
    return chosen
  }

  async function removeRecentLibrary(p: string) {
    const s = await window.api.invoke('session:removeRecent', p)
    recentLibraries.value = s.recentLibraries ?? []
  }

  async function autoTrashPurge() {
    if (!libraryInfo.value) return
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const r = await window.api.invoke('search:query', { isDeleted: true, limit: 100000 })
    for (const e of r.items as IndexEntry[]) {
      if (now - e.importTime > THIRTY_DAYS) {
        try { await window.api.invoke('item:purge', e.id) } catch { }
      }
    }
  }

  async function pickAndImport(folderId?: string) {
    const paths = await window.api.invoke('dialog:pickFiles')
    if (!paths.length) return
    importProgress.value = { done: 0, total: paths.length, current: '' }
    const r = await window.api.invoke('item:import', { sourcePaths: paths, targetFolderId: folderId })
    importProgress.value = null; return r
  }

  async function pickAndImportFolders(folderId?: string) {
    const folderPaths = await window.api.invoke('dialog:pickFolders')
    if (!folderPaths.length) return
    importProgress.value = { done: 0, total: 1, current: 'Scanning folders...' }
    const r = await window.api.invoke('item:import', { sourcePaths: folderPaths, targetFolderId: folderId, recursive: true })
    importProgress.value = null; return r
  }

  async function importPaths(sourcePaths: string[], folderId?: string, move: boolean = false) {
    return window.api.invoke('item:import', { sourcePaths, targetFolderId: folderId, move })
  }

  async function importFromUrl(url: string, folderId?: string | null) {
    if (!libraryInfo.value) return
    importProgress.value = { done: 0, total: 1, current: 'Downloading image...' }
    try {
      await window.api.invoke('item:importFromUrl', url, folderId ?? undefined)
    } finally {
      importProgress.value = null
    }
  }

  async function selectItem(entry: IndexEntry, multi: boolean = false, range: boolean = false) {
    const all = items.value
    
    // 1. Handle Range Selection (Shift)
    if (range) {
      // If no anchor yet, or anchor is not in current view, use first item or current entry
      let anchorIdx = shiftAnchor.value ? all.findIndex(i => i.id === shiftAnchor.value!.id) : -1
      if (anchorIdx === -1) {
        shiftAnchor.value = entry
        anchorIdx = all.findIndex(i => i.id === entry.id)
      }
      
      const targetIdx = all.findIndex(i => i.id === entry.id)
      if (anchorIdx !== -1 && targetIdx !== -1) {
        const start = Math.min(anchorIdx, targetIdx)
        const end = Math.max(anchorIdx, targetIdx)
        const rangeItems = all.slice(start, end + 1)
        
        if (multi) {
          // Ctrl + Shift: Add the range to existing selection
          const currentIds = new Set(selectedItems.value.map(i => i.id))
          rangeItems.forEach(i => currentIds.add(i.id))
          selectedItems.value = all.filter(i => currentIds.has(i.id))
        } else {
          // Just Shift: Replace selection with range
          selectedItems.value = rangeItems
        }
      }
    } 
    // 2. Handle Multi Selection (Ctrl / Cmd)
    else if (multi) {
      shiftAnchor.value = entry
      const idx = selectedItems.value.findIndex(i => i.id === entry.id)
      if (idx > -1) {
        selectedItems.value = selectedItems.value.filter(i => i.id !== entry.id)
      } else {
        selectedItems.value = [...selectedItems.value, entry]
      }
    } 
    // 3. Handle Single Selection
    else {
      shiftAnchor.value = entry
      selectedItems.value = [entry]
    }

    lastSelected.value = entry

    if (selectedItems.value.length === 1) {
      const ring = recentlyViewed.value.filter(e => e.id !== entry.id)
      recentlyViewed.value = [entry, ...ring].slice(0, 15)
    }

    if (!thumbCache[entry.id]) fetchThumb(entry)
  }

  function deselect() { selectedItems.value = []; fullMeta.value = null; lastSelected.value = null; shiftAnchor.value = null }

  async function fetchFullMeta(id: string) {
    const r = await window.api.invoke('item:get', id)
    fullMeta.value = r.entry
    return r.entry
  }

  async function updateItem(id: string, patch: Record<string, any>) {
    const r = await window.api.invoke('item:update', id, patch)
    if (fullMeta.value?.id === id) fullMeta.value = { ...fullMeta.value, ...patch }
    return r
  }

  async function deleteItem(id: string) {
    await window.api.invoke('item:delete', id)
    items.value = items.value.filter(i => i.id !== id)
    totalCount.value = Math.max(0, totalCount.value - 1)
    selectedItems.value = selectedItems.value.filter(i => i.id !== id)
    if (selectedItems.value.length === 0) fullMeta.value = null
    await refreshSidebarCounts()
  }

  async function restoreItem(id: string) {
    await window.api.invoke('item:restore', id)
    items.value = items.value.filter(i => i.id !== id)
    totalCount.value = Math.max(0, totalCount.value - 1)
    selectedItems.value = selectedItems.value.filter(i => i.id !== id)
    if (selectedItems.value.length === 0) fullMeta.value = null
    await refreshSidebarCounts()
  }

  async function purgeItem(id: string) {
    await window.api.invoke('item:purge', id)
    items.value = items.value.filter(i => i.id !== id)
    totalCount.value = Math.max(0, totalCount.value - 1)
    selectedItems.value = selectedItems.value.filter(i => i.id !== id)
    if (selectedItems.value.length === 0) fullMeta.value = null
    await refreshSidebarCounts()
  }

  async function findSimilar(id: string) {
    if (!libraryInfo.value) return
    isLoading.value = true
    try {
      const r = await window.api.invoke('search:similar', id)
      items.value = r.items
      totalCount.value = r.total
      
      r.items.forEach((e: IndexEntry) => {
        if (!thumbCache[e.id]) fetchThumb(e)
      })
    } finally {
      isLoading.value = false
    }
  }

  function getThumb(id: string): string | null { return thumbCache[id] ?? null }

  async function createFolder(name: string, parentId?: string | null) {
    const r = await window.api.invoke('folder:create', name, parentId ?? null)
    if (r.ok && libraryInfo.value)
      libraryInfo.value = { ...libraryInfo.value, folders: [...libraryInfo.value.folders, r.folder] }
    return r.folder
  }
  async function renameFolder(id: string, name: string) {
    await window.api.invoke('folder:rename', id, name)
    if (libraryInfo.value)
      libraryInfo.value = {
        ...libraryInfo.value,
        folders: libraryInfo.value.folders.map(f => f.id === id ? { ...f, name } : f)
      }
  }
  async function updateFolder(id: string, patch: any) {
    await window.api.invoke('folder:update', id, patch)
    if (libraryInfo.value)
      libraryInfo.value = {
        ...libraryInfo.value,
        folders: libraryInfo.value.folders.map(f => f.id === id ? { ...f, ...patch } : f)
      }
  }
  async function deleteFolder(id: string) {
    await window.api.invoke('folder:delete', id)
    if (libraryInfo.value) {
      const idsToDelete = new Set<string>([id])
      const collect = (parentId: string) => {
        for (const f of libraryInfo.value!.folders) {
          if (f.parentId === parentId && !idsToDelete.has(f.id)) {
            idsToDelete.add(f.id)
            collect(f.id)
          }
        }
      }
      collect(id)
      
      libraryInfo.value = {
        ...libraryInfo.value,
        folders: libraryInfo.value.folders.filter(f => !idsToDelete.has(f.id))
      }
    }
  }

  async function repairLibrary() {
    if (!libraryInfo.value) return
    return window.api.invoke('library:repair')
  }

  const watchFolders = ref<any[]>([])

  async function fetchWatchFolders() {
    watchFolders.value = await window.api.invoke('library:getWatchFolders')
  }

  async function setWatchFolder(folderId: string, osPath: string) {
    await window.api.invoke('library:setWatchFolder', folderId, osPath)
    await fetchWatchFolders()
  }

  async function removeWatchFolder(folderId: string) {
    await window.api.invoke('library:removeWatchFolder', folderId)
    await fetchWatchFolders()
  }

  return {
    libraryInfo, libraryPath, items, selectedItem, selectedItems, fullMeta, lastSelected,
    totalCount, isLoading, isRestoring, recentLibraries, importProgress, repairProgress, thumbCache,
    recentlyViewed, allTagsList, sidebarCounts, watchFolders,
    createLibrary, openLibrary, pickAndOpenLibrary, createNewLibrary, removeRecentLibrary,
    search, pickAndImport, pickAndImportFolders, importPaths, importFromUrl, autoTrashPurge, refreshSidebarCounts,
    selectItem, deselect, updateItem, deleteItem, restoreItem, purgeItem, findSimilar,
    fetchThumb, getThumb,
    createFolder, renameFolder, updateFolder, deleteFolder,
    restoreLastLibrary, repairLibrary,
    fetchWatchFolders, setWatchFolder, removeWatchFolder,
    fetchFullMeta
  }
})
