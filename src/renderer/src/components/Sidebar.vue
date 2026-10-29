<template>
  <aside class="sidebar-left" :style="{ width: width + 'px' }">

    <!-- ── Library selector / dropdown ─────────────────────────── -->
    <div class="lib-selector-wrap" ref="libSelectorRef">
      <button class="lib-selector" @click="toggleLibDropdown">
        <svg viewBox="0 0 16 16" fill="currentColor" class="lib-ico"><path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/></svg>
        <span class="lib-name">{{ libraryInfo?.name }}</span>
        <svg class="lib-chevron" :class="{ open: libDropdownOpen }" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 1l4 4 4-4"/></svg>
      </button>

      <!-- Dropdown -->
      <div v-if="libDropdownOpen" class="lib-dropdown">
        <div class="lib-dd-header">{{ libraryInfo?.name }}</div>
        <div class="lib-dd-path">{{ libraryPath }}</div>
        <div class="lib-dd-divider"></div>
        <button class="lib-dd-item" @click="handleOpenSwitcher()">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8h12M10 4l4 4-4 4"/></svg>
          Switch Library
        </button>
        <button class="lib-dd-item" @click="handleOpenSwitcher('create')">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="8" y1="5" x2="8" y2="11"/><line x1="5" y1="8" x2="11" y2="8"/></svg>
          New Library
        </button>
        <div class="lib-dd-divider"></div>
        <button class="lib-dd-item" @click="onRepairLibrary">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M4 12l2-2M10 6l2-2"/></svg>
          Repair Library
        </button>
      </div>
    </div>

    <!-- ── Nav items ────────────────────────────────────────────── -->
    <nav class="nav-section">
      <button class="nav-item" :class="{ active: activeView === 'all' }" @click="emit('set-view', 'all')">
        <span class="nav-ico">
          <svg viewBox="0 0 14 14" fill="currentColor"><rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="1" width="5" height="5" rx="1"/><rect x="1" y="8" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/></svg>
        </span>
        <span class="nav-label">All</span>
        <span class="nav-count">{{ sidebarCounts.all }}</span>
      </button>

      <button class="nav-item" :class="{ active: activeView === 'untagged' }" @click="emit('set-view', 'untagged')">
        <span class="nav-ico">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2h6l6 6-6 6-6-6V2z"/><circle cx="5" cy="5" r="1" fill="currentColor" stroke="none"/></svg>
        </span>
        <span class="nav-label">Untagged</span>
        <span class="nav-count">{{ sidebarCounts.untagged }}</span>
      </button>

      <button class="nav-item" :class="{ active: activeView === 'recent' }" @click="emit('set-view', 'recent')">
        <span class="nav-ico">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><polyline points="8,5 8,8 10,10"/></svg>
        </span>
        <span class="nav-label">Recently Used</span>
        <span class="nav-count">{{ recentlyViewedLength }}</span>
      </button>

      <button class="nav-item" :class="{ active: activeView === 'alltags' }" @click="emit('set-view', 'alltags')">
        <span class="nav-ico">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2h6l6 6-6 6-6-6V2z"/><circle cx="5" cy="5" r="1" fill="currentColor" stroke="none"/></svg>
        </span>
        <span class="nav-label">All tags</span>
        <span class="nav-count">{{ sidebarCounts.tagged }}</span>
      </button>

      <button class="nav-item" :class="{ active: activeView === 'trash' }" @click="emit('set-view', 'trash')">
        <span class="nav-ico">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="2,4 14,4"/><path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1"/><rect x="3" y="4" width="10" height="10" rx="1"/><line x1="6" y1="7" x2="6" y2="11"/><line x1="10" y1="7" x2="10" y2="11"/></svg>
        </span>
        <span class="nav-label">Trash</span>
        <span class="nav-count nav-count--danger" v-if="sidebarCounts.trash > 0">{{ sidebarCounts.trash }}</span>
      </button>

      <button class="nav-item" :class="{ active: activeView === 'duplicates' }" @click="emit('set-view', 'duplicates')">
        <span class="nav-ico">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="9" height="9" rx="1.5"/><path d="M5 4V3a1 1 0 011-1h7a1 1 0 011 1v7a1 1 0 01-1 1h-1"/></svg>
        </span>
        <span class="nav-label">Duplicates</span>
        <span class="nav-count nav-count--warn" v-if="sidebarCounts.duplicates > 0">{{ sidebarCounts.duplicates }}</span>
      </button>
    </nav>

    <div class="sidebar-divider"></div>

    <div class="sidebar-content" ref="sidebarContentRef">
    <div class="sidebar-scroll-area" ref="scrollAreaRef" @scroll="onScroll" @dragover="handleScrollAreaDragOver" @drop="clearScrollInterval">
      <!-- ── Pinned Folders ────────────────────────────────────── -->
      <template v-if="pinnedFolders && pinnedFolders.length > 0">
        <div class="section-header">
          <span>PINNED</span>
        </div>
        <div class="folder-list">
          <button v-for="folder in pinnedFolders" :key="'pin-'+folder.id"
            class="folder-item" :class="[
              { active: selectedFolderIds.has(folder.id) },
              folderDragTargetId === folder.id ? 'drag-over-inside' : ''
            ]"
            @dragenter.prevent="emit('folder-dragenter', folder.id, $event)"
            @dragleave.prevent="emit('folder-dragleave', folder.id, $event)"
            @dragover.prevent="handleDragOver(folder.id, $event)"
            @drop.prevent="handleDrop(folder.id, $event)"
            @click="emit('set-folder', folder.id, $event)"
            @contextmenu.prevent="emit('folder-contextmenu', folder, $event)">
            <div v-if="folderDragTargetId === folder.id && folderDropPosition === 'before'" class="drop-indicator drop-indicator--before" :style="{ left: `calc(16px + ${folder.depth || 0} * 16px)` }"></div>
            <div v-if="folderDragTargetId === folder.id && folderDropPosition === 'after'" class="drop-indicator drop-indicator--after" :style="{ left: `calc(16px + ${folder.depth || 0} * 16px)` }"></div>
            <span class="folder-ico-wrap">
              <svg v-if="folder.icon && getFolderIconPath(folder.icon)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="folder-ico" :style="folder.color ? { color: folder.color } : {}" v-html="getFolderIconPath(folder.icon)"></svg>
              <span v-else-if="folder.icon" class="folder-custom-icon" :style="folder.color ? { color: folder.color } : {}">{{ folder.icon }}</span>
              <svg v-else class="folder-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="folder.color ? { color: folder.color } : {}"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
            </span>
            <span class="folder-name">{{ folder.name }}</span>
            <span v-if="getWatchPath(folder.id)" class="watched-ico" title="Watched Folder">
              <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8s3-5 6-5 6 5 6 5-3 5-6 5-6-5-6-5z"/></svg>
            </span>
            <span class="folder-count">{{ sidebarCounts.folders[folder.id] || 0 }}</span>
          </button>
        </div>
        <div class="sidebar-divider" style="margin: 8px 0;"></div>
      </template>

    <!-- ── Folders ────────────────────────────────────── -->
    <div class="section-header">
      <span>FOLDERS ({{ foldersLength }})</span>
      <button class="new-folder-btn" @click.stop="emit('prompt-new-folder')" title="New folder">+</button>
    </div>
    <div v-if="foldersOpen" class="folder-list">
      <!-- Inline Folder Creator -->
      <div v-if="isCreatingFolder" class="folder-item folder-create-row" :style="{ paddingLeft: `calc(16px + ${pendingSubfolderParentId ? (derivedFolders.find(f => f.id === pendingSubfolderParentId)?.depth ?? 0) + 1 : 0} * 16px)` }">
        <svg viewBox="0 0 16 16" fill="currentColor" class="folder-ico"><path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/></svg>
        <input 
          ref="inlineFolderInputRef"
          :value="newFolderName" 
          @input="emit('update:newFolderName', ($event.target as HTMLInputElement).value)"
          class="folder-create-input" 
          @keydown.enter="emit('submit-new-folder')"
          @keydown.esc="emit('cancel-new-folder')"
          @blur="emit('cancel-new-folder')"
        />
      </div>
      
      <draggable
        :list="derivedFolders"
        :group="{ name: 'folders', pull: true, put: true }"
        item-key="id"
        class="draggable-list"
        ghost-class="folder-ghost"
        drag-class="folder-drag"
        @start="onFolderDragStart"
        @end="onFolderDragEnd"
        :animation="200"
        tag="div"
      >
        <template #item="{ element: folder }">
          <div v-if="renamingFolderId === folder.id" class="folder-item folder-create-row" :style="{ paddingLeft: `calc(16px + ${folder.depth} * 16px)` }" :data-depth="folder.depth">                
            <span class="folder-ico-wrap">
              <svg v-if="folder.icon && getFolderIconPath(folder.icon)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="folder-ico" :style="folder.color ? { color: folder.color } : {}" v-html="getFolderIconPath(folder.icon)"></svg>
              <span v-else-if="folder.icon" class="folder-custom-icon" :style="folder.color ? { color: folder.color } : {}">{{ folder.icon }}</span>
              <svg v-else viewBox="0 0 16 16" fill="currentColor" class="folder-ico" :style="folder.color ? { color: folder.color } : {}"><path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/></svg>
            </span>
            <input 
              ref="renameFolderInputRef"
              :value="renameFolderName" 
              @input="emit('update:renameFolderName', ($event.target as HTMLInputElement).value)"
              class="folder-create-input" 
              @keydown.enter="emit('submit-rename-folder')"
              @keydown.esc="emit('cancel-rename-folder')"
              @blur="emit('submit-rename-folder')"
            />
          </div>
          <button v-else
            class="folder-item" :class="[
              { active: selectedFolderIds.has(folder.id) },
              folderDragTargetId === folder.id ? `drag-over-${folderDropPosition}` : ''
            ]"
            :style="{ paddingLeft: `calc(16px + ${folder.depth} * 16px)`, '--fd': folder.depth }"
            :data-depth="folder.depth"
            @dragenter.prevent="emit('folder-dragenter', folder.id, $event)"
            @dragleave.prevent="emit('folder-dragleave', folder.id, $event)"
            @dragover.prevent="handleDragOver(folder.id, $event)"
            @drop.prevent="handleDrop(folder.id, $event)"
            @click="emit('set-folder', folder.id, $event)"
            @dblclick="emit('start-rename-folder', folder)"
            @contextmenu.prevent="emit('folder-contextmenu', folder, $event)">
            <div v-if="folderDragTargetId === folder.id && folderDropPosition === 'before'" class="drop-indicator drop-indicator--before" :style="{ left: `calc(16px + ${folder.depth || 0} * 16px)` }"></div>
            <div v-if="folderDragTargetId === folder.id && folderDropPosition === 'after'" class="drop-indicator drop-indicator--after" :style="{ left: `calc(16px + ${folder.depth || 0} * 16px)` }"></div>
            <span class="folder-toggle" @click.stop="emit('toggle-expand', folder.id)" :style="{ visibility: folder.hasChildren ? 'visible' : 'hidden' }">
              <svg :class="{ open: folder.isExpanded }" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l4 4 4-4"/></svg>
            </span>
            <span class="folder-ico-wrap">
              <svg v-if="folder.icon && getFolderIconPath(folder.icon)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="folder-ico" :style="folder.color ? { color: folder.color } : {}" v-html="getFolderIconPath(folder.icon)"></svg>
              <span v-else-if="folder.icon" class="folder-custom-icon" :style="folder.color ? { color: folder.color } : {}">{{ folder.icon }}</span>
              <svg v-else viewBox="0 0 16 16" fill="currentColor" class="folder-ico" :style="folder.color ? { color: folder.color } : {}"><path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/></svg>
            </span>
            <span class="folder-name">{{ folder.name }}</span>
            <span v-if="getWatchPath(folder.id)" class="watched-ico" title="Watched Folder">
              <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8s3-5 6-5 6 5 6 5-3 5-6 5-6-5-6-5z"/></svg>
            </span>
            <span class="folder-count">{{ sidebarCounts.folders[folder.id] || 0 }}</span>
          </button>
        </template>
      </draggable>

      <!-- Void Drop Zone (Smart Folder Creation) -->
      <div 
        class="sidebar-void-zone"
        @dragenter.prevent="onVoidDragOver"
        @dragover.prevent="onVoidDragOver"
        @dragleave="onVoidDragLeave"
        @drop.prevent="onVoidDrop"
        :class="{ 'is-drag-over': isVoidDragging }"
      >
        <div v-if="isVoidDragging" class="void-hint">
          <svg viewBox="0 0 16 16" fill="currentColor" style="width:14px;height:14px;"><path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/></svg>
          Create New Folder
        </div>
      </div>
    </div>
    </div>

    <!-- Resizer Handle (sits on the OUTER right edge of the sidebar, above the scrollbar) -->
    <div class="sidebar-resizer" @mousedown.prevent="startSidebarResize"></div>
    </div>

    <div class="sidebar-bottom">
      <button class="import-btn" @click="emit('import')">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="8" y1="2" x2="8" y2="10"/><polyline points="4,7 8,11 12,7"/><line x1="2" y1="14" x2="14" y2="14"/></svg>
        Import Files
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import draggable from 'vuedraggable'
import { useLibrary } from '../composables/useLibrary'

