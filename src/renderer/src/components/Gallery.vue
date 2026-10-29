<template>
  <div class="gallery-wrapper" style="flex: 1; display: flex; flex-direction: column; min-height: 0; position: relative;">
    <main class="gallery" ref="dropZoneRef"
          :style="{ overflowY: activeLayout === 'grid' ? 'hidden' : 'auto', padding: activeLayout === 'grid' ? '0' : '16px', display: 'flex', flexDirection: 'column' }"
          @mousedown="onGalleryMouseDown">
      
      <!-- Premium Drop Overlay (VueUse Motion + Core) -->
      <Transition name="overlay-fade">
        <div v-if="isOverDropZone" class="drag-overlay active">
          <div class="drag-overlay-content"
               v-motion
               :initial="{ y: 20, opacity: 0, scale: 0.95 }"
               :enter="{ y: 0, opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 20 } }">
            <div class="drag-icon-ring">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </div>
            <h2>Drop files or images to import</h2>
            <p>Your media will be added to the current library</p>
          </div>
        </div>
      </Transition>

      <div v-if="items.length === 0 && !isLoading" class="empty-state" @click.self="emit('deselect')">
        <div class="empty-icon">
          <!-- Trash -->
          <svg v-if="activeView==='trash'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-svg"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          <!-- Untagged -->
          <svg v-else-if="activeView==='untagged'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-svg"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
          <!-- Recent -->
          <svg v-else-if="activeView==='recent'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-svg"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <!-- Duplicates -->
          <svg v-else-if="activeView==='duplicates'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-svg"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <!-- All Tags -->
          <svg v-else-if="activeView==='alltags'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-svg"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          <!-- Default -->
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-svg"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        </div>
        <p class="empty-title">
          <span v-if="activeView==='trash'">Trash is empty</span>
          <span v-else-if="activeView==='untagged'">All items are tagged</span>
          <span v-else-if="activeView==='recent'">No recently viewed items</span>
          <span v-else-if="activeView==='duplicates'">No duplicates found</span>
          <span v-else-if="activeView==='alltags'">No items tagged "{{ activeTag }}"</span>
          <span v-else>Nothing here yet</span>
        </p>
        <p class="empty-sub" v-if="activeView==='all'">Drop files here or click Import</p>
        <p class="empty-sub" v-if="activeView==='trash'">Items auto-delete permanently after 30 days</p>
        <button v-if="activeView==='all'" class="empty-btn" @click="emit('import')">Import Files</button>
      </div>

      <div v-if="activeView === 'trash' && selectedItems.length > 0" style="padding-bottom: 16px; display: flex; justify-content: flex-end; gap: 8px; padding-right: 16px;">
        <button class="action-btn action-btn--restore" style="width:auto; padding: 6px 14px; background: rgba(50,200,100,0.15); border-color: #3cc870; color: #3cc870;" @click="emit('restore-selection')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          Restore {{ selectedItems.length === 1 ? 'Item' : 'Selected' }}
        </button>
        <button class="action-btn action-btn--danger" style="width:auto; padding: 6px 14px; background: rgba(255,80,80,0.15); border-color: #ff5f57; color: #ff5f57; margin-top: 0;" @click="emit('purge-selection')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"></path></svg>
          Delete Permanently
        </button>
      </div>

      <div v-if="importProgress" class="import-bar">
        <div class="import-fill" :style="{ width: (importProgress.done/importProgress.total*100)+'%' }"></div>
      </div>
      
      <!-- ── Subfolders section: Vue Teleport moves this DOM into the
           VirtualGrid's banner slot when the grid is ready (so it scrolls
           away naturally with the content). When the grid is gone (e.g. in
           list layout, or no items), :disabled keeps it in-place. -->
      <Teleport :to="bannerSlotEl" :disabled="!bannerSlotEl">
        <div v-if="activeFolderId && childFolders.length" class="subfolder-section">
          <div class="subfolder-header">
            <span class="subfolder-title">Subfolder ({{ childFolders.length }})</span>
            <label class="subfolder-toggle">
              <input type="checkbox" v-model="_gridShowSubfolder" class="dup-check" />
              <span>Show subfolder contents</span>
            </label>
          </div>
          <div class="subfolder-grid">
            <div
              v-for="sf in childFolders" :key="sf.id"
              class="sfcard"
              @click="emit('set-folder', sf.id)"
              @dblclick="emit('set-folder', sf.id)"
            >
              <!-- Preview mosaic: up to 4 thumbs from items in that folder -->
              <div class="sfcard-thumb">
                <template v-if="folderPreviewThumbs(sf.id).length">
                  <div class="sfcard-mosaic" :class="'sfcard-mosaic--' + folderPreviewThumbs(sf.id).length">
                    <img
                      v-for="(src, i) in folderPreviewThumbs(sf.id)" :key="i"
                      :src="src" class="sfcard-mosaic-img"
                    />
                  </div>
                </template>
                <div v-else class="sfcard-empty-ico">
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 12a2 2 0 012-2h10l4 4h18a2 2 0 012 2v20a2 2 0 01-2 2H8a2 2 0 01-2-2V12z"/>
                  </svg>
                </div>
                <!-- Folder badge top-left -->
                <span class="sfcard-badge">
                  <svg viewBox="0 0 12 12" fill="currentColor" style="width:9px;height:9px;margin-right:3px;opacity:.7"><path d="M1 2a1 1 0 011-1h3l1.5 1.5H10a1 1 0 011 1V9a1 1 0 01-1 1H2a1 1 0 01-1-1V2z"/></svg>
                  FOLDER
                </span>
              </div>
              <div class="sfcard-footer">
                <div class="sfcard-name">{{ sf.name }}</div>
                <div class="sfcard-count">{{ sidebarCounts.folders[sf.id] || 0 }} items</div>
              </div>
            </div>
          </div>
        </div>
      </Teleport>



      <!-- ── Virtual Grid Layout (handles grid, justified, list, waterfall) ──────── -->
      <div v-show="items.length && activeLayout !== 'list'" 
           class="vg-wrapper" 
           :class="{ 'hide-vg-name': !gridShowName, 'hide-vg-res': !gridShowItemInfo }"
           ref="virtualGridContainer" 
           style="flex: 1; min-height: 0; position: relative;">
      </div>

      <!-- ── List Layout Header (stays static, list rows are virtualized) ──────── -->
      <template v-if="activeLayout === 'list' && items.length">
        <div class="list-header">
          <div class="lh-thumb"></div>
          <div class="lh-name">Name</div>
          <div class="lh-size">Size</div>
          <div class="lh-format">Format</div>
          <div class="lh-date">Date Added</div>
        </div>
        <div class="vg-wrapper vg-list-wrapper"
             :class="{ 'hide-vg-name': !gridShowName, 'hide-vg-res': !gridShowItemInfo }"
             ref="listGridContainer"
             style="flex: 1; min-height: 0; position: relative;">
        </div>
      </template>


      <!-- All non-list layouts (grid, justified, waterfall) are handled by the VirtualGrid engine via #virtualGridContainer above. -->
      <!-- All list rows are handled by the VirtualGrid engine via #listGridContainer above. -->


      <!-- EAGLE-STYLE FLOATING POPOVER -->
      <Transition name="ql-fade">
        <div v-if="previewOpen" class="ql-popover" :style="qlPopoverStyle" @mouseleave="closePreview">
          <video v-if="isVideo(previewOpen.ext)" :src="getMediaUrl(previewOpen.contentPath)" class="ql-media" :style="qlMediaStyle" autoplay :muted="globalMute" loop playsinline @loadedmetadata="onQlVideoLoad" />
          <img v-else :src="getMediaUrl(previewOpen.contentPath)" class="ql-media" :style="qlMediaStyle" @load="onQlImageLoad" draggable="false" />
          <div class="ql-info">
            <span class="ql-name">{{ previewOpen.name }}</span>
            <span class="ql-dim" v-if="previewOpen.width && previewOpen.height">{{ previewOpen.width }} × {{ previewOpen.height }}</span>
          </div>
        </div>
      </Transition>
    </main>

    <!-- Lasso Selection Box -->
    <div class="selection-box" :style="selectionBoxStyle"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useDropZone } from '@vueuse/core'
