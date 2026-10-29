import { ref } from 'vue'
import { useLibrary } from './useLibrary'

export interface UndoEntry {
  type: 'delete'
  ids: string[]
}

export function useAppShortcuts(options: {
  activeView: any,
  selectedItems: any,
  items: any,
  lastSelected: any,
  activeFolderId: any,
  folders: any,
  quickViewOpen: any,
  folderCtxMenu: any,
  libraryInfo: any,
  detailItemId: any,
  reloadCurrentView: () => Promise<void>,
  deselect: () => void,
  selectItem: (item: any, multi: boolean, range: boolean) => void,
  onDeleteSelection: () => void,
  onPermanentDeleteSelection: () => void,
  togglePanels: () => void,
  promptNewFolder: (parentId?: string | null) => void,
  startRenameFolder: (folder: any) => void,
  importWithDupCheck: (paths: string[], folderId: any) => Promise<void>,
  closeDetailView: () => void,
  nextDetailItem: () => void,
  prevDetailItem: () => void,
  ctxWatchFolder: () => void,
  ctxStopWatching: () => void,
  ctxMoveFolder?: () => void
}) {
  const { 
    restoreItem, deleteItem, updateItem, importPaths 
  } = useLibrary()

  // ─── State ──────────────────────────────────────────────────────────────────
  const undoStack = ref<UndoEntry[]>([])
  const redoStack = ref<UndoEntry[]>([])
  const MAX_UNDO = 30
  
  const internalClipboard = ref<{ type: 'items', ids: string[] } | null>(null)
  
  const tooltip = ref({ visible: false, text: '', x: 0, y: 0 })
  let tooltipTimer: ReturnType<typeof setTimeout> | null = null

  // ─── Actions ────────────────────────────────────────────────────────────────
  function pushUndo(entry: UndoEntry) {
    undoStack.value.push(entry)
    if (undoStack.value.length > MAX_UNDO) undoStack.value.shift()
    redoStack.value = []
  }

  async function undoLast() {
    const entry = undoStack.value.pop()
    if (!entry) return
    try {
      if (entry.type === 'delete') {
        for (const id of entry.ids) await restoreItem(id)
        redoStack.value.push(entry)
        await options.reloadCurrentView()
      }
    } catch (e) {
      console.error('Undo failed:', e)
    }
  }

  async function redoLast() {
    const entry = redoStack.value.pop()
    if (!entry) return
    try {
      if (entry.type === 'delete') {
        for (const id of entry.ids) await deleteItem(id)
        undoStack.value.push(entry)
        await options.reloadCurrentView()
      }
    } catch (e) {
      console.error('Redo failed:', e)
    }
  }

  async function handleInternalPaste() {
    if (internalClipboard.value?.type === 'items') {
      const ids = internalClipboard.value.ids
      let changed = false
      const pathsToDuplicate: string[] = []

      for (const id of ids) {
        let it = options.items.value.find((i: any) => i.id === id)
        if (!it) {
          const res = await window.api.invoke('item:get', id)
          it = res?.entry
        }
        
        if (it) {
          if (options.activeFolderId.value) {
            let newFolders = [...it.folders]
            if (!newFolders.includes(options.activeFolderId.value)) {
              newFolders.push(options.activeFolderId.value)
              await updateItem(id, { folders: newFolders })
              changed = true
            } else {
              pathsToDuplicate.push(it.contentPath)
            }
          } else {
            pathsToDuplicate.push(it.contentPath)
          }
        }
      }
      if (changed) {
        await options.reloadCurrentView()
      }
      if (pathsToDuplicate.length > 0) {
        await importPaths(pathsToDuplicate, options.activeFolderId.value ?? undefined)
        await options.reloadCurrentView()
      }
    }
  }

  function onGlobalPaste(e: ClipboardEvent) {
    if (!options.libraryInfo.value) return
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
    
    if (internalClipboard.value) {
      handleInternalPaste()
      return
    }

    let paths = Array.from(e.clipboardData?.files ?? []).map((f: any) => f.path).filter(Boolean)
    if (paths.length === 0) {
      const textPayload = e.clipboardData?.getData('text') || ''
      const lines = textPayload.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length > 0 && lines.every(l => /^([A-Za-z]:[\\/]|\/)/.test(l))) {
        paths = lines
      }
    }

    if (paths.length) {
      options.importWithDupCheck(paths, options.activeFolderId.value).then(() => options.reloadCurrentView())
      return
    }

    window.api.invoke('clipboard:readImage').then((tempPath: string | null) => {
      if (tempPath) {
        importPaths([tempPath], options.activeFolderId.value ?? undefined, true).then(() => {
          options.reloadCurrentView()
        })
      }
    }).catch(console.error)
  }

  function onGlobalKeydown(e: KeyboardEvent) {
    if (!options.libraryInfo.value) return
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

    if (e.key === 'Tab') {
      e.preventDefault()
      options.togglePanels()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'w') {
      e.preventDefault()
      options.ctxWatchFolder()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'w') {
      e.preventDefault()
      options.ctxStopWatching()
      return
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      if (options.selectedItems.value.length > 0) {
        e.preventDefault()
        internalClipboard.value = { type: 'items', ids: options.selectedItems.value.map((i: any) => i.id) }
        const filePaths = options.selectedItems.value.map((i: any) => i.contentPath).filter(Boolean)
        if (filePaths.length > 0) {
          window.api.invoke('clipboard:writeFiles', filePaths).catch(console.error)
        }
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
      e.preventDefault()
      options.ctxMoveFolder?.()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault()
      window.api.invoke('dialog:pickFiles').then((paths: string[]) => {
        if (paths && paths.length > 0) {
          options.importWithDupCheck(paths, options.activeFolderId.value).then(() => options.reloadCurrentView())
        }
      })
      return
    }

    if (e.key.toLowerCase() === 'f' || e.key === '/') {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        const searchInput = document.querySelector('.search-input') as HTMLInputElement
        searchInput?.focus()
        return
      }
    }

    if (e.key === 'Escape') {
      if (options.detailItemId.value) options.closeDetailView()
      else if (options.quickViewOpen.value) options.quickViewOpen.value = false
      else if (options.folderCtxMenu.value.open) options.folderCtxMenu.value.open = false
      else if (document.activeElement?.tagName === 'INPUT') (document.activeElement as HTMLElement).blur()
      return
    }

    if (e.key === 'Enter') {
      if (options.selectedItems.value.length === 1) {
        e.preventDefault()
        window.api.invoke('shell:openPath', options.selectedItems.value[0].contentPath)
      }
      return
    }
    
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      options.promptNewFolder()
      return
    }

    if (e.altKey && e.key.toLowerCase() === 'n') {
      if (options.activeFolderId.value) {
        e.preventDefault()
        options.promptNewFolder(options.activeFolderId.value)
      }
      return
    }
    
    if (e.key === 'F2') {
      e.preventDefault()
      const activeFolder = options.activeFolderId.value ? options.folders.value.find((f: any) => f.id === options.activeFolderId.value) ?? null : null
      if (activeFolder) options.startRenameFolder(activeFolder)
      return
    }

    if (e.key === 'Space' || e.key === ' ') {
      if (options.detailItemId.value) return // Let DetailView handle space bar
      e.preventDefault()
      if (options.selectedItems.value.length === 1) {
        options.quickViewOpen.value = !options.quickViewOpen.value
      }
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      undoLast()
      return
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      redoLast()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault()
      if (options.items.value.length > 0) {
        options.selectedItems.value = [...options.items.value]
      }
      return
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (options.selectedItems.value.length > 0) {
        if (e.shiftKey) {
          options.onPermanentDeleteSelection()
        } else {
          if (options.activeView.value === 'trash') options.onPermanentDeleteSelection()
          else options.onDeleteSelection()
        }
      }
    }

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      if (options.detailItemId.value) return // Allow DetailView's own keyboard handler to take effect
      e.preventDefault()
      if (options.items.value.length === 0) return

      let targetIndex = 0
      if (options.lastSelected.value) {
        const currentIndex = options.items.value.findIndex((i: any) => i.id === options.lastSelected.value!.id)
        if (currentIndex !== -1) {
          if (e.key === 'ArrowLeft') {
            targetIndex = currentIndex - 1
          } else if (e.key === 'ArrowRight') {
            targetIndex = currentIndex + 1
          } else {
            // Grid vertical movement
            // Try to find the actual grid element to determine columns
            const gridEl = document.querySelector('.vg-scroll')
            let cols = 1
            if (gridEl) {
              const card = gridEl.querySelector('.vg-card')
              if (card) {
                const cardWidth = card.getBoundingClientRect().width
                const gridWidth = gridEl.getBoundingClientRect().width - 32 // account for padding
                cols = Math.floor(gridWidth / (cardWidth || 200)) || 1
              }
            }
            if (e.key === 'ArrowUp') targetIndex = currentIndex - cols
            else targetIndex = currentIndex + cols
          }
        }
      }

      targetIndex = Math.max(0, Math.min(options.items.value.length - 1, targetIndex))
      const targetItem = options.items.value[targetIndex]
      options.selectItem(targetItem, false, e.shiftKey)

      setTimeout(() => {
        const el = document.querySelector(`[data-id="${targetItem.id}"]`)
        if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }, 0)
    }
  }

  function onGlobalMouseOver(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement
    if (target) {
      const text = target.getAttribute('data-tooltip')
      if (!text) return
      if (tooltipTimer) clearTimeout(tooltipTimer)
      tooltipTimer = setTimeout(() => {
        const rect = target.getBoundingClientRect()
        let x = rect.left + rect.width / 2
        let y = rect.bottom + 8
        if (x < 60) x = 60
        if (x > window.innerWidth - 60) x = window.innerWidth - 60
        if (y > window.innerHeight - 30) y = rect.top - 24 - 8
        tooltip.value = { visible: true, text, x, y }
      }, 300)
    }
  }
  
  function onGlobalMouseOut() {
    if (tooltipTimer) clearTimeout(tooltipTimer)
    tooltip.value.visible = false
  }

  return {
    undoStack,
    redoStack,
    internalClipboard,
    tooltip,
    pushUndo,
    undoLast,
    redoLast,
    onGlobalPaste,
    onGlobalKeydown,
    onGlobalMouseOver,
    onGlobalMouseOut
  }
}