const { repairLibrary, updateFolder } = useLibrary()

const props = defineProps<{
  width: number
  activeView: string
  activeFolderId: string | null
  selectedFolderIds: Set<string>
  foldersOpen: boolean
  
  libraryInfo: any
  libraryPath: string
  sidebarCounts: any
  recentlyViewedLength: number
  foldersLength: number
  derivedFolders: any[]
  pinnedFolders: any[]
  
  isCreatingFolder: boolean
  newFolderName: string
  pendingSubfolderParentId: string | null
  
  renamingFolderId: string | null
  renameFolderName: string
  
  folderDragTargetId: string | null
  folderDropPosition: 'before' | 'inside' | 'after'
  
  getFolderIconPath: (id: string) => string | null
  getWatchPath: (id: string) => string | null
}>()
const emit = defineEmits([
  'update:width',
  'update:newFolderName',
  'update:renameFolderName',
  'open-switcher',
  'prompt-new-folder',
  'submit-new-folder',
  'cancel-new-folder',
  'start-rename-folder',
  'submit-rename-folder',
  'cancel-rename-folder',
  'folder-contextmenu',
  'folder-dragstart',
  'folder-dragenter',
  'folder-dragleave',
  'folder-dragover',
  'folder-drop',
  'os-drop',
  'os-drop-void',
  'toggle-expand',
  'import',
  'set-view',
  'set-folder'
])

