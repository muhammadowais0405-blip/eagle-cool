import { storeToRefs } from 'pinia'
import { useLibraryStore } from '../stores/library'
import type { IndexEntry, FolderRecord, LibraryManifest, RecentLibrary } from '../stores/library'

export type { IndexEntry, FolderRecord, LibraryManifest, RecentLibrary }

export function useLibrary() {
  const store = useLibraryStore()
  
  // Use storeToRefs to maintain reactivity for state and getters
  const refs = storeToRefs(store)

  return {
    ...refs,
    // Actions are already regular functions, no need for storeToRefs
    createLibrary: store.createLibrary,
    openLibrary: store.openLibrary,
    pickAndOpenLibrary: store.pickAndOpenLibrary,
    createNewLibrary: store.createNewLibrary,
    removeRecentLibrary: store.removeRecentLibrary,
    search: store.search,
    pickAndImport: store.pickAndImport,
    pickAndImportFolders: store.pickAndImportFolders,
    importPaths: store.importPaths,
    importFromUrl: store.importFromUrl,
    autoTrashPurge: store.autoTrashPurge,
    refreshSidebarCounts: store.refreshSidebarCounts,
    selectItem: store.selectItem,
    deselect: store.deselect,
    updateItem: store.updateItem,
    deleteItem: store.deleteItem,
    restoreItem: store.restoreItem,
    purgeItem: store.purgeItem,
    findSimilar: store.findSimilar,
    fetchThumb: store.fetchThumb,
    getThumb: store.getThumb,
    createFolder: store.createFolder,
    renameFolder: store.renameFolder,
    updateFolder: store.updateFolder,
    deleteFolder: store.deleteFolder,
    repairLibrary: store.repairLibrary,
    fetchWatchFolders: store.fetchWatchFolders,
    setWatchFolder: store.setWatchFolder,
    removeWatchFolder: store.removeWatchFolder,
    fetchFullMeta: store.fetchFullMeta,
  }
}

export async function restoreLastLibrary() {
  const store = useLibraryStore()
  return store.restoreLastLibrary()
}