import { VirtualGrid, injectVirtualGridStyles } from '../VirtualGrid'

const props = defineProps<{
  items: any[]
  selectedItems: any[]
  selectedIds: Set<string>
  activeLayout: string
  activeView: string
  activeTag: string | null
  activeFolderId: string | null
  isLoading: boolean
  importProgress: any
  childFolders: any[]
  gridShowName: boolean
  gridShowItemInfo: boolean
  gridItemInfoType: string
  gridShowExtension: boolean
  gridShowSubfolder: boolean
  sidebarCounts: any
  thumbCache: Record<string, string>
  zoom: number
  globalMute: boolean

  formatSize: (b: number) => string
  formatDate: (ts: number) => string
  formatDuration: (d: number) => string
  extIcon: (ext: string) => string
  isVideo: (ext: string) => boolean
  getMediaUrl: (p: string) => string
  getThumb: (id: string) => string | null
  folderPreviewThumbs: (fid: string) => string[]
}>()

const emit = defineEmits([
  'update:gridShowSubfolder',
  'update:selectedItems',
  'import',
  'restore-selection',
  'purge-selection',
  'set-folder',
  'deselect',
  'select-item',
  'item-dblclick',
  'lasso-end',
  'dragstart',
  'drop-files',
  'drop-url',
  'toggle-mute',
  'fetch-thumb',
  'fallback-thumb'
])