const libDropdownOpen = ref(false)
const libSelectorRef = ref<HTMLElement>()
const inlineFolderInputRef = ref<HTMLInputElement>()
const renameFolderInputRef = ref<HTMLInputElement[] | HTMLInputElement>()

const isVoidDragging = ref(false)

const scrollAreaRef = ref<HTMLElement>()
const sidebarContentRef = ref<HTMLElement>()
let scrollInterval: ReturnType<typeof setInterval> | null = null
let currentScrollSpeed = 0

function onScroll() {
  // Can be used for other scroll-related logic if needed
}

function handleScrollAreaDragOver(e: DragEvent) {
  if (!scrollAreaRef.value) return
  const rect = scrollAreaRef.value.getBoundingClientRect()
  const y = e.clientY - rect.top
  const threshold = Math.min(60, rect.height * 0.15)
  
  if (y < threshold) {
    currentScrollSpeed = -10
  } else if (y > rect.height - threshold) {
    currentScrollSpeed = 10
  } else {
    currentScrollSpeed = 0
    clearScrollInterval()
    return
  }

  if (!scrollInterval) {
    scrollInterval = setInterval(() => {
      if (scrollAreaRef.value && currentScrollSpeed !== 0) {
        scrollAreaRef.value.scrollTop += currentScrollSpeed
      }
    }, 20)
  }
}

