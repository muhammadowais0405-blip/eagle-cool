import { ref, computed, watch, type Ref } from 'vue'
import { useLibrary } from './useLibrary'
import type { FolderRecord } from './useLibrary'

export interface DerivedFolder extends FolderRecord {
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

export function useAppFolders() {
  const { 
    libraryInfo, libraryPath, sidebarCounts, 
    createFolder: storeCreateFolder, 
    renameFolder: storeRenameFolder, 
    updateFolder: storeUpdateFolder, 
    deleteFolder: storeDeleteFolder 
  } = useLibrary()

  // ─── State ──────────────────────────────────────────────────────────────────
  const expandedFolders = ref<Set<string>>(new Set())
  const folderSortMap = ref<Record<string, string>>({})
  
  const isCreatingFolder = ref(false)
  const newFolderName = ref('')
  const pendingSubfolderParentId = ref<string | null>(null)
  
  const renamingFolderId = ref<string | null>(null)
  const renameFolderName = ref('')
  
  const folderDragTargetId = ref<string | null>(null)
  const folderDropPosition = ref<'before' | 'inside' | 'after'>('inside')
  let folderDragHoverTimer: ReturnType<typeof setTimeout> | null = null
  let currentHoverId: string | null = null

  const subfolderThumbCache = ref<Record<string, string[]>>({})

  // ─── Getters ────────────────────────────────────────────────────────────────
  const folders = computed(() => libraryInfo.value?.folders ?? [])

  const pinnedFolders = computed(() => folders.value.filter(f => f.isPinned))

  const derivedFolders = computed(() => {
    const allFolders = folders.value
    const rootFolders = allFolders.filter(f => !f.parentId)
    const result: DerivedFolder[] = []

    function traverse(parentFolders: FolderRecord[], depth: number, parentId: string | null) {
      let sorted = [...parentFolders]
      const sortKey = parentId || 'root'
      const sortVal = folderSortMap.value[sortKey]
      
      if (sortVal) {
        sorted.sort((a, b) => {
          if (sortVal === 'date') return (b.createdAt || 0) - (a.createdAt || 0)
          if (sortVal === 'size') {
            const countA = sidebarCounts.value.folders[a.id] || 0
            const countB = sidebarCounts.value.folders[b.id] || 0
            return countB - countA
          }
          if (sortVal === 'name') return a.name.localeCompare(b.name)
          
          const idxA = a.sortIndex ?? a.createdAt
          const idxB = b.sortIndex ?? b.createdAt
          return idxA - idxB
        })
      } else {
        sorted.sort((a, b) => (a.sortIndex ?? a.createdAt) - (b.sortIndex ?? b.createdAt))
      }

      for (const f of sorted) {
        const children = allFolders.filter(child => child.parentId === f.id)
        const hasChildren = children.length > 0
        const isExpanded = expandedFolders.value.has(f.id)
        
        result.push({ ...f, depth, hasChildren, isExpanded })
        
        if (hasChildren && isExpanded) {
          traverse(children, depth + 1, f.id)
        }
      }
    }

    traverse(rootFolders, 0, null)
    return result
  })

  // ─── Watchers ───────────────────────────────────────────────────────────────
  watch(libraryPath, () => {
    subfolderThumbCache.value = {}
  })

  // ─── Actions ────────────────────────────────────────────────────────────────
  function toggleFolderExpand(id: string) {
    if (expandedFolders.value.has(id)) expandedFolders.value.delete(id)
    else expandedFolders.value.add(id)
  }

  async function promptNewFolder(parentId: string | null = null) {
    isCreatingFolder.value = true
    pendingSubfolderParentId.value = parentId
    newFolderName.value = parentId ? 'New Subfolder' : 'New Folder'
    if (parentId) expandedFolders.value.add(parentId)
  }

  async function submitNewFolder() {
    const name = newFolderName.value.trim()
    if (name) await storeCreateFolder(name, pendingSubfolderParentId.value)
    isCreatingFolder.value = false
    pendingSubfolderParentId.value = null
  }

  function cancelNewFolder() {
    isCreatingFolder.value = false
    pendingSubfolderParentId.value = null
  }

  function startRenameFolder(folder: FolderRecord) {
    renamingFolderId.value = folder.id
    renameFolderName.value = folder.name
  }

  async function submitRenameFolder() {
    if (!renamingFolderId.value) return
    const fId = renamingFolderId.value
    const newName = renameFolderName.value.trim()
    renamingFolderId.value = null
    
    if (newName.length > 0) {
      await storeRenameFolder(fId, newName)
    }
  }

  function cancelRenameFolder() {
    renamingFolderId.value = null
  }

  function handleFolderDragHover(folderId: string) {
    if (expandedFolders.value.has(folderId)) return
    if (currentHoverId === folderId) return
    
    if (folderDragHoverTimer) clearTimeout(folderDragHoverTimer)
    currentHoverId = folderId
    
    folderDragHoverTimer = setTimeout(() => {
      if (folderDragTargetId.value === folderId) {
        expandedFolders.value.add(folderId)
      }
      currentHoverId = null
    }, 500)
  }

  function clearFolderDragState() {
    if (folderDragHoverTimer) clearTimeout(folderDragHoverTimer)
    currentHoverId = null
    folderDragTargetId.value = null
    folderDropPosition.value = 'inside'
  }

  return {
    folders,
    pinnedFolders,
    derivedFolders,
    expandedFolders,
    folderSortMap,
    isCreatingFolder,
    newFolderName,
    pendingSubfolderParentId,
    renamingFolderId,
    renameFolderName,
    folderDragTargetId,
    folderDropPosition,
    subfolderThumbCache,
    
    toggleFolderExpand,
    promptNewFolder,
    submitNewFolder,
    cancelNewFolder,
    startRenameFolder,
    submitRenameFolder,
    cancelRenameFolder,
    handleFolderDragHover,
    clearFolderDragState,
    
    // Pass through store actions
    createFolder: storeCreateFolder,
    renameFolder: storeRenameFolder,
    updateFolder: storeUpdateFolder,
    deleteFolder: storeDeleteFolder
  }
}