const _gridShowSubfolder = computed({
  get: () => props.gridShowSubfolder,
  set: (val) => emit('update:gridShowSubfolder', val)
})

// ── Refs & DOM ──────────────────────────────────────────────────────────────
const dropZoneRef = ref<HTMLElement>()
const virtualGridContainer = ref<HTMLElement>()
const listGridContainer   = ref<HTMLElement>()
// Engine-provided DOM target for the <Teleport>'d subfolder section.
// When null, the Teleport is :disabled and the section renders in-place.
const bannerSlotEl = ref<HTMLElement | null>(null)
let vGrid: VirtualGrid | null = null       // grid / justified / waterfall
let listGrid: VirtualGrid | null = null    // list
let ro: ResizeObserver | null = null
const galleryWidth = ref(0)



// Current layout passed to engine
const currentEngineLayout = computed<'grid' | 'justified' | 'list' | 'waterfall'>(() => {
  if (props.activeLayout === 'justified' || props.activeLayout === 'waterfall' || props.activeLayout === 'list') {
    return props.activeLayout
  }
  return 'grid'
})

function buildEngineOptions(layout: 'grid' | 'justified' | 'list' | 'waterfall') {
  const s = 120 + props.zoom * 16
  // List rows are compact: 40px thumb + 6px top + 6px bottom padding = 52px
  const isList = layout === 'list'
  return {
    layout,
    rowHeight: isList ? 52 : s,
    minColWidth: isList ? 52 : s,
    columns: 'auto' as const,
    gap: isList ? 4 : 16,
    targetRowHeight: Math.max(80, Math.floor(s * 0.75)),
    listThumbSize: 40,
    showName: props.gridShowName,
    showRes: props.gridShowItemInfo,
    itemInfoType: props.gridItemInfoType as any,
    showExt: props.gridShowExtension,
    formatSize: props.formatSize,
    formatDate: props.formatDate,
  } as any
}


function wireGridEvents(g: VirtualGrid) {
  g.on('select', ({ entry, event }) => emit('select-item', entry, event.ctrlKey || event.metaKey, event.shiftKey))
  g.on('dblclick', ({ entry }) => emit('item-dblclick', entry))
  g.on('hover', ({ entry, el }) => onCardEnter(entry, el))
  g.on('unhover', ({ entry, el }) => onCardLeave(entry, el))
  g.on('preview-enter', ({ entry, event }) => startPreviewHover(entry, event))
  g.on('preview-leave', () => cancelPreviewHover())
  g.on('toggle-mute', () => emit('toggle-mute'))
  g.on('dragstart', ({ entry, event }) => emit('dragstart', entry, event))
  g.on('need-thumbs', ({ ids }) => {
    ids.forEach((id: string) => {
      const item = props.items.find(i => i.id === id)
      if (item) {
        if (props.thumbCache[id]) {
          vGrid?.setThumb(id, props.thumbCache[id])
          listGrid?.setThumb(id, props.thumbCache[id])
        } else {
          emit('fetch-thumb', item)
        }
      }
    })
  })
}


// ── VueUse Drop Zone ────────────────────────────────────────────────────────
const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: (files) => {
    if (!files) return
    const paths = files.map(f => (f as any).path).filter(Boolean)
    if (paths.length > 0) {
      emit('drop-files', paths)
    }
  }
})

onMounted(() => {
  injectVirtualGridStyles()
  ro = new ResizeObserver(entries => {
    galleryWidth.value = entries[0]?.contentRect.width ?? 0
  })
  if (dropZoneRef.value) ro.observe(dropZoneRef.value)
})

onBeforeUnmount(() => {
  if (ro) ro.disconnect()
})

// Note: Justified rows & waterfall column calculations are now done inside the VirtualGrid engine
// (see VirtualGrid.ts: computeJustifiedPlacements, computeWaterfallPlacements).
// This is more efficient (no Vue re-render storm on 10k+ items) and unifies the four layouts.

// ── Virtual Grid Wiring (handles grid, justified, list, waterfall) ─────────


// Main grid: grid / justified / waterfall
watch(virtualGridContainer, (el) => {
  if (el && !vGrid) {
    const layout = props.activeLayout === 'justified' || props.activeLayout === 'waterfall'
      ? props.activeLayout
      : 'grid'
    vGrid = new VirtualGrid(el, buildEngineOptions(layout as any))
    wireGridEvents(vGrid)
    if (props.items.length > 0) vGrid.setItems(props.items)
    vGrid.setSelected(props.selectedIds)
    vGrid.refreshVisibleThumbs(props.thumbCache)
    // Expose the engine's banner slot to the <Teleport>
    bannerSlotEl.value = vGrid.getBannerSlot()
  } else if (!el && vGrid) {
    vGrid.destroy()
    vGrid = null
    bannerSlotEl.value = null
  }
})