function clearScrollInterval() {
  if (scrollInterval) {
    clearInterval(scrollInterval)
    scrollInterval = null
  }
  currentScrollSpeed = 0
}

function onVoidDragOver(e: DragEvent) {
  e.preventDefault() // Crucial for OS drops
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
    isVoidDragging.value = true
  }
}

function onVoidDragLeave() {
  isVoidDragging.value = false
}

function onVoidDrop(e: DragEvent) {
  isVoidDragging.value = false
  console.log('[Sidebar] Void drop detected', e.dataTransfer?.files)
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const paths = Array.from(e.dataTransfer.files).map(f => (f as any).path).filter(Boolean)
    console.log('[Sidebar] Emitting os-drop-void with paths:', paths)
    emit('os-drop-void', paths)
  }
}


function toggleLibDropdown() {
  libDropdownOpen.value = !libDropdownOpen.value
}

function handleOpenSwitcher(mode?: string) {
  libDropdownOpen.value = false
  emit('open-switcher', mode)
}

async function onRepairLibrary() {
  libDropdownOpen.value = false
  await repairLibrary()
}

function onDocClick(e: MouseEvent) {
  if (libDropdownOpen.value && libSelectorRef.value && !libSelectorRef.value.contains(e.target as Node)) {
    libDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  document.addEventListener('dragend', clearScrollInterval)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('dragend', clearScrollInterval)
  clearScrollInterval()
})

