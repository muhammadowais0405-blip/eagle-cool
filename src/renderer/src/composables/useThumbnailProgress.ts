import { ref, computed, onBeforeUnmount } from 'vue'
import { toast } from 'vue-sonner'

// Module-level shared state (singleton) so all consumers see the same processing state
const processingIds = ref<Set<string>>(new Set())
const completedCount = ref(0)
const totalCount = ref(0)
const lastBatchRecovered = ref(0)
const lastBatchFailed = ref(0)

let initialized = false
let unsubProgress: (() => void) | null = null
let unsubRecovered: (() => void) | null = null
let unsubRecoveredBatch: (() => void) | null = null
let unsubFailed: (() => void) | null = null
let unsubItemUpdated: (() => void) | null = null

/**
 * Initialize global listeners (called once, idempotent).
 * Subscribes to thumbnail:progress, thumbnail:recovered, thumbnail:recovered-batch,
 * thumbnail:failed, and also watches event:item-updated to keep the processing set
 * in sync with thumbnailStatus changes that arrive via LibraryManager.updateItem().
 */
function init() {
  if (initialized) return
  initialized = true

  // Per-item progress: { id, stage, percent, message }
  unsubProgress = window.api.on('event:thumbnail-progress', (p: any) => {
    if (!p || !p.id) return
    if (p.stage === 'start' || p.stage === 'processing') {
      processingIds.value = new Set(processingIds.value).add(p.id)
    } else if (p.stage === 'done' || p.stage === 'failed' || p.stage === 'complete') {
      const next = new Set(processingIds.value)
      next.delete(p.id)
      processingIds.value = next
    }
  })

  // Single-item recovered event
  unsubRecovered = window.api.on('event:thumbnail-recovered', (p: any) => {
    if (!p) return
    const name = p.name || 'video'
    toast.success('Thumbnail recovered', {
      description: `Retried and generated: ${name}`,
      duration: 3500
    })
  })

  // Batched recovered events (flushed every 2s in main process)
  unsubRecoveredBatch = window.api.on('event:thumbnail-recovered-batch', (batch: any) => {
    if (!batch || !Array.isArray(batch.events) || batch.events.length === 0) return
    const n = batch.events.length
    lastBatchRecovered.value = n
    toast.success(`Recovered ${n} video${n === 1 ? '' : 's'}`, {
      description:
        n === 1
          ? 'Generated on retry.'
          : `Generated on retry after initial failure.`,
      duration: 4500
    })
  })

  // Failed event
  unsubFailed = window.api.on('event:thumbnail-failed', (p: any) => {
    if (!p) return
    const id = p.id
    if (id) {
      const next = new Set(processingIds.value)
      next.delete(id)
      processingIds.value = next
    }
    if (Array.isArray(p.batch) && p.batch.length > 0) {
      const n = p.batch.length
      lastBatchFailed.value = n
      toast.error(`Failed: ${n} video${n === 1 ? '' : 's'}`, {
        description: 'Could not generate a thumbnail. Click the item to retry.',
        duration: 5000
      })
    } else {
      const name = p.name || 'video'
      toast.error('Thumbnail failed', {
        description: `Could not generate: ${name}`,
        duration: 5000
      })
    }
  })

  // Also react to item:updated so when LibraryManager.updateItem sets
  // thumbnailStatus to 'processing' or 'completed', we mirror that locally
  // even if we missed the progress event (e.g., event arrived before listener).
  unsubItemUpdated = window.api.on('event:item-updated', (item: any) => {
    if (!item || !item.id) return
    if (item.thumbnailStatus === 'processing') {
      const next = new Set(processingIds.value)
      next.add(item.id)
      processingIds.value = next
    } else if (item.thumbnailStatus === 'completed' || item.thumbnailStatus === 'failed') {
      const next = new Set(processingIds.value)
      next.delete(item.id)
      processingIds.value = next
    }
  })
}

function dispose() {
  if (unsubProgress) { unsubProgress(); unsubProgress = null }
  if (unsubRecovered) { unsubRecovered(); unsubRecovered = null }
  if (unsubRecoveredBatch) { unsubRecoveredBatch(); unsubRecoveredBatch = null }
  if (unsubFailed) { unsubFailed(); unsubFailed = null }
  if (unsubItemUpdated) { unsubItemUpdated(); unsubItemUpdated = null }
  initialized = false
}

export function useThumbnailProgress() {
  // Lazy init on first call
  if (!initialized) init()

  const isProcessing = computed(() => processingIds.value.size > 0)
  const processingCount = computed(() => processingIds.value.size)

  function isItemProcessing(id: string): boolean {
    return processingIds.value.has(id)
  }

  function clear() {
    processingIds.value = new Set()
    completedCount.value = 0
    totalCount.value = 0
  }

  function setTotal(n: number) {
    totalCount.value = n
    completedCount.value = 0
  }

  function bumpCompleted() {
    completedCount.value++
  }

  onBeforeUnmount(() => {
    // Don't dispose on per-component unmount; the listeners should live for
    // the app's lifetime so the singleton state is stable.
  })

  return {
    isProcessing,
    processingCount,
    processingIds,
    isItemProcessing,
    completedCount,
    totalCount,
    lastBatchRecovered,
    lastBatchFailed,
    setTotal,
    bumpCompleted,
    clear,
    _dispose: dispose  // for tests / hot-reload
  }
}