// List grid (separate instance to avoid layout thrash)
watch(listGridContainer, (el) => {
  if (el && !listGrid) {
    listGrid = new VirtualGrid(el, buildEngineOptions('list'))
    wireGridEvents(listGrid)
    if (props.items.length > 0) listGrid.setItems(props.items)
    listGrid.setSelected(props.selectedIds)
    listGrid.refreshVisibleThumbs(props.thumbCache)
    // If no main grid is present, expose the list grid's slot instead
    if (!vGrid) bannerSlotEl.value = listGrid.getBannerSlot()
  } else if (!el && listGrid) {
    listGrid.destroy()
    listGrid = null
    if (!vGrid) bannerSlotEl.value = null
  }
})


// React to layout changes — update main grid's layout
watch(() => props.activeLayout, (newLayout) => {
  if (vGrid && newLayout !== 'list') {
    const layout = newLayout === 'justified' || newLayout === 'waterfall' ? newLayout : 'grid'
    vGrid.updateOptions({ layout: layout as any })
  }
})



// Items: push to whichever engine is active
watch(() => props.items, (newItems) => {
  if (vGrid) vGrid.setItems(newItems)
  if (listGrid) listGrid.setItems(newItems)
})
watch(() => props.selectedIds, (newSet) => {
  if (vGrid) vGrid.setSelected(newSet)
  if (listGrid) listGrid.setSelected(newSet)
})
watch(() => props.zoom, (val) => {
  const s = 120 + val * 16
  if (vGrid) vGrid.updateOptions({ rowHeight: s, minColWidth: s, targetRowHeight: Math.max(80, Math.floor(s * 0.75)) })
  // List rows: 40px thumb + 6px top + 6px bottom padding = 52px
  if (listGrid) listGrid.updateOptions({ rowHeight: 52, minColWidth: 52 })
})

watch(() => ({ ...props.thumbCache }), (cache) => {
  if (vGrid) vGrid.refreshVisibleThumbs(cache)
  if (listGrid) listGrid.refreshVisibleThumbs(cache)
})
watch(() => props.gridShowName, (val) => {
  if (vGrid) vGrid.updateOptions({ showName: val })
  if (listGrid) listGrid.updateOptions({ showName: val })
})
watch(() => props.gridShowItemInfo, (val) => {
  if (vGrid) vGrid.updateOptions({ showRes: val })
  if (listGrid) listGrid.updateOptions({ showRes: val })
})
watch(() => props.gridItemInfoType, (val) => {
  if (vGrid) vGrid.updateOptions({ itemInfoType: val as any })
  if (listGrid) listGrid.updateOptions({ itemInfoType: val as any })
})
watch(() => props.gridShowExtension, (val) => {
  if (vGrid) vGrid.updateOptions({ showExt: val })
  if (listGrid) listGrid.updateOptions({ showExt: val })
})


// ── Selection & Interaction ─────────────────────────────────────────────────
function onDocItemClick(item: any, e: MouseEvent) {
  const isMulti = e.ctrlKey || e.metaKey
  const isRange = e.shiftKey
  emit('select-item', item, isMulti, isRange)
}

function onItemDragStart(item: any, e: DragEvent) {
  emit('dragstart', item, e)
}

// ── Lasso Drag Selection ────────────────────────────────────────────────────
const selectionBox = ref({ visible: false, startX: 0, startY: 0, currentX: 0, currentY: 0 })
const initialSelection = ref<Set<string>>(new Set())
const selectionBoxStyle = computed(() => {
  const { startX, startY, currentX, currentY, visible } = selectionBox.value
  if (!visible) return { display: 'none' }
  return {
    left: Math.min(startX, currentX) + 'px',
    top: Math.min(startY, currentY) + 'px',
    width: Math.abs(currentX - startX) + 'px',
    height: Math.abs(currentY - startY) + 'px'
  }
})