watch(() => props.isCreatingFolder, (val) => {
  if (val) {
    nextTick(() => {
      inlineFolderInputRef.value?.focus()
      inlineFolderInputRef.value?.select()
    })
  }
})

watch(() => props.renamingFolderId, (val) => {
  if (val) {
    nextTick(() => {
      const el = Array.isArray(renameFolderInputRef.value) ? renameFolderInputRef.value[0] : renameFolderInputRef.value
      if (el) {
        el.focus()
        el.select()
      }
    })
  }
})

function handleDragOver(folderId: string, e: DragEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top
  let pos: 'before' | 'inside' | 'after' = 'inside'
  
  const types = Array.from(e.dataTransfer?.types || [])
  if (types.includes('application/x-eagle-folder')) {
     if (y < rect.height * 0.25) pos = 'before'
     else if (y > rect.height * 0.75) pos = 'after'
  }
  
  emit('folder-dragover', folderId, pos, e)
}

function handleDrop(folderId: string, e: DragEvent) {
  clearScrollInterval()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top
  let pos: 'before' | 'inside' | 'after' = 'inside'
  
  const types = Array.from(e.dataTransfer?.types || [])
  
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    emit('os-drop', folderId, Array.from(e.dataTransfer.files).map(f => (f as any).path))
  }

  if (types.includes('application/x-eagle-folder')) {
     if (y < rect.height * 0.25) pos = 'before'
     else if (y > rect.height * 0.75) pos = 'after'
  }
  emit('folder-drop', folderId, pos, e)
}

function startSidebarResize(e: MouseEvent) {
  const startX = e.clientX
  const startWidth = props.width
  function onMouseMove(moveEvent: MouseEvent) {
    const newWidth = startWidth + (moveEvent.clientX - startX)
    emit('update:width', Math.min(Math.max(newWidth, 180), 400))
  }
  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = 'col-resize'
}

