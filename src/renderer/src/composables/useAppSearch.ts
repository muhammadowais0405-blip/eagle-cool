import { ref, computed, watch, type Ref } from 'vue'
import { useLibrary } from './useLibrary'
import type { IndexEntry } from './useLibrary'
import { useUIStore } from '../stores/ui'
import { storeToRefs } from 'pinia'

export function useAppSearch() {
  const { 
    libraryInfo, items, recentlyViewed, search: rawSearch, findSimilar, refreshSidebarCounts 
  } = useLibrary()
  
  const uiStore = useUIStore()
  const { gridShowSubfolder } = storeToRefs(uiStore)

  // ─── State ──────────────────────────────────────────────────────────────────
  const searchText = ref('')
  const itemSortBy = ref('date')
  const itemSortDir = ref('desc')

  const activeView = ref<'all' | 'untagged' | 'recent' | 'alltags' | 'duplicates' | 'trash'>('all')
  const activeTag = ref<string | null>(null)
  const activeFolderId = ref<string | null>(null)
  const selectedFolderIds = ref<Set<string>>(new Set())
  
  const filters = ref({ ext: '', orientation: '', size: '', date: '', tag: '' })
  
  const folderSortMap = ref<Record<string, string>>({})

  // ─── Watchers ───────────────────────────────────────────────────────────────
  watch([itemSortBy, itemSortDir], () => { reloadCurrentView() })

  watch(gridShowSubfolder, () => {
    if (activeFolderId.value || selectedFolderIds.value.size > 0) reloadCurrentView()
  })

  // ─── Getters ────────────────────────────────────────────────────────────────
  const hasActiveFilters = computed(() => {
    return filters.value.ext || filters.value.orientation || filters.value.size || filters.value.date || filters.value.tag
  })

  // ─── Actions ────────────────────────────────────────────────────────────────
  function clearFilters() {
    filters.value = { ext: '', orientation: '', size: '', date: '', tag: '' }
    onFilterChange()
  }

  function onFilterChange() {
    reloadCurrentView()
  }

  function buildQuery() {
    const q: Record<string, any> = {}
    
    if (activeView.value === 'trash') q.isDeleted = true
    else q.isDeleted = false

    if (activeView.value === 'untagged') q.untagged = true
    if (activeView.value === 'alltags') q.tagged = true
    
    if (selectedFolderIds.value.size > 0) {
      if (gridShowSubfolder.value) {
        const allIds = new Set<string>(selectedFolderIds.value)
        const collect = (ids: string[]) => {
          for (const id of ids) {
            const children = libraryInfo.value?.folders?.filter(f => f.parentId === id) || []
            for (const child of children) {
              if (!allIds.has(child.id)) {
                allIds.add(child.id)
                collect([child.id])
              }
            }
          }
        }
        collect(Array.from(selectedFolderIds.value))
        q.folders = Array.from(allIds)
      } else {
        q.folders = Array.from(selectedFolderIds.value)
      }

      if (activeFolderId.value) {
        // We use the global itemSortBy instead of folderSortMap (which is for subfolders)
        q.sortBy = itemSortBy.value === 'date' ? 'importTime' : itemSortBy.value
        q.sortDir = itemSortDir.value
      }
    }

    if (!q.sortBy) {
      q.sortBy = itemSortBy.value === 'date' ? 'importTime' : itemSortBy.value
      q.sortDir = itemSortDir.value
    }
    if (activeTag.value) q.tags = [activeTag.value]
    if (searchText.value) q.text = searchText.value

    if (filters.value.ext) q.ext = [filters.value.ext]
    if (filters.value.orientation) q.orientation = [filters.value.orientation]
    if (filters.value.tag) {
      q.tags = q.tags ? [...q.tags, filters.value.tag] : [filters.value.tag]
    }

    if (filters.value.size) {
      const MB = 1024 * 1024
      if (filters.value.size === 'small') q.sizeMax = 1 * MB
      else if (filters.value.size === 'medium') { q.sizeMin = 1 * MB; q.sizeMax = 5 * MB }
      else if (filters.value.size === 'large') q.sizeMin = 5 * MB
    }

    if (filters.value.date) {
      const now = Date.now()
      const DAY = 24 * 60 * 60 * 1000
      if (filters.value.date === 'today') q.dateMin = now - DAY
      else if (filters.value.date === 'week') q.dateMin = now - 7 * DAY
      else if (filters.value.date === 'month') q.dateMin = now - 30 * DAY
      else if (filters.value.date === 'year') q.dateMin = now - 365 * DAY
    }

    return q
  }

  async function reloadCurrentView() {
    if (activeView.value === 'recent') {
      items.value = recentlyViewed.value.slice()
    } else if (activeView.value === 'duplicates') {
      const allR = await window.api.invoke('search:query', { limit: 100000 })
      const counts: Record<string, any[]> = {}
      for (const it of allR.items) {
        if (it.isDeleted) continue
        const key = it.phash ? `phash-${it.phash}` : `size-${it.size}`
        if (!counts[key]) counts[key] = []
        counts[key].push(it)
      }
      const dups: any[] = []
      for (const group of Object.values(counts)) if (group.length > 1) dups.push(...group)
      items.value = dups
    } else {
      await rawSearch(buildQuery())
    }
  }

  async function onFindSimilar(id: string) {
    activeView.value = 'all'
    activeFolderId.value = null
    selectedFolderIds.value.clear()
    activeTag.value = null
    searchText.value = ''
    await findSimilar(id)
  }

  let searchTimer: ReturnType<typeof setTimeout>
  function onSearch() {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      reloadCurrentView()
    }, 200)
  }

  async function setView(view: typeof activeView.value) {
    activeView.value = view
    activeFolderId.value = null
    selectedFolderIds.value.clear()
    activeTag.value = null
    await reloadCurrentView()
  }

  async function setFolder(id: string, deselect: () => void, multi: boolean = false) {
    if (multi) {
      if (selectedFolderIds.value.has(id)) {
        selectedFolderIds.value.delete(id)
        if (activeFolderId.value === id) {
          activeFolderId.value = Array.from(selectedFolderIds.value)[0] || null
        }
      } else {
        selectedFolderIds.value.add(id)
        activeFolderId.value = id
      }
    } else {
      activeFolderId.value = id
      selectedFolderIds.value.clear()
      selectedFolderIds.value.add(id)
      activeView.value = 'all'
      activeTag.value = null
      deselect()
    }
    await reloadCurrentView()
  }

  async function handleBatchUpdate() {
    await refreshSidebarCounts()
    if (activeFolderId.value || selectedFolderIds.value.size > 0) await reloadCurrentView()
  }

  return {
    searchText,
    itemSortBy,
    itemSortDir,
    activeView,
    activeTag,
    activeFolderId,
    selectedFolderIds,
    filters,
    folderSortMap,
    hasActiveFilters,
    
    clearFilters,
    onFilterChange,
    buildQuery,
    reloadCurrentView,
    onFindSimilar,
    onSearch,
    setView,
    setFolder,
    handleBatchUpdate
  }
}