function onGalleryMouseDown(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.card, .vg-card, button, input, select')) return
  if (e.button !== 0) return
  if (e.detail > 1) e.preventDefault()
  selectionBox.value.visible = true
  selectionBox.value.startX = e.clientX
  selectionBox.value.startY = e.clientY
  selectionBox.value.currentX = e.clientX
  selectionBox.value.currentY = e.clientY
  initialSelection.value = new Set(props.selectedIds)
  document.addEventListener('mousemove', onLassoMove)
  document.addEventListener('mouseup', onLassoEnd)
}
function onLassoMove(e: MouseEvent) {
  if (!selectionBox.value.visible) return
  selectionBox.value.currentX = e.clientX
  selectionBox.value.currentY = e.clientY
  updateLassoSelection(e)
}
function updateLassoSelection(e: MouseEvent) {
  const left = Math.min(selectionBox.value.startX, selectionBox.value.currentX)
  const right = Math.max(selectionBox.value.startX, selectionBox.value.currentX)
  const top = Math.min(selectionBox.value.startY, selectionBox.value.currentY)
  const bottom = Math.max(selectionBox.value.startY, selectionBox.value.currentY)
  const cards = document.querySelectorAll('.card, .vg-card')
  const newSelectedIds = new Set<string>()

  cards.forEach(card => {
    const rect = card.getBoundingClientRect()
    const intersect = !(rect.right < left || rect.left > right || rect.bottom < top || rect.top > bottom)
    if (intersect) {
      const id = (card as HTMLElement).dataset.id
      if (id) newSelectedIds.add(id)
    }
  })
  const isAdditive = e.ctrlKey || e.metaKey || e.shiftKey
  const result: any[] = []
  for (const item of props.items) {
    let isSelected = false
    if (isAdditive) isSelected = initialSelection.value.has(item.id) || newSelectedIds.has(item.id)
    else isSelected = newSelectedIds.has(item.id)
    if (isSelected) result.push(item)
  }
  emit('update:selectedItems', result)
}
function onLassoEnd(e: MouseEvent) {
  if (!selectionBox.value.visible) return
  selectionBox.value.visible = false
  document.removeEventListener('mousemove', onLassoMove)
  document.removeEventListener('mouseup', onLassoEnd)
  const dx = Math.abs(selectionBox.value.currentX - selectionBox.value.startX)
  const dy = Math.abs(selectionBox.value.currentY - selectionBox.value.startY)
  if (dx < 3 && dy < 3) {
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) emit('deselect')
    return
  }
  emit('lasso-end')
}

// ── Hover & Quick Preview ───────────────────────────────────────────────────
const hoveredItemId = ref<string | null>(null)
const previewOpen = ref<any | null>(null)
const qlAnchorRect = ref<DOMRect | null>(null)
const qlNativeW = ref(0)
const qlNativeH = ref(0)
let _previewTimer: ReturnType<typeof setTimeout> | null = null

function onCardEnter(item: any, el?: HTMLElement) { 
  hoveredItemId.value = item.id
  if (el && props.isVideo(item.ext)) {
    const thumb = el.querySelector('.vg-thumb')
    if (thumb && !thumb.querySelector('.vg-video-preview')) {
      const vid = document.createElement('video')
      vid.src = props.getMediaUrl(item.contentPath)
      vid.className = 'vg-video-preview card-video'
      vid.autoplay = true
      vid.loop = true
      vid.muted = props.globalMute
      vid.playsInline = true
      vid.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:2;pointer-events:none;'
      thumb.appendChild(vid)
      vid.play().catch(() => {})
    }
    const muteBtn = el.querySelector<HTMLElement>('.vg-mute-btn')
    if (muteBtn) {
      muteBtn.style.display = 'flex'
      const on = muteBtn.querySelector<HTMLElement>('.vg-mute-on')
      const off = muteBtn.querySelector<HTMLElement>('.vg-mute-off')
      if (on) on.style.display = props.globalMute ? 'flex' : 'none'
      if (off) off.style.display = props.globalMute ? 'none' : 'flex'
    }
  }
}
function onCardLeave(item: any, el?: HTMLElement) { 
  if (hoveredItemId.value === item?.id) {
    hoveredItemId.value = null
  }
  if (el) {
    const vid = el.querySelector('.vg-video-preview') as HTMLVideoElement
    if (vid) {
      vid.pause()
      vid.remove()
    }
    const muteBtn = el.querySelector<HTMLElement>('.vg-mute-btn')
    if (muteBtn) muteBtn.style.display = 'none'
  }
}

function startPreviewHover(item: any, e: MouseEvent) {
  cancelPreviewHover()
  const btn = e.currentTarget as HTMLElement
  const card = btn.closest('.card, .vg-card') as HTMLElement
  if (!card) return
  _previewTimer = setTimeout(() => {
    qlAnchorRect.value = card.getBoundingClientRect()
    qlNativeW.value = item.width || 0
    qlNativeH.value = item.height || 0
    previewOpen.value = item
  }, 400)
}
function cancelPreviewHover() {
  if (_previewTimer) { clearTimeout(_previewTimer); _previewTimer = null }
}
function closePreview() {
  previewOpen.value = null
  qlAnchorRect.value = null
}
function onQlImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  qlNativeW.value = img.naturalWidth
  qlNativeH.value = img.naturalHeight
}
function onQlVideoLoad(e: Event) {
  const vid = e.target as HTMLVideoElement
  qlNativeW.value = vid.videoWidth
  qlNativeH.value = vid.videoHeight
}