async function onFolderDragStart(evt: any) {
  const draggedId = evt.item.__draggable_context?.element?.id || props.derivedFolders[evt.oldIndex]?.id
  const dragged = props.derivedFolders.find(f => f.id === draggedId)
  if (dragged) {
    emit('folder-dragstart', dragged, evt.originalEvent)
  }
}

async function onFolderDragEnd(evt: any) {
  clearScrollInterval()
  const draggedId = evt.item.__draggable_context?.element?.id || props.derivedFolders[evt.oldIndex]?.id
  if (!draggedId) return

  const dragged = props.derivedFolders.find(f => f.id === draggedId)
  if (!dragged) return

  const list = [...props.derivedFolders]
  const [removed] = list.splice(evt.oldIndex, 1)
  list.splice(evt.newIndex, 0, removed)
  
  let newParentId = dragged.parentId
  const prev = evt.newIndex > 0 ? list[evt.newIndex - 1] : null
  const next = evt.newIndex < list.length - 1 ? list[evt.newIndex + 1] : null

  // If dropped between two folders of the same parent, it adopts that parent.
  if (prev && next && prev.parentId === next.parentId) {
    newParentId = prev.parentId
  } else if (prev) {
    // Adopts parent of previous folder (becomes its sibling)
    // UNLESS previous folder is expanded and has children, but we only know the flat list.
    // Actually, if prev depth > dragged depth, we might want to adopt prev.parentId.
    // Let's just use prev.parentId to be safe.
    newParentId = prev.parentId
  } else if (next) {
    newParentId = next.parentId
  } else {
    newParentId = null
  }

  const siblings = list.filter(f => f.parentId === newParentId)
  const idxInLevel = siblings.findIndex(f => f.id === draggedId)
  const prevSibling = siblings[idxInLevel - 1]
  const nextSibling = siblings[idxInLevel + 1]
  
  let newSortIndex = Date.now()
  const getVal = (f: any) => f.sortIndex ?? f.createdAt
  
  if (prevSibling && nextSibling) newSortIndex = (getVal(prevSibling) + getVal(nextSibling)) / 2
  else if (prevSibling) newSortIndex = getVal(prevSibling) + 100
  else if (nextSibling) newSortIndex = getVal(nextSibling) - 100
  
  const updates: any = { sortIndex: newSortIndex }
  if (newParentId !== dragged.parentId) {
    updates.parentId = newParentId
  }
  
  await updateFolder(draggedId, updates)
}
</script>

<style scoped>
.sidebar-left { min-width: 180px; max-width: 400px; overflow: hidden; position: relative; background: var(--bg-sidebar); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-right: 1px solid var(--border); display: flex; flex-direction: column; }

/* ── Sidebar content wrapper (scroll area + scrollbar + resizer) ── */
.sidebar-content {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;          /* allow children to shrink inside flex column */
  overflow: hidden;
}

/* Resizer sits on the OUTER right edge of the sidebar (above the scrollbar). */
.sidebar-resizer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 6px;             /* a slightly wider hit-area than the visible 2px */
  z-index: 20;            /* always above the floating scrollbar (z-index 5) */
  cursor: col-resize;
  transition: background 0.2s ease;
}
.sidebar-resizer::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 2px;
  background: transparent;
  transition: background 0.2s ease;
}
.sidebar-resizer:hover::after,
.sidebar-resizer:active::after {
  background: var(--accent);
  opacity: 0.6;
}


/* Draggable / Magnetic Styles */
.draggable-list { flex: 1; }
.folder-ghost { opacity: 0.3; background: var(--accent-dim) !important; border-radius: 6px; }
.folder-drag { cursor: grabbing !important; box-shadow: 0 10px 25px rgba(0,0,0,0.4); transform: scale(1.02); z-index: 100; background: var(--bg-card) !important; }

