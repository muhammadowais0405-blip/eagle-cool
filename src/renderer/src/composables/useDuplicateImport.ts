import { ref, type Ref, unref } from 'vue'
import type { IndexEntry } from '../types'

/**
 * useDuplicateImport.ts
 * ──────────────────────
 * Wraps the normal import flow with duplicate detection.
 *
 * For each file being imported:
 *   1. Ask the main process whether this file is a duplicate.
 *   2. If not → import immediately.
 *   3. If yes → show <DuplicateDialog> and wait for the user's choice.
 *   4. Choice can be "Apply to all" to skip further prompts.
 */

export type Resolution = 'use_existing' | 'keep_both'

export interface ResolvePayload {
  resolution: Resolution
  applyToAll: boolean
}

export interface DupCandidate {
  srcPath: string
  name: string
  ext: string
  meta: string
  existing: IndexEntry
}

export function useDuplicateImport() {
  // ── UI State ───────────────────────────────────────────────────────────────
  const dialogOpen     = ref(false)
  const currentDup     = ref<DupCandidate | null>(null)
  const remainingDups  = ref(0) // Total count of duplicates in the batch

  // ── Internal Promise Control ───────────────────────────────────────────────
  let _resolve: ((payload: ResolvePayload) => void) | null = null
  let _reject:  ((err: any) => void) | null = null

  // ── Import Status (for the caller) ─────────────────────────────────────────
  const importedCount = ref(0)
  const skippedCount  = ref(0)
  const failedPaths   = ref<string[]>([])

  /**
   * core import function with duplicate logic
   */
  async function importWithDupCheck(paths: string[], folderIdInput: string | null | Ref<string | null>) {
    const folderId = unref(folderIdInput)
    
    // Reset status
    importedCount.value = 0
    skippedCount.value  = 0
    failedPaths.value   = []
    
    if (!paths.length) return

    // Pre-scan: find out which files are duplicates so we can show correct count
    const dupSet = new Set<string>()
    const nonDups: string[] = []
    
    for (const p of paths) {
      try {
        const existing = await window.api.invoke('item:checkDuplicate', p)
        if (existing) dupSet.add(p)
        else nonDups.push(p)
      } catch { /* skip check on error */ }
    }
    remainingDups.value = dupSet.size

    // 1. Import all non-duplicates in one batch immediately
    if (nonDups.length > 0) {
      try {
        const r = await window.api.invoke('item:import', {
          sourcePaths: nonDups,
          targetFolderId: folderId ?? undefined,
        })
        importedCount.value += (r?.succeeded?.length || 0)
      } catch (err) {
        console.error('Batch import failed', err)
        failedPaths.value.push(...nonDups)
      }
    }

    // 2. Process duplicates one by one (or via "Apply to All")
    let lockedResolution: Resolution | null = null
    let dupsLeft = dupSet.size

    for (const srcPath of dupSet) {
      try {
        const existing: IndexEntry | null = await window.api.invoke('item:checkDuplicate', srcPath)
        if (!existing) {
          dupsLeft--
          remainingDups.value = dupsLeft
          continue
        }

        // ── Duplicate found ────────────────────────────────────────────────
        remainingDups.value = dupsLeft--

        const candidate: DupCandidate = {
          srcPath,
          name: srcPath.split(/[\\/]/).pop() || 'Unknown',
          ext: srcPath.split('.').pop()?.toLowerCase() || '',
          meta: `Duplicate of existing item`,
          existing
        }

        let resolution: Resolution

        if (lockedResolution) {
          // User already chose "apply to all" — use it silently
          resolution = lockedResolution
        } else {
          // Prompt the user
          const payload = await promptUser(candidate)
          resolution = payload.resolution
          if (payload.applyToAll) {
            lockedResolution = resolution
          }
        }

        // Execute choice
        if (resolution === 'keep_both') {
          const r = await window.api.invoke('item:import', {
            sourcePaths: [srcPath],
            targetFolderId: folderId ?? undefined,
            force: true // Tells main process to ignore duplicate check and rename
          })
          importedCount.value += (r?.succeeded?.length || 0)
        } else {
          // 'use_existing' -> skip import
          skippedCount.value++
        }

      } catch (err) {
        console.error('Import failed for', srcPath, err)
        failedPaths.value.push(srcPath)
      }
    }

    // Done
    remainingDups.value = 0
    currentDup.value = null
  }

  /** Opens the file picker then runs the duplicate-aware import */
  async function pickAndImportWithDupCheck(folderId: string | null | Ref<string | null>) {
    const paths = await window.api.invoke('dialog:pickFiles')
    if (paths && paths.length > 0) {
      await importWithDupCheck(paths, folderId)
    }
  }

  // ── Internal Helpers ───────────────────────────────────────────────────────

  function promptUser(candidate: DupCandidate): Promise<ResolvePayload> {
    currentDup.value = candidate
    dialogOpen.value = true
    return new Promise((resolve, reject) => {
      _resolve = resolve
      _reject  = reject
    })
  }

  // ── Event handlers (bound to DuplicateDialog emits) ───────────────────────

  function onResolve(payload: ResolvePayload) {
    dialogOpen.value = false
    _resolve?.(payload)
    _resolve = null
    _reject  = null
  }

  function onCancel() {
    dialogOpen.value = false
    // Treat cancel as "use_existing" for this item, keep processing the rest
    _resolve?.({ resolution: 'use_existing', applyToAll: false })
    _resolve = null
    _reject  = null
  }

  return {
    // UI binding
    dialogOpen,
    currentDup,
    remainingCount: remainingDups,
    onResolve,
    onCancel,

    // Import methods
    importWithDupCheck,
    pickAndImportWithDupCheck,

    // Status
    importedCount,
    skippedCount,
    failedPaths,
  }
}