const qlMediaStyle = computed(() => {
  const maxW = window.innerWidth * 0.82
  const maxH = window.innerHeight * 0.82
  const nw = qlNativeW.value || 400
  const nh = qlNativeH.value || 400
  const scale = Math.min(1, maxW / nw, maxH / nh)
  return { width: `${Math.round(nw * scale)}px`, height: `${Math.round(nh * scale)}px` }
})
const qlPopoverStyle = computed(() => {
  const rect = qlAnchorRect.value
  if (!rect) return {}
  const nw = qlNativeW.value || 400
  const nh = qlNativeH.value || 400
  const maxW = window.innerWidth * 0.82
  const maxH = window.innerHeight * 0.82
  const scale = Math.min(1, maxW / nw, maxH / nh)
  const pw = Math.round(nw * scale) + 4
  const ph = Math.round(nh * scale) + 44
  let left = rect.left + rect.width / 2 - pw / 2
  let top = rect.top - ph - 12
  if (top < 12) top = rect.bottom + 12
  left = Math.max(12, Math.min(left, window.innerWidth - pw - 12))
  top = Math.max(12, Math.min(top, window.innerHeight - ph - 12))
  return { left: `${Math.round(left)}px`, top: `${Math.round(top)}px`, width: `${pw}px` }
})

// ── Image Error Fallback ────────────────────────────────────────────────────
function onImgError(item: any, e: Event) {
  const img = e.target as HTMLImageElement
  const fallback = props.getMediaUrl(item.contentPath)
  if (img.src !== fallback) {
    img.src = fallback
    emit('fallback-thumb', item.id, fallback)
  }
}

// ── Utilities ───────────────────────────────────────────────────────────────
function getCardThumbStyle(item: any) {
  const styles: any[] = []
  if (props.activeLayout !== 'grid') {
    const m: Record<string,string> = { png:'#1a2535',jpg:'#1e2025',jpeg:'#1e2025',jfif:'#1e2025',gif:'#1a2535',webp:'#1a2535',svg:'#1a2a1e',mp4:'#1a1e2a',pdf:'#2a1e1e' }
    styles.push({ background: m[item.ext.toLowerCase()] ?? '#1a1a1e' })
  }
  if (props.activeLayout === 'waterfall' && item.width && item.height) {
    styles.push({ aspectRatio: `${item.width} / ${item.height}` })
  }
  return styles
}
</script>

<style scoped>
.gallery { flex: 1; background: var(--bg-gallery); overflow-y: auto; padding: 16px; position: relative; }

.hide-vg-name :deep(.vg-name) { display: none !important; }
.hide-vg-res :deep(.vg-res) { display: none !important; }