/* Magnetic physical move animation */
.draggable-list > span { display: block; min-height: 10px; }
.folder-item { transition: background .15s, transform .2s var(--anim-spring-fast); }
.draggable-list .folder-item-move { transition: transform 0.4s var(--anim-spring); }

.lib-selector-wrap { position: relative; margin: 12px 10px 8px; }
.lib-selector { width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; display: flex; align-items: center; gap: 7px; cursor: pointer; color: var(--text-1); }
.lib-selector:hover { border-color: var(--border-hover); }
.lib-selector:active { transform: scale(0.95); transition: transform 0.05s; }
.lib-ico { width: 13px; height: 13px; flex-shrink: 0; color: var(--text-2); }
.lib-name { font-size: 12px; font-weight: 500; flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lib-chevron { width: 10px; height: 6px; color: var(--text-3); flex-shrink: 0; transition: transform .15s; }
.lib-chevron.open { transform: rotate(180deg); }
.lib-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--bg-sidebar); border: 1px solid var(--border); border-radius: 9px; z-index: 200; overflow: hidden; box-shadow: 0 0 0 1px rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.2), 0 16px 32px rgba(0,0,0,0.4), 0 24px 64px rgba(0,0,0,0.5); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); animation: popIn .2s var(--anim-spring-fast) forwards; transform-origin: top center; }
.lib-dd-header { padding: 10px 12px 2px; font-size: 12px; font-weight: 600; color: var(--text-1); }
.lib-dd-path { padding: 0 12px 8px; font-size: 10px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lib-dd-divider { height: 1px; background: var(--border); margin: 0 0 4px; }
.lib-dd-item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px 12px; background: transparent; border: none; color: var(--text-2); font-size: 12px; cursor: pointer; text-align: left; }
.lib-dd-item:hover { background: var(--bg-hover); color: var(--text-1); }
.lib-dd-item:active { transform: scale(0.95); transition: transform 0.05s; }
.lib-dd-item:last-child { margin-bottom: 4px; }
.lib-dd-item svg { width: 13px; height: 13px; flex-shrink: 0; }

.nav-section { padding: 4px 8px; }
.nav-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; background: transparent; border: none; color: var(--text-2); width: 100%; text-align: left; transition: background .15s, transform .2s var(--anim-spring-fast); }
.nav-item:hover { background: var(--bg-hover); transform: translateX(2px); }
.nav-item:active { transform: scale(0.95); transition: transform 0.05s; }
.nav-item.active { background: var(--accent-dim); color: var(--accent); }
.nav-item.active .nav-count { background: rgba(255, 255, 255, .25); color: var(--accent); }
.nav-ico { font-size: 12px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; text-align: center; }
.nav-ico svg { width: 13px; height: 13px; }
.nav-label { font-size: 12px; flex: 1; }
.nav-count { font-size: 10px; background: rgba(255, 255, 255, .07); padding: 1px 6px; border-radius: 10px; }
.nav-count--warn { background: rgba(255, 160, 50, .15); color: #ffa032; }
.nav-count--danger { background: rgba(255, 80, 80, .12); color: #ff5f57; }
.sidebar-divider { height: 1px; background: var(--border); margin: 8px 0; }

.section-header { padding: 4px 16px 4px; font-size: 10px; font-weight: 600; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; display: flex; align-items: center; }
.section-header span { flex: 1; }
.new-folder-btn { background: transparent; border: none; color: var(--text-3); font-size: 16px; line-height: 1; cursor: pointer; padding: 0 2px; opacity: 0; transition: opacity .15s; }
.section-header:hover .new-folder-btn { opacity: 1; }
.new-folder-btn:hover { color: var(--text-1); }

.sidebar-scroll-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.2s ease;
}
.sidebar-scroll-area:hover {
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}
/* WebKit/Blink */
.sidebar-scroll-area::-webkit-scrollbar {
  width: 6px;
}
.sidebar-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  transition: background 0.2s ease;
}
.sidebar-scroll-area::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}
.sidebar-scroll-area::-webkit-scrollbar-thumb:active {
  background: rgba(255, 255, 255, 0.55);
}


