import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import type { IndexEntry } from '../types'

export type ExportResolution = 'rename' | 'overwrite' | 'skip'

export interface ExportConflict {
  id: string
  name: string
  existingPath: string
}

export function useExport() {
  const isExporting = ref(false)
  const exportProgress = ref(0)
  const exportStatus = ref('')
  
  // Conflict (File Path) UI state
  const conflictDialogOpen = ref(false)
  const exportConflicts = ref<ExportConflict[]>([])
  const currentConflictIndex = ref(0)
  const currentConflict = computed(() => exportConflicts.value[currentConflictIndex.value] || null)
  const conflictResolutions = ref<Record<string, ExportResolution>>({})
  
  // Enhanced Version UI state
  const exportDialogOpen = ref(false)
  const enhancedItems = ref<IndexEntry[]>([])
  const currentEnhancedIndex = ref(0)
  const currentEnhancedItem = computed(() => enhancedItems.value[currentEnhancedIndex.value] || null)
  const enhancedResolutions = ref<Record<string, 'original' | 'enhanced'>>({})
  
  let _dialogResolve: ((val: any) => void) | null = null

  async function startExport(items: IndexEntry[]) {
    if (!items.length) return
    const ids = items.map(i => i.id)

    const targetDir = await window.api.invoke('dialog:pickExportFolder')
    if (!targetDir) return

    isExporting.value = true
    exportProgress.value = 0
    exportStatus.value = 'Checking for conflicts...'

    try {
      // 1. Resolve File Path Conflicts
      const foundConflicts = await window.api.invoke('item:checkExportConflicts', ids, targetDir)
      conflictResolutions.value = {}
      
      if (foundConflicts.length > 0) {
        exportConflicts.value = foundConflicts
        currentConflictIndex.value = 0
        conflictDialogOpen.value = true
        
        let applyAllConflict: ExportResolution | null = null

        while (currentConflictIndex.value < exportConflicts.value.length) {
          const c = exportConflicts.value[currentConflictIndex.value]
          
          if (applyAllConflict) {
            conflictResolutions.value[c.id] = applyAllConflict
            currentConflictIndex.value++
            continue
          }

          const choice = await new Promise<{ resolution: ExportResolution, applyToAll: boolean }>((resolve) => {
            _dialogResolve = resolve
          })

          conflictResolutions.value[c.id] = choice.resolution
          if (choice.applyToAll) {
            applyAllConflict = choice.resolution
          }
          currentConflictIndex.value++
        }
        conflictDialogOpen.value = false
      }

      // 2. Resolve Enhanced Versions
      enhancedItems.value = items.filter(i => (i as any).hasEnhanced || (i as any)._isEnhanced)
      enhancedResolutions.value = {}
      
      if (enhancedItems.value.length > 0) {
        currentEnhancedIndex.value = 0
        exportDialogOpen.value = true
        
        let applyAllEnhanced: 'original' | 'enhanced' | null = null

        while (currentEnhancedIndex.value < enhancedItems.value.length) {
          const item = enhancedItems.value[currentEnhancedIndex.value]
          
          if (applyAllEnhanced) {
            enhancedResolutions.value[item.id] = applyAllEnhanced
            currentEnhancedIndex.value++
            continue
          }

          const choice = await new Promise<{ resolution: 'original' | 'enhanced', applyToAll: boolean }>((resolve) => {
            _dialogResolve = resolve
          })

          enhancedResolutions.value[item.id] = choice.resolution
          if (choice.applyToAll) {
            applyAllEnhanced = choice.resolution
          }
          currentEnhancedIndex.value++
        }
        exportDialogOpen.value = false
      }

      // 3. Start actual export
      console.log('Starting export with:', { 
        ids, targetDir, 
        conflictResolutions: conflictResolutions.value, 
        enhancedResolutions: enhancedResolutions.value 
      })
      
      const toastId = toast.loading(`Exporting ${ids.length} items...`, {
        description: 'Preparing files...'
      })

      const stopListen = window.api.on('event:export-progress', (p: any) => {
        exportProgress.value = (p.done / p.total) * 100
        exportStatus.value = `Exporting: ${p.current}`
        toast.loading(`Exporting (${p.done}/${p.total})`, {
          id: toastId,
          description: p.current
        })
      })

      try {
        const results = await window.api.invoke(
          'item:export', 
          JSON.parse(JSON.stringify(ids)), 
          targetDir, 
          JSON.parse(JSON.stringify(conflictResolutions.value)), 
          JSON.parse(JSON.stringify(enhancedResolutions.value))
        )
        toast.success('Export Complete', {
          id: toastId,
          description: `Succeeded: ${results.succeeded}, Failed: ${results.failed}, Skipped: ${results.skipped}`
        })
      } finally {
        stopListen()
      }

    } catch (err: any) {
      toast.error('Export Failed', { description: err.message })
      exportDialogOpen.value = false
      conflictDialogOpen.value = false
    } finally {
      isExporting.value = false
    }
  }

  function resolveDialog(payload: any) {
    if (_dialogResolve) _dialogResolve(payload)
  }

  function cancelExport() {
  exportDialogOpen.value = false
  conflictDialogOpen.value = false
  isExporting.value = false
  if (_dialogResolve) {
    _dialogResolve({ cancelled: true, resolution: 'skip', applyToAll: false })
    _dialogResolve = null
  }
}

  return {
    isExporting,
    exportProgress,
    exportStatus,
    // Enhanced Dialog
    exportDialogOpen,
    currentEnhancedItem,
    enhancedRemainingCount: computed(() => enhancedItems.value.length - currentEnhancedIndex.value),
    // Conflict Dialog
    conflictDialogOpen,
    currentConflict,
    conflictRemainingCount: computed(() => exportConflicts.value.length - currentConflictIndex.value),
    
    startExport,
    resolveDialog,
    cancelExport
  }
}