/* Premium Drop Overlay */
.drag-overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; z-index: 500; pointer-events: none; }
.drag-overlay-content { display: flex; flex-direction: column; align-items: center; gap: 20px; color: #fff; text-align: center; }
.drag-icon-ring { width: 100px; height: 100px; border-radius: 50%; border: 2px dashed var(--accent); display: flex; align-items: center; justify-content: center; background: var(--accent-dim); box-shadow: 0 0 40px var(--accent-dim); }
.drag-overlay-content svg { width: 48px; height: 48px; color: var(--accent); }
.drag-overlay-content h2 { font-size: 28px; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
.drag-overlay-content p { font-size: 15px; opacity: 0.6; margin: 0; }

.overlay-fade-enter-active, .overlay-fade-leave-active { transition: opacity 0.3s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to { opacity: 0; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; text-align: center; }
.empty-icon { margin-bottom: 8px; }
.empty-svg { width: 64px; height: 64px; color: rgba(255,255,255,.28); stroke-width: 1px; }
.empty-title { font-size: 16px; font-weight: 500; color: var(--text-1); }
.empty-sub { font-size: 13px; color: var(--text-2); }
.empty-btn { background: var(--accent); border: none; border-radius: 8px; padding: 9px 20px; color: #fff; font-size: 13px; font-weight: 500; margin-top: 4px; }
.empty-btn:hover { opacity: .9; }

.import-bar { height: 3px; background: var(--bg-card); border-radius: 2px; margin-bottom: 12px; overflow: hidden; }
.import-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width .2s; }

.subfolder-section { padding: 16px 16px 20px; }

.subfolder-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.subfolder-title { font-size: 13px; font-weight: 600; color: var(--text-1); }
.subfolder-toggle { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); cursor: pointer; user-select: none; }
.subfolder-toggle input { accent-color: var(--accent); }
.subfolder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }

.sfcard { border-radius: 10px; background: var(--bg-card); border: 1px solid var(--border); cursor: pointer; overflow: hidden; transition: border-color .15s, transform .12s; }
.sfcard:hover { border-color: var(--border-hover); transform: translateY(-2px); }
.sfcard-thumb { position: relative; width: 100%; aspect-ratio: 4/3; background: var(--bg-input); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.sfcard-mosaic { width: 100%; height: 100%; display: grid; gap: 2px; }
.sfcard-mosaic--1 { grid-template-columns: 1fr; }
.sfcard-mosaic--2 { grid-template-columns: 1fr 1fr; }
.sfcard-mosaic--3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
.sfcard-mosaic--4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
.sfcard-mosaic--3 .sfcard-mosaic-img:first-child { grid-row: span 2; }
.sfcard-mosaic-img { width: 100%; height: 100%; object-fit: cover; }
.sfcard-empty-ico { opacity: .25; color: var(--text-2); }
.sfcard-empty-ico svg { width: 52px; height: 52px; }
.sfcard-badge { position: absolute; top: 7px; left: 7px; display: flex; align-items: center; background: rgba(0,0,0,0.7); color: rgba(255,255,255,0.85); font-size: 9px; font-weight: 700; letter-spacing: .06em; padding: 3px 7px; border-radius: 4px; font-family: monospace; pointer-events: none; }
.sfcard-footer { padding: 8px 10px 9px; }
.sfcard-name { font-size: 12px; font-weight: 500; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sfcard-count { font-size: 11px; color: var(--text-3); margin-top: 2px; }

.justified-gallery { display: flex; flex-direction: column; gap: 10px; }
.justified-row { display: flex; flex-direction: row; gap: 10px; align-items: flex-start; }
.justified-card { flex-shrink: 0; border-radius: 10px; overflow: hidden; }
.justified-thumb { position: relative; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.justified-thumb .card-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

.grid { display: grid; gap: 16px; }
.layout-justified, .layout-grid { display: grid; }
.layout-grid .card-thumb { aspect-ratio: 1 / 1; background: var(--bg-card); }
.layout-grid .card-img { object-fit: cover; width: 100%; height: 100%; position: absolute; inset: 0; }

.waterfall-grid {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
}
.waterfall-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-width: 0;
}
.waterfall-card {
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
}
.waterfall-card .card-thumb {
  width: 100%;
  height: auto;
  aspect-ratio: unset;
  background: transparent;
}
.waterfall-card .card-img {
  position: relative !important;
  width: 100% !important;
  height: auto !important;
  object-fit: cover;
  display: block;
}

.layout-list { display: flex !important; flex-direction: column !important; gap: 0 !important; padding: 24px !important; }
.list-header { display: grid; grid-template-columns: 40px minmax(200px, 1fr) 100px 80px 120px; gap: 16px; padding: 0 16px 12px 16px; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-2); font-size: 11px; font-weight: 500; align-items: center; }
.layout-list .card { display: grid !important; grid-template-columns: 40px minmax(200px, 1fr) 100px 80px 120px; gap: 16px; align-items: center; padding: 8px 16px !important; background: transparent !important; border-radius: 6px !important; border: none !important; }
.layout-list .card:hover { background: rgba(255,255,255,0.03) !important; box-shadow: none !important; transform: none !important; }
.layout-list .card.selected { background: rgba(255,255,255,0.08) !important; box-shadow: none !important; }
.layout-list .card .card-thumb { width: 40px !important; height: 40px !important; aspect-ratio: 1/1 !important; border-radius: 4px; }
.layout-list .card .list-col-name { font-size: 13px; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
.layout-list .card .list-col-size, .layout-list .card .list-col-format, .layout-list .card .list-col-date { font-size: 12px; color: var(--text-2); }
.layout-list .card-meta-overlay { display: none !important; }

.card { background: var(--bg-card); border-radius: 10px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: border-color .15s, box-shadow .2s, transform .25s var(--anim-spring); position: relative; }
.card:hover { border-color: rgba(255,255,255,.12); box-shadow: 0 6px 20px rgba(0,0,0,.3); transform: translateY(-2px) scale(1.005); z-index: 10; }
.card.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.card-thumb { position: relative; width: 100%; aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #0a0a0c; }
.card-img { width: 100%; height: 100%; object-fit: contain; display: block; position: absolute; inset: 0; }
.card-video { opacity: 0; animation: fadeIn .22s ease forwards; }
@keyframes fadeIn { to { opacity: 1; } }
.card-placeholder { font-size: 28px; position: relative; z-index: 1; }
.ext-badge { position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,.65); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border-radius: 3px; padding: 2px 5px; font-size: 9px; font-weight: 700; color: rgba(255,255,255,.85); letter-spacing: .06em; font-family: var(--font-mono); z-index: 4; }
.duration-badge { position: absolute; bottom: 36px; right: 6px; background: rgba(0,0,0,.72); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border-radius: 3px; padding: 2px 6px; font-size: 10px; font-weight: 600; color: #fff; font-family: var(--font-mono); letter-spacing: .03em; z-index: 4; }
.card-meta-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 20px 8px 6px; background: linear-gradient(to top, rgba(0,0,0,.75) 0%, transparent 100%); transform: translateY(4px); opacity: 0; transition: opacity .18s ease, transform .18s ease; z-index: 3; }
.card:hover .card-meta-overlay { opacity: 1; transform: translateY(0); }
.card-overlay-name { font-size: 11px; font-weight: 500; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.35; }
.card-overlay-res { font-size: 10px; color: rgba(255,255,255,.55); font-family: var(--font-mono); margin-top: 1px; }
.card-footer { padding: 8px 10px 10px; background: transparent; display: flex; flex-direction: column; gap: 3px; text-align: center; }
.card-footer-name { font-size: 12px; font-weight: 600; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-footer-info { font-size: 11px; color: var(--text-2); font-family: var(--font-mono); }
.card-preview-btn { position: absolute; bottom: 6px; right: 6px; width: 26px; height: 26px; border-radius: 5px; background: rgba(255,255,255,.14); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); border: none; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: opacity .15s, transform .1s, background .15s; z-index: 5; }
.card-preview-btn svg { width: 15px; height: 15px; }
.card:hover .card-preview-btn { opacity: 1; }
.card-preview-btn:hover { background: rgba(255,255,255,.28); transform: scale(1.15) translateY(-2px); transition: transform .2s var(--anim-spring-fast), background .15s; }
.card-mute-btn { position: absolute; bottom: 12px; left: 6px; width: 26px; height: 26px; border-radius: 5px; background: rgba(255,255,255,.14); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); border: none; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: opacity .15s, transform .1s, background .15s; z-index: 5; }
.card:hover .card-mute-btn { opacity: 1; }
.card-mute-btn:hover { background: rgba(255,255,255,.28); transform: scale(1.15) translateY(-2px); transition: transform .2s var(--anim-spring-fast), background .15s; }
.card-mute-btn svg { width: 15px; height: 15px; }
.dup-badge { position: absolute; top: 6px; right: 6px; background: rgba(255,160,50,.85); border-radius: 4px; padding: 2px 5px; font-size: 9px; font-weight: 700; color: #000; letter-spacing:.04em; }
.enhanced-gallery-badge { position: absolute; top: 6px; right: 6px; font-size: 14px; filter: drop-shadow(0 0 4px rgba(0,0,0,0.5)); pointer-events: none; z-index: 4; }
.card.selected .enhanced-gallery-badge { right: 8px; top: 8px; } /* Adjust for selection border */
.card--dup { border-color: rgba(255,160,50,.35) !important; }

.ql-popover { position: fixed; z-index: 9500; display: flex; flex-direction: column; align-items: center; pointer-events: auto; filter: drop-shadow(0 20px 60px rgba(0,0,0,0.65)) drop-shadow(0 4px 16px rgba(0,0,0,0.4)); }
.ql-media { display: block; border-radius: 6px 6px 0 0; border: 2px solid rgba(0,0,0,0.85); border-bottom: none; object-fit: contain; user-select: none; image-rendering: auto; }
.ql-info { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px 8px; background: rgba(24, 25, 30, 0.97); border: 2px solid rgba(0,0,0,0.85); border-top: 1px solid rgba(255,255,255,0.07); border-radius: 0 0 6px 6px; box-sizing: border-box; }
.ql-name { font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.88); font-family: var(--font); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.ql-dim { font-size: 11px; color: rgba(255,255,255,0.4); font-family: var(--font); white-space: nowrap; flex-shrink: 0; }
.ql-fade-enter-active { transition: opacity .15s ease, transform .15s ease; }
.ql-fade-leave-active { transition: opacity .1s ease, transform .1s ease; }
.ql-fade-enter-from { opacity: 0; transform: scale(0.97); }
.ql-fade-leave-to { opacity: 0; transform: scale(0.97); }

.selection-box { position: fixed; border: 1px solid rgba(10, 132, 255, 0.8); background: rgba(10, 132, 255, 0.2); z-index: 9999; pointer-events: none; }

.action-btn { width: 100%; background: transparent; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--border); border-radius: 8px; padding: 9px; color: var(--text-1); font-size: 12px; font-weight: 500; font-family: var(--font); cursor: pointer; transition: border-color .15s, background .15s, color .15s; }
.action-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
.action-btn--restore { border-color: rgba(50,200,100,.3); color: #3cc870; }
.action-btn--restore:hover { background: rgba(50,200,100,.1); border-color: #3cc870; }
.action-btn--danger { border-color: rgba(255,80,80,.3); color: #ff5f57; }
.action-btn--danger:hover { background: rgba(255,80,80,.1); border-color: #ff5f57; }

.action-btn:active, .card-preview-btn:active, .card-mute-btn:active, .sfcard:active { transform: scale(0.95) !important; transition: transform 0.05s !important; }
</style>