.folder-list { position: relative; display: flex; flex-direction: column; }
.folder-item { display: flex; align-items: center; gap: 7px; padding: 5px 16px; cursor: pointer; background: transparent; border: none; color: var(--text-2); width: 100%; text-align: left; transition: background .15s, transform .2s var(--anim-spring-fast); position: relative; }
.folder-item:hover { background: var(--bg-hover); transform: translateX(2px); }
.folder-item:active { transform: scale(0.95); transition: transform 0.05s; }
.folder-item.active { background: var(--accent); border-radius: 6px; margin: 0 8px; padding: 5px 8px; color: #fff; width: calc(100% - 16px); }
.folder-item.active .folder-count { background: rgba(255, 255, 255, .25); }

.folder-item.drag-over-inside { background: var(--accent-dim) !important; border: 1px dashed var(--accent) !important; border-radius: 6px; margin: 0 8px; padding: 4px 7px; width: calc(100% - 16px); color: var(--accent) !important; }

.drop-indicator { position: absolute; right: 0; height: 2px; background: var(--accent); pointer-events: none; z-index: 20; }
.drop-indicator::before { content: ''; position: absolute; top: -3px; left: -4px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
.drop-indicator--before { top: -1px; }
.drop-indicator--after { bottom: -1px; }

.folder-item:not([data-depth="0"])::before { content: ''; position: absolute; left: calc(16px + (var(--fd, 1) - 1) * 16px + 6px); top: 0; bottom: 0; width: 1px; background: rgba(255, 255, 255, 0.1); pointer-events: none; }
.folder-item:not([data-depth="0"])::after { content: ''; position: absolute; left: calc(16px + (var(--fd, 1) - 1) * 16px + 6px); top: 50%; width: 8px; height: 1px; background: rgba(255, 255, 255, 0.1); pointer-events: none; }
.folder-item[data-depth] { --fd: attr(data-depth integer, 1); }

.folder-toggle { width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; color: var(--text-3); transition: color .15s; margin-right: 2px; }
.folder-toggle:hover { color: var(--text-1); }
.folder-toggle svg { width: 8px; height: 8px; transition: transform .15s; transform: rotate(-90deg); }
.folder-toggle svg.open { transform: rotate(0deg); }

.folder-ico-wrap { display: flex; align-items: center; width: 16px; flex-shrink: 0; }
.folder-ico { width: 13px; height: 13px; flex-shrink: 0; }
.folder-custom-icon { font-size: 14px; line-height: 1; }
.folder-name { font-size: 12px; flex: 1; }
.folder-count { font-size: 10px; background: rgba(255, 255, 255, .07); padding: 1px 6px; border-radius: 10px; }
.watched-ico { color: var(--accent); opacity: 0.8; display: flex; align-items: center; }
.watched-ico svg { width: 12px; height: 12px; }

.folder-create-row { gap: 7px; cursor: default; }
.folder-create-row:hover { background: transparent; }
.folder-create-input { background: var(--bg-card); border: 1px solid var(--accent); border-radius: 4px; padding: 2px 6px; color: var(--text-1); font-size: 12px; flex: 1; outline: none; }

.sidebar-void-zone {
  flex: 1;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  margin: 10px;
  border-radius: 10px;
  border: 2px dashed transparent;
}
.sidebar-void-zone.is-drag-over {
  background: var(--accent-dim);
  border-color: var(--accent);
}
.void-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 500;
  pointer-events: none;
}

.sidebar-bottom { padding: 10px; border-top: 1px solid var(--border); }
.import-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 8px; color: var(--text-2); font-size: 12px; }
.import-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
.import-btn svg { width: 14px; height: 14px; }

@keyframes popIn {
  from { opacity: 0; transform: scale(.95); }
  to   { opacity: 1; transform: scale(1); }
}
</style>
