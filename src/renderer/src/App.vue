<template>
  <div class="app">

    <!-- ══════════════════════════════════════════════════════════════════
         SCENARIO A — WELCOME SCREEN (first launch / no library)
    ═══════════════════════════════════════════════════════════════════ -->
    <WelcomeScreen 
      v-if="!libraryInfo && !isRestoring" 
      :recent-libraries="recentLibraries" 
      @create="onWelcomeCreate" 
      @open="pickAndOpenLibrary" 
      @open-recent="openRecent" 
    />

    <!-- Restoring splash -->
    <div v-else-if="!libraryInfo && isRestoring" class="restoring">
      <div class="restoring-spinner"></div>
      <p class="restoring-text">Opening your library…</p>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════
         MAIN APP (library is open)
    ═══════════════════════════════════════════════════════════════════ -->
    <template v-else-if="libraryInfo">

      <!-- ── TOOLBAR ──────────────────────────────────────────────────── -->
      <Toolbar
        :is-mac="isMac"
        v-model:show-sidebar="showSidebar"
        :sidebar-width="sidebarWidth"
        :active-view="activeView"
        :items-length="items.length"
        v-model:zoom="zoom"
        v-model:active-layout="activeLayout"
        v-model:grid-show-name="gridShowName"
        v-model:grid-show-item-info="gridShowItemInfo"
        v-model:grid-item-info-type="gridItemInfoType"
        v-model:grid-show-extension="gridShowExtension"
        v-model:grid-show-subfolder="gridShowSubfolder"
        v-model:show-inspector="showInspector"
        v-model:filter-bar-open="filterBarOpen"
        v-model:search-text="searchText"
        v-model:itemSortBy="itemSortBy"
        v-model:itemSortDir="itemSortDir"
        :THEMES="THEMES"
        :ACCENT_COLORS="ACCENT_COLORS"
        :current-theme="currentTheme"
        :current-accent="currentAccent"
        :current-translucency="currentTranslucency"
        :show-back="!!detailItemId"
        @toggle-panels="uiStore.togglePanels"
        @empty-trash="emptyTrash"
        @search="onSearch"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @minimize="minimizeWindow"
        @maximize="maximizeWindow"
        @close="closeWindow"
        @preview-theme="previewTheme"
        @clear-preview="clearPreview"
        @select-theme="selectTheme"
        @select-accent="selectAccent"
        @select-translucency="selectTranslucency"
        @back="closeDetailView"
      />

      <!-- ── BODY ──────────────────────────────────────────────────────── -->
      <div class="body">

        <!-- LEFT SIDEBAR -->
        <Sidebar
          v-motion
          :initial="{ x: -sidebarWidth - 20, opacity: 0 }"
          :enter="{ x: 0, opacity: 1 }"
          v-if="showSidebar"
          v-model:width="sidebarWidth"
          :active-view="activeView"
          :active-folder-id="activeFolderId"
          :selected-folder-ids="selectedFolderIds"
          :folders-open="foldersOpen"
          :library-info="libraryInfo"
          :library-path="libraryPath || ''"
          :sidebar-counts="sidebarCounts"
          :recently-viewed-length="recentlyViewed.length"
          :folders-length="folders.length"
          :derived-folders="derivedFolders"
          :pinned-folders="pinnedFolders"
          :is-creating-folder="isCreatingFolder"
          v-model:new-folder-name="newFolderName"
          :pending-subfolder-parent-id="pendingSubfolderParentId"
          :renaming-folder-id="renamingFolderId"
          v-model:rename-folder-name="renameFolderName"
          :folder-drag-target-id="folderDragTargetId"
          :folder-drop-position="folderDropPosition"
          :get-folder-icon-path="getFolderIconPath"
          :get-watch-path="getWatchPath"
          @set-view="setView"
          @set-folder="setFolder"
          @toggle-expand="toggleFolderExpand"
          @open-switcher="openSwitcher"
          @prompt-new-folder="promptNewFolder"
          @submit-new-folder="submitNewFolder"
          @cancel-new-folder="cancelNewFolder"
          @start-rename-folder="startRenameFolder"
          @submit-rename-folder="submitRenameFolder"
          @cancel-rename-folder="cancelRenameFolder"
          @folder-contextmenu="openFolderCtxMenu"
          @folder-dragstart="onSidebarFolderDragStart"
          @folder-dragenter="onSidebarFolderDragEnter"
          @folder-dragleave="onSidebarFolderDragLeave"
          @folder-dragover="onSidebarFolderDragOver"
          @folder-drop="onSidebarFolderDrop"
          @os-drop-void="onSidebarOsDropVoid"
          @import="doImport"
        />

        <!-- CENTER WRAPPER (Filters + Gallery) -->
        <div class="center-wrapper">
          <div class="filter-bar" v-show="filterBarOpen">
            <div class="fb-item">
              <span class="fb-label">Format</span>
              <select class="fb-select" v-model="filters.ext" @change="onFilterChange">
                <option value="">All</option>
                <option value="png">PNG</option>
                <option value="jpg">JPG / JPEG</option>
                <option value="gif">GIF</option>
                <option value="webp">WEBP</option>
                <option value="svg">SVG</option>
                <option value="mp4">MP4</option>
                <option value="mov">MOV</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div class="fb-item">
              <span class="fb-label">Orientation</span>
              <select class="fb-select" v-model="filters.orientation" @change="onFilterChange">
                <option value="">All</option>
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
                <option value="square">Square</option>
              </select>
            </div>
            <div class="fb-item">
              <span class="fb-label">Size</span>
              <select class="fb-select" v-model="filters.size" @change="onFilterChange">
                <option value="">All</option>
                <option value="small">Small (&lt; 1MB)</option>
                <option value="medium">Medium (1 - 5MB)</option>
                <option value="large">Large (&gt; 5MB)</option>
              </select>
            </div>
            <div class="fb-item">
              <span class="fb-label">Date Added</span>
              <select class="fb-select" v-model="filters.date" @change="onFilterChange">
                <option value="">Any Time</option>
                <option value="today">Today</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="year">Past Year</option>
              </select>
            </div>
            <div class="fb-item">
              <span class="fb-label">Tag</span>
              <select class="fb-select" v-model="filters.tag" @change="onFilterChange">
                <option value="">All</option>
                <option v-for="t in allTagsList" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div style="flex:1"></div>
            <button class="fb-clear" v-if="hasActiveFilters" @click="clearFilters">Clear</button>
          </div>

          <DetailView
            v-if="detailItemId && activeDetailItem"
            :item="activeDetailItem"
            @close="closeDetailView"
            @next="nextDetailItem"
            @prev="prevDetailItem"
          />

          <Gallery
            v-else
            :items="items"
            :selected-items="selectedItems"
            :selected-ids="selectedIds"
            :active-layout="activeLayout"
            :active-view="activeView"
            :active-tag="activeTag"
            :active-folder-id="activeFolderId"
            :is-loading="isLoading"
            :import-progress="importProgress"
            :child-folders="folders.filter(f => f.parentId === activeFolderId)"
            :grid-show-name="gridShowName"
            :grid-show-item-info="gridShowItemInfo"
            :grid-item-info-type="gridItemInfoType"
            :grid-show-extension="gridShowExtension"
            :grid-show-subfolder="gridShowSubfolder"
            :sidebar-counts="sidebarCounts"
            :thumb-cache="thumbCache"
            :zoom="zoom"
            :global-mute="globalMute"
            :format-size="formatSize"
            :format-date="formatDate"
            :format-duration="formatDuration"
            :ext-icon="extIcon"
            :is-video="isVideo"
            :get-media-url="getMediaUrl"
            :get-thumb="library.getThumb"
            :folder-preview-thumbs="folderPreviewThumbs"
            @update:gridShowSubfolder="gridShowSubfolder = $event"
            @update:selectedItems="onUpdateSelectedItems"
            @import="doImport"
            @item-dblclick="onItemDblClick"
            @restore-selection="shortcutsState.undoLast"
            @purge-selection="onPermanentDeleteSelection"
            @set-folder="setFolder"
            @deselect="library.deselect"
            @select-item="library.selectItem"
            @dragstart="onItemDragStart"
            @drop-files="onGalleryDropFiles"
            @drop-url="onGalleryDropUrl"
            @toggle-mute="uiStore.toggleMute"
            @fetch-thumb="library.fetchThumb"
            @fallback-thumb="onFallbackThumb"
          />
        </div>

        <!-- RIGHT INSPECTOR -->
        <Inspector
          v-if="showInspector"
          :selected-items="selectedItems"
          :full-meta="fullMeta"
          :selected-folder="selectedFolder"
          :folders="folders"
          :active-view="activeView"
          :sidebar-counts="sidebarCounts"
          :get-thumb="library.getThumb"
          :ext-icon="extIcon"
          :format-size="formatSize"
          :format-date="formatDate"
          :format-date-folder="formatDateFolder"
          :folder-name="id => folders.find(f => f.id === id)?.name || id"
          @update-item="library.updateItem"
          @update-folder="library.updateFolder"
          @delete-selection="onDeleteSelection"
          @restore-selection="shortcutsState.undoLast"
          @purge-selection="onPermanentDeleteSelection"
          @open-url="openUrl"
          @refresh-counts="handleBatchUpdate"
          @find-similar="onFindSimilar"
          @fetch-meta="library.fetchFullMeta"
          @export-selection="onExportSelection"
        />
      </div>
    </template>

    <!-- MODALS -->
    <LibrarySwitcher
      v-if="switcherOpen"
      :recent-libraries="recentLibraries"
      :library-path="libraryPath || ''"
      @close="switcherOpen=false"
      @create="onSwitcherCreate"
      @open="onSwitcherOpen"
      @switch="switchToLibrary"
      @remove="library.removeRecentLibrary"
    />

    <div v-if="newLibNameDialog.open" class="modal-backdrop" @click.self="newLibNameDialog.open=false">
      <div class="name-dialog">
        <p class="nd-title">Name your library</p>
        <input class="nd-input" v-model="newLibNameDialog.name" @keydown.enter="confirmNewLib"
          placeholder="e.g. Design Inspiration" ref="nameInputRef" />
        <div class="nd-actions">
          <button class="nd-cancel" @click="newLibNameDialog.open=false">Cancel</button>
          <button class="nd-confirm" @click="confirmNewLib" :disabled="!newLibNameDialog.name.trim()">Create</button>
        </div>
      </div>
    </div>


    <QuickView
      :open="quickViewOpen && selectedItems.length === 1"
      :item="selectedItems[0]"
      :thumb-url="selectedItems[0] ? library.getThumb(selectedItems[0].id) : ''"
      @close="quickViewOpen = false"
    />

    <DuplicateDialog
      :model-value="dupDialogOpen"
      @update:model-value="dupDialogOpen = $event"
      :existing="dupCurrentDup?.existing ?? null"
      :incoming-path="dupCurrentDup?.srcPath ?? ''"
      :incoming-name="dupCurrentDup?.name ?? ''"
      :incoming-ext="dupCurrentDup?.ext ?? ''"
      :incoming-meta="dupCurrentDup?.meta ?? ''"
      :remaining-count="dupRemainingCount"
      @resolve="onDupResolve"
      @cancel="onDupCancel"
    />

    <ExportDialog
      v-model="exportDialogOpen"
      :item="currentEnhancedItem"
      :remaining-count="enhancedRemainingCount"
      @resolve="resolveDialog"
      @cancel="cancelExport"
    />

    <ExportConflictDialog
      v-model="conflictDialogOpen"
      :conflict="currentConflict"
      :remaining-count="conflictRemainingCount"
      @resolve="resolveDialog"
      @cancel="cancelExport"
    />

    <div v-if="folderCtxMenu.open" class="ctx-backdrop" @mousedown.self="closeFolderCtxMenu"></div>
    <div v-if="folderCtxMenu.open" class="folder-ctx-menu" :style="{ top: folderCtxMenu.y + 'px', left: folderCtxMenu.x + 'px' }">
      <button class="ctx-item" @click="ctxNewFolder">
        <svg class="ctx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="8" y1="5" x2="8" y2="11"/><line x1="5" y1="8" x2="11" y2="8"/></svg>
        <span class="ctx-label">New Folder <span class="ctx-sub-label">(N)</span></span>
        <span class="ctx-shortcut">Ctrl+Shift+N</span>
      </button>
      <button class="ctx-item" @click="ctxNewSubfolder">
        <svg class="ctx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4v8a2 2 0 0 02 2h8a2 2 0 0 02-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M8 6v4m-2-2h4"/></svg>
        <span class="ctx-label">New Subfolder <span class="ctx-sub-label">(S)</span></span>
        <span class="ctx-shortcut">Alt+N</span>
      </button>
      <div class="ctx-item ctx-item--has-sub" @mouseenter="ctxSubmenu='move'" @mouseleave="ctxSubmenu=null">
        <svg class="ctx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 8h8M6 5l-2 3 2 3M10 5l2 3-2 3"/></svg>
        <span class="ctx-label">Move Folder <span class="ctx-sub-label">(M)</span></span>
        <span class="ctx-shortcut">Ctrl+M</span>
        <svg class="ctx-arrow" viewBox="0 0 6 10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 1l4 4-4 4"/></svg>
        <div v-if="ctxSubmenu==='move'" class="ctx-submenu ctx-move-submenu">
          <button class="ctx-item ctx-item--root" @click="ctxMoveTo(null)">
            <svg class="ctx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4v8a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H4a2 2 0 00-2 2z"/></svg>
            <span class="ctx-label">Move to Root</span>
          </button>
          <div v-if="movableFolders.length" class="ctx-separator"></div>
          <button
            v-for="f in movableFolders"
            :key="f.id"
            class="ctx-item ctx-item--folder"
            :style="{ paddingLeft: (12 + folderDepth(f.id) * 12) + 'px' }"
            @click="ctxMoveTo(f.id)"
          >
            <svg class="ctx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4v8a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H4a2 2 0 00-2 2z"/></svg>
            <span class="ctx-label">{{ f.name }}</span>
          </button>
          <div v-if="!movableFolders.length" class="ctx-empty-hint">No other folders</div>
        </div>
      </div>

      <div class="ctx-separator"></div>
      
      <button class="ctx-item" @click="ctxRename">
        <svg class="ctx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3L5 14H2v-3L11 2z"/></svg>
        <span class="ctx-label">Rename <span class="ctx-sub-label">(R)</span></span>
        <span class="ctx-shortcut">F2</span>
      </button>
      <button class="ctx-item" @click="ctxTogglePin">
        <svg class="ctx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v12m-4-8l4-4 4 4"/></svg>
        <span class="ctx-label">{{ folderCtxMenu.folder?.isPinned ? 'Unpin' : 'Pin to Top' }}</span>
      </button>

      <div class="ctx-separator"></div>

      <div class="ctx-item ctx-item--has-sub" @mouseenter="ctxSubmenu='sort'" @mouseleave="ctxSubmenu=null">
        <svg class="ctx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M3 8h7M3 12h4"/></svg>
        <span class="ctx-label">Sort Current Level By</span>
        <svg class="ctx-arrow" viewBox="0 0 6 10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 1l4 4-4 4"/></svg>
        <div v-if="ctxSubmenu==='sort'" class="ctx-submenu">
          <button class="ctx-item" @click="ctxSetSort(null)">
            <span class="ctx-ico" v-if="!folderSortMap[folderCtxMenu.folder?.parentId || 'root']">✓</span>
            Default (Custom)
          </button>
          <button class="ctx-item" @click="ctxSetSort('name')">
            <span class="ctx-ico" v-if="folderSortMap[folderCtxMenu.folder?.parentId || 'root'] === 'name'">✓</span>
            Name
          </button>
          <button class="ctx-item" @click="ctxSetSort('date')">
            <span class="ctx-ico" v-if="folderSortMap[folderCtxMenu.folder?.parentId || 'root'] === 'date'">✓</span>
            Date Created
          </button>
          <button class="ctx-item" @click="ctxSetSort('size')">
            <span class="ctx-ico" v-if="folderSortMap[folderCtxMenu.folder?.parentId || 'root'] === 'size'">✓</span>
            Size / Count
          </button>
        </div>
      </div>

      <div class="ctx-item ctx-item--has-sub" @mouseenter="ctxSubmenu='color'" @mouseleave="ctxSubmenu=null">
        <svg class="ctx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>
        <span class="ctx-label">Assign Color</span>
        <svg class="ctx-arrow" viewBox="0 0 6 10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 1l4 4-4 4"/></svg>
        <div v-if="ctxSubmenu==='color'" class="ctx-submenu ctx-color-grid">
          <div class="ctx-color-swatch ctx-color-none" @click="ctxSetColor(null)">×</div>
          <div v-for="c in CTX_COLORS" :key="c" class="ctx-color-swatch" :style="{ background: c }" @click="ctxSetColor(c)"></div>
        </div>
      </div>

      <div class="ctx-item ctx-item--has-sub" @mouseenter="ctxSubmenu='icon'" @mouseleave="ctxSubmenu=null">
        <svg class="ctx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4v8a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H4a2 2 0 00-2 2z"/></svg>
        <span class="ctx-label">Change Icon</span>
        <svg class="ctx-arrow" viewBox="0 0 6 10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 1l4 4-4 4"/></svg>
        <div v-if="ctxSubmenu==='icon'" class="ctx-submenu ctx-icon-grid">
          <button class="ctx-icon-btn ctx-icon-none" @click="ctxSetIcon(null)">×</button>
          <button v-for="ico in CTX_ICONS" :key="ico.id" class="ctx-icon-btn" @click="ctxSetIcon(ico.id)" title="ico.id">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px" v-html="ico.path"></svg>
          </button>
        </div>
      </div>

      <div class="ctx-separator"></div>

      <button v-if="!getWatchPath(folderCtxMenu.folder?.id)" class="ctx-item" @click="ctxWatchFolder">
        <svg class="ctx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><polyline points="8,5 8,8 10,10"/></svg>
        <span class="ctx-label">Set Watch Folder</span>
      </button>
      <button v-else class="ctx-item" @click="ctxStopWatching">
        <svg class="ctx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><line x1="5" y1="5" x2="11" y2="11"/><line x1="11" y1="5" x2="5" y2="11"/></svg>
        <span class="ctx-label">Stop Watching</span>
      </button>

      <div class="ctx-separator"></div>
      <button class="ctx-item ctx-item--danger" @click="ctxDeleteFolder">
        <svg class="ctx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12m-9 0V3a1 1 0 011-1h4a1 1 0 011 1v1M4 4h8v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg>
        <span class="ctx-label">Delete Folder</span>
      </button>
    </div>

    <Toaster position="bottom-right" rich-colors close-button />
    <div v-if="tooltip.visible" class="drag-ghost-badge" :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }">{{ tooltip.text }}</div>

    <ConfirmDialog
      :open="confirmDialog.open"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :action-label="confirmDialog.actionLabel"
      :action-class="confirmDialog.actionClass"
      @close="closeConfirmDialog"
      @confirm="executeConfirmDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Toaster, toast } from 'vue-sonner'
import { useUIStore } from './stores/ui'
import { storeToRefs } from 'pinia'

// Components
import Sidebar from './components/Sidebar.vue'
import Inspector from './components/Inspector.vue'
import Toolbar from './components/Toolbar.vue'
import Gallery from './components/Gallery.vue'
import DuplicateDialog from './components/DuplicateDialog.vue'
import ExportDialog from './components/ExportDialog.vue'
import ExportConflictDialog from './components/ExportConflictDialog.vue'
import WelcomeScreen from './components/WelcomeScreen.vue'
import LibrarySwitcher from './components/LibrarySwitcher.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import QuickView from './components/QuickView.vue'
import DetailView from './components/DetailView.vue'

// Composables
import { useLibrary, restoreLastLibrary } from './composables/useLibrary'
import { useDuplicateImport } from './composables/useDuplicateImport'
import { useTheme } from './composables/useTheme'
import { useAppFolders } from './composables/useAppFolders'
import { useAppSearch } from './composables/useAppSearch'
import { useAppShortcuts } from './composables/useAppShortcuts'
import { useExport } from './composables/useExport'

import { formatSize, formatDate, formatDateFolder, formatDuration } from './formatters'

// ─── Stores & Base Composables ──────────────────────────────────────────────
const uiStore = useUIStore()
const {
  showSidebar, showInspector, sidebarWidth, zoom, activeLayout,
  gridShowName, gridShowItemInfo, gridItemInfoType, gridShowExtension, gridShowSubfolder,
  filterBarOpen, globalMute
} = storeToRefs(uiStore)

const library = useLibrary()
const {
  libraryInfo, libraryPath, items, selectedItems, fullMeta, lastSelected,
  isLoading, isRestoring, recentLibraries, importProgress, repairProgress, thumbCache,
  recentlyViewed, allTagsList, sidebarCounts, watchFolders,
  pickAndOpenLibrary, createLibrary, openLibrary, createNewLibrary, removeRecentLibrary
} = library

const {
  dialogOpen: dupDialogOpen,
  currentDup: dupCurrentDup,
  remainingCount: dupRemainingCount,
  onResolve: onDupResolve,
  onCancel: onDupCancel,
  importWithDupCheck,
  pickAndImportWithDupCheck
} = useDuplicateImport()

const { 
  startExport, 
  exportDialogOpen, 
  currentEnhancedItem, 
  enhancedRemainingCount,
  conflictDialogOpen,
  currentConflict,
  conflictRemainingCount,
  resolveDialog,
  cancelExport
} = useExport()

const {
  THEMES, ACCENT_COLORS, currentTheme, currentAccent, currentTranslucency,
  previewTheme, clearPreview, selectTheme, selectAccent, selectTranslucency, initTheme
} = useTheme()

// ─── Feature-Specific Composables ───────────────────────────────────────────
const foldersState = useAppFolders()
const {
  folders, pinnedFolders, derivedFolders, expandedFolders, folderSortMap,
  isCreatingFolder, newFolderName, pendingSubfolderParentId,
  renamingFolderId, renameFolderName, folderDragTargetId, folderDropPosition,
  subfolderThumbCache, toggleFolderExpand, promptNewFolder, submitNewFolder,
  cancelNewFolder, startRenameFolder, submitRenameFolder, cancelRenameFolder,
  handleFolderDragHover, clearFolderDragState
} = foldersState

const searchState = useAppSearch()
const {
  searchText, itemSortBy, itemSortDir, activeView, activeTag, activeFolderId, selectedFolderIds, filters, hasActiveFilters,
  clearFilters, onFilterChange, reloadCurrentView, onFindSimilar, onSearch,
  setView, handleBatchUpdate
} = searchState

// ─── Detail View State (Must be defined before useAppShortcuts) ──────────────
const detailItemId = ref<string | null>(null)

const activeDetailItem = computed(() => {
  if (!detailItemId.value || !items.value) return null
  return items.value.find(i => i.id === detailItemId.value) || null
})

function closeDetailView() {
  detailItemId.value = null
}

function nextDetailItem() {
  if (!detailItemId.value || !items.value || items.value.length === 0) return
  const idx = items.value.findIndex(i => i.id === detailItemId.value)
  if (idx !== -1 && idx < items.value.length - 1) {
    const nextItem = items.value[idx + 1]
    detailItemId.value = nextItem.id
    library.selectItem(nextItem, false, false)
  }
}

function prevDetailItem() {
  if (!detailItemId.value || !items.value || items.value.length === 0) return
  const idx = items.value.findIndex(i => i.id === detailItemId.value)
  if (idx > 0) {
    const prevItem = items.value[idx - 1]
    detailItemId.value = prevItem.id
    library.selectItem(prevItem, false, false)
  }
}

// ─── Shortcuts ──────────────────────────────────────────────────────────────
const quickViewOpen = ref(false)
const folderCtxMenu = ref({ open: false, x: 0, y: 0, folder: null as any })
const ctxSubmenu = ref<string | null>(null)
const CTX_COLORS = ['#ff5f57', '#ffbd2e', '#28c840', '#007aff', '#a37cf0', '#eb4d4b', '#f0932b', '#f9ca24', '#6ab04c', '#22a6b3']

const shortcutsState = useAppShortcuts({
  activeView, selectedItems, items, lastSelected, activeFolderId, folders,
  quickViewOpen, folderCtxMenu,
  libraryInfo, detailItemId, reloadCurrentView, deselect: library.deselect,
  selectItem: library.selectItem, onDeleteSelection, onPermanentDeleteSelection,
  togglePanels: uiStore.togglePanels, promptNewFolder, startRenameFolder, importWithDupCheck,
  closeDetailView, nextDetailItem, prevDetailItem,
  ctxWatchFolder, ctxStopWatching // Pass these if needed by shortcuts
})

const {
  tooltip, onGlobalPaste, onGlobalKeydown, onGlobalMouseOver, onGlobalMouseOut, pushUndo
} = shortcutsState

// Sync folderSortMap between search and folders
watch(searchState.folderSortMap, (val) => { foldersState.folderSortMap.value = val }, { deep: true })
watch(foldersState.folderSortMap, (val) => { searchState.folderSortMap.value = val }, { deep: true })

// ─── Component State ────────────────────────────────────────────────────────
const selectedIds = computed(() => new Set((selectedItems.value || []).map(i => i.id)))
const isMac = navigator.platform.toLowerCase().includes('mac')
const switcherOpen = ref(false)
const nameInputRef = ref<HTMLInputElement>()
const newLibNameDialog = ref({ open: false, name: '', chosenPath: '' })
const foldersOpen = ref(true)

const selectedFolder = computed(() => {
  if (library.selectedItem.value) return null
  if (!activeFolderId.value) return null
  return folders.value.find(f => f.id === activeFolderId.value) ?? null
})

const CTX_ICONS = [
  { id: 'heart', path: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>' },
  { id: 'star', path: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>' },
  { id: 'camera', path: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle>' },
  { id: 'video', path: '<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>' },
  { id: 'music', path: '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>' },
  { id: 'box', path: '<path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.78 0l-8-4a2 2 0 0 1-1.11-1.79V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z"></path><polyline points="2.32 6.16 12 11 21.68 6.16"></polyline><line x1="12" y1="22.76" x2="12" y2="11"></line>' },
  { id: 'briefcase', path: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>' },
  { id: 'layout', path: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line>' },
  { id: 'book', path: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>' },
  { id: 'lock', path: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' },
  { id: 'globe', path: '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>' },
  { id: 'smile', path: '<circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line>' },
  { id: 'zap', path: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>' },
  { id: 'cpu', path: '<rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line>' },
  { id: 'flag', path: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>' }
]
function getFolderIconPath(id: string) { return CTX_ICONS.find(i => i.id === id)?.path ?? null }

async function onSwitcherCreate() {
  switcherOpen.value = false
  const chosen = await library.createNewLibrary()
  if (chosen) { newLibNameDialog.value = { open: true, name: '', chosenPath: chosen as string }; nextTick(() => nameInputRef.value?.focus()) }
}

function openSwitcher() { switcherOpen.value = true }
function onSwitcherOpen() { switcherOpen.value = false; library.pickAndOpenLibrary() }
function onFallbackThumb(id: string, url: string) { thumbCache[id] = url }
function onUpdateSelectedItems(val: any[]) { selectedItems.value = val; if (val.length !== 1) fullMeta.value = null }

// ─── Confirm Dialog State ───────────────────────────────────────────────────
const confirmDialog = ref({
  open: false, title: '', message: '', actionLabel: 'Confirm',
  actionClass: 'cd-confirm--blue', onConfirm: null as (() => Promise<void> | void) | null
})

function openConfirmDialog(title: string, message: string, actionLabel: string, actionClass: string, onConfirm: () => Promise<void>|void) {
  confirmDialog.value = { open: true, title, message, actionLabel, actionClass, onConfirm }
}

function closeConfirmDialog() {
  confirmDialog.value.open = false
  confirmDialog.value.onConfirm = null
}

async function executeConfirmDialog() {
  if (confirmDialog.value.onConfirm) await confirmDialog.value.onConfirm()
  closeConfirmDialog()
}

// ─── Actions ────────────────────────────────────────────────────────────────
async function setFolder(id: string, e?: MouseEvent) {
  const multi = Boolean(e && (e.ctrlKey || e.metaKey))
  await searchState.setFolder(id, library.deselect, multi)
  const children = folders.value.filter(f => f.parentId === id)
  if (children.length) loadSubfolderPreviews(children.map(f => f.id))
}

async function loadSubfolderPreviews(folderIds: string[]) {
  for (const fid of folderIds) {
    try {
      const r = await window.api.invoke('search:query', {
        folders: [fid], isDeleted: false, limit: 4, sortBy: 'importTime', sortDir: 'desc'
      })
      const thumbs: string[] = []
      for (const entry of r.items) {
        const cached = library.getThumb(entry.id)
        if (cached) thumbs.push(cached)
        else {
          const targetPath = entry.thumbnailPath ?? entry.contentPath
          try {
            const dataUrl = `media://local/${encodeURIComponent(targetPath)}`
            thumbCache[entry.id] = dataUrl
            thumbs.push(dataUrl)
          } catch { }
        }
        if (thumbs.length >= 4) break
      }
      subfolderThumbCache.value[fid] = thumbs
    } catch { }
  }
}

function folderPreviewThumbs(fid: string): string[] {
  return subfolderThumbCache.value[fid] ?? []
}

async function doImport() {
  await pickAndImportWithDupCheck(activeFolderId.value)
  await reloadCurrentView()
}

async function onGalleryDropFiles(paths: string[]) {
  if (!libraryInfo.value) return
  const internalPaths = new Set(items.value.map(i => i.contentPath))
  const externalPaths = paths.filter(p => !internalPaths.has(p))
  if (externalPaths.length > 0) {
    await importWithDupCheck(externalPaths, activeFolderId.value)
    await reloadCurrentView()
  }
}

async function onGalleryDropUrl(url: string) {
  if (!libraryInfo.value) return
  await window.api.invoke('item:importFromUrl', url, activeFolderId.value ?? undefined)
  await reloadCurrentView()
}

function onItemDblClick(item: any) {
  detailItemId.value = item.id
  library.selectItem(item, false, false)
}

// ─── Folder Context Menu ────────────────────────────────────────────────────
function openFolderCtxMenu(folder: any, e: MouseEvent) {
  const MENU_W = 240, MENU_H = 480
  const x = Math.min(e.clientX, window.innerWidth - MENU_W)
  const y = Math.min(e.clientY, window.innerHeight - MENU_H)
  folderCtxMenu.value = { open: true, x, y, folder }
  ctxSubmenu.value = null
}

function closeFolderCtxMenu() { folderCtxMenu.value.open = false; ctxSubmenu.value = null }

async function ctxNewFolder() { closeFolderCtxMenu(); await promptNewFolder() }
async function ctxNewSubfolder() {
  const parent = folderCtxMenu.value.folder; closeFolderCtxMenu()
  if (parent) await promptNewFolder(parent.id)
}
// ─── Move Folder (submenu with folder tree + confirmation) ────────────────────

// Check if `candidateId` is the same as `ancestorId` or any of its descendants
function isDescendantOrSelf(candidateId: string, ancestorId: string | null): boolean {
  if (!ancestorId) return false
  if (candidateId === ancestorId) return true
  let current: any = folders.value.find(f => f.id === candidateId)
  while (current && current.parentId) {
    if (current.parentId === ancestorId) return true
    current = folders.value.find(f => f.id === current.parentId)
  }
  return false
}

// Count parent-chain depth for tree indentation
function folderDepth(folderId: string): number {
  let depth = 0
  let current: any = folders.value.find(f => f.id === folderId)
  while (current && current.parentId) {
    depth++
    current = folders.value.find(f => f.id === current.parentId)
    if (depth > 20) break // safety
  }
  return depth
}

// All folders the source folder can be moved INTO (excludes self + descendants)
const movableFolders = computed(() => {
  const srcId = folderCtxMenu.value.folder?.id
  if (!srcId) return []
  return folders.value
    .filter(f => !isDescendantOrSelf(f.id, srcId))
    .sort((a, b) => {
      // Sort by parentId chain so the tree reads top-to-bottom
      const aDepth = folderDepth(a.id)
      const bDepth = folderDepth(b.id)
      if (aDepth !== bDepth) return aDepth - bDepth
      return (a.name || '').localeCompare(b.name || '')
    })
})

// Resolve full path name of a folder for display
function folderPathName(folderId: string): string {
  const parts: string[] = []
  let current: any = folders.value.find(f => f.id === folderId)
  let safety = 0
  while (current && safety++ < 20) {
    parts.unshift(current.name || '?')
    if (!current.parentId) break
    current = folders.value.find(f => f.id === current.parentId)
  }
  return parts.length > 1 ? parts.join(' / ') : (current?.name || 'Root')
}

function ctxMoveTo(parentId: string | null) {
  const f = folderCtxMenu.value.folder
  closeFolderCtxMenu()
  if (!f) return

  // Safety: don't move into self/descendants
  if (parentId && isDescendantOrSelf(parentId, f.id)) {
    toast.error('Cannot move a folder into itself or its subfolder')
    return
  }

  // No-op if already at target
  if ((f.parentId ?? null) === parentId) {
    toast('Folder is already there', { icon: 'ℹ️' })
    return
  }

  const destName = parentId ? folderPathName(parentId) : 'Root'
  openConfirmDialog(
    'Move Folder',
    `Move "${f.name}" into "${destName}"?`,
    'Move',
    'cd-confirm--blue',
    async () => {
      // Append to end of target's children
      const siblings = folders.value.filter(x => x.parentId === parentId && x.id !== f.id)
      const maxSort = siblings.reduce((max, s) => Math.max(max, (s as any).sortIndex ?? (s as any).createdAt ?? 0), 0)
      await library.updateFolder(f.id, {
        parentId,
        sortIndex: maxSort + 100
      } as any)
      await handleBatchUpdate()
      if (activeFolderId.value === f.id) {
        // Folder we're viewing changed parent — re-resolve items
        await reloadCurrentView()
      }
      toast.success(`Moved "${f.name}" to ${destName}`)
    }
  )
}

function ctxRename() { const f = folderCtxMenu.value.folder; closeFolderCtxMenu(); if (f) startRenameFolder(f) }
function ctxTogglePin() { const f = folderCtxMenu.value.folder; if (f) library.updateFolder(f.id, { isPinned: !f.isPinned }); closeFolderCtxMenu() }

async function ctxSetColor(color: string | null) {
  const f = folderCtxMenu.value.folder; closeFolderCtxMenu()
  if (f) await library.updateFolder(f.id, { color })
}
async function ctxSetIcon(icon: string | null) {
  const f = folderCtxMenu.value.folder; closeFolderCtxMenu()
  if (f) await library.updateFolder(f.id, { icon })
}

function ctxSetSort(val: string | null) {
  const parentId = folderCtxMenu.value.folder?.parentId || 'root'
  const newMap = { ...folderSortMap.value }
  if (val) newMap[parentId] = val
  else delete newMap[parentId]
  folderSortMap.value = newMap
  closeFolderCtxMenu()
  // Trigger refresh of current view in case active folder sort changed
  reloadCurrentView()
}

async function ctxWatchFolder() {
  const folder = folderCtxMenu.value.folder || folders.value.find(f => f.id === activeFolderId.value)
  closeFolderCtxMenu()
  if (!folder) {
    toast.error('Select a folder to watch first')
    return
  }
  const paths = await window.api.invoke('dialog:pickFolders')
  if (paths && paths.length > 0) {
    await library.setWatchFolder(folder.id, paths[0])
    toast.success(`Now watching: ${paths[0]}`)
  }
}

async function ctxStopWatching() {
  const folder = folderCtxMenu.value.folder || folders.value.find(f => f.id === activeFolderId.value)
  closeFolderCtxMenu()
  if (folder) {
    await library.removeWatchFolder(folder.id)
    toast.success(`Stopped watching folder`)
  }
}

function ctxDeleteFolder() {
  const f = folderCtxMenu.value.folder; closeFolderCtxMenu()
  if (!f) return
  openConfirmDialog('Delete Folder', `Delete "${f.name}"? Items inside will be moved to the Trash.`, 'Delete', 'cd-confirm--red', async () => {
    await library.deleteFolder(f.id)
    if (activeFolderId.value === f.id) activeFolderId.value = null
    await reloadCurrentView()
  })
}
function getWatchPath(folderId: string) { return watchFolders.value.find((w: any) => w.folderId === folderId)?.osPath }

// ─── Trash & Deletion ───────────────────────────────────────────────────────
async function onDeleteSelection() {
  if (selectedItems.value.length === 0) return
  const ids = selectedItems.value.map(i => i.id)
  pushUndo({ type: 'delete', ids })
  for (const id of ids) await library.deleteItem(id)
  library.deselect()
}

async function onPermanentDeleteSelection() {
  if (selectedItems.value.length === 0) return
  openConfirmDialog('Delete Permanently', `Are you sure you want to permanently delete ${selectedItems.value.length} item(s)?`, 'Delete Permanently', 'cd-confirm--red', async () => {
    for (const item of [...selectedItems.value]) await library.purgeItem(item.id)
    library.deselect(); await reloadCurrentView()
  })
}

async function emptyTrash() {
  if (items.value.length === 0) return
  openConfirmDialog('Empty Trash', `Permanently delete all ${items.value.length} items in the trash?`, 'Empty Trash', 'cd-confirm--red', async () => {
    const trashItems = [...items.value]
    for (const item of trashItems) await library.purgeItem(item.id)
    library.deselect(); await reloadCurrentView()
  })
}

// ─── Drag & Drop ────────────────────────────────────────────────────────────
function onItemDragStart(item: any, e: DragEvent) {
  if (!selectedItems.value.some(i => i.id === item.id)) library.selectItem(item, false, false)
  
  const ids = selectedItems.value.map(i => i.id)
  if (e.dataTransfer) {
    e.dataTransfer.setData('application/x-eagle-items', JSON.stringify(ids))
    e.dataTransfer.effectAllowed = 'copyMove'
    
    // Create a small custom drag ghost element
    const ghost = document.createElement('div')
    ghost.style.cssText = `
      position: absolute; top: -1000px;
      background: var(--accent); color: white;
      font-weight: bold; font-size: 14px;
      padding: 6px 12px; border-radius: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      font-family: sans-serif; pointer-events: none;
      white-space: nowrap; z-index: -1;
    `
    ghost.textContent = ids.length > 1 ? `Moving ${ids.length} items` : `Moving 1 item`
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    
    // Cleanup the ghost element after a short delay
    setTimeout(() => {
      if (document.body.contains(ghost)) document.body.removeChild(ghost)
    }, 0)
  }

  const filePaths = selectedItems.value.map(i => (i as any).contentPath).filter(Boolean)
  if (filePaths.length > 0) {
    let iconPath: string | undefined = undefined
    const thumbUrl = library.getThumb(selectedItems.value[0].id)
    if (thumbUrl?.startsWith('media://local/')) iconPath = decodeURIComponent(thumbUrl.slice('media://local/'.length))
    window.api.invoke('item:startNativeDrag', { filePaths, iconPath })
  }
}

function onSidebarFolderDragStart(folder: any, e: DragEvent) {
  if (e.dataTransfer) {
    let ids = [folder.id]
    if (selectedFolderIds.value.has(folder.id)) {
      ids = Array.from(selectedFolderIds.value)
    }
    e.dataTransfer.setData('application/x-eagle-folder', JSON.stringify(ids))
    e.dataTransfer.effectAllowed = 'move'
  }
}

function onSidebarFolderDragEnter(fid: string, e: DragEvent) {
  folderDragTargetId.value = fid
}

function onSidebarFolderDragLeave(fid: string, e: DragEvent) {
  if (folderDragTargetId.value === fid) {
    folderDragTargetId.value = null
  }
}

function onSidebarFolderDragOver(fid: string, pos: 'before'|'inside'|'after', e: DragEvent) {
  e.preventDefault()
  handleFolderDragHover(fid)
  folderDragTargetId.value = fid
  folderDropPosition.value = pos
  if (e.dataTransfer) {
    const types = Array.from(e.dataTransfer.types)
    if (types.includes('Files')) e.dataTransfer.dropEffect = 'copy'
    else if (types.includes('application/x-eagle-items') || types.includes('application/x-eagle-folder')) e.dataTransfer.dropEffect = 'move'
  }
}

async function onSidebarFolderDrop(fid: string, pos: 'before'|'inside'|'after', e: DragEvent) {
  clearFolderDragState()
  const types = Array.from(e.dataTransfer?.types || [])
  const droppedPaths = Array.from(e.dataTransfer?.files ?? []).map((f: any) => (f as any).path).filter(Boolean)
  const internalItems = items.value.filter(i => droppedPaths.includes(i.contentPath))
  
  if (droppedPaths.length > 0 && internalItems.length === 0) {
    await window.api.invoke('item:import', { sourcePaths: droppedPaths, targetFolderId: fid, recursive: true })
    return
  }

  if (types.includes('application/x-eagle-items') || (droppedPaths.length > 0 && internalItems.length > 0)) {
    const ids = types.includes('application/x-eagle-items') ? JSON.parse(e.dataTransfer!.getData('application/x-eagle-items')) : internalItems.map(i => i.id)
    const isCopy = e.altKey || e.ctrlKey || e.metaKey || e.shiftKey
    for (const id of ids) {
      const it = items.value.find(i => i.id === id) || (await window.api.invoke('item:get', id)).entry
      if (it) {
        let newFolders = [...(it.folders || [])]
        if (!isCopy && activeFolderId.value && newFolders.includes(activeFolderId.value)) newFolders = newFolders.filter(f => f !== activeFolderId.value)
        if (!newFolders.includes(fid)) newFolders.push(fid)
        await library.updateItem(id, { folders: newFolders })
      }
    }
    library.deselect(); if (activeFolderId.value && !isCopy) await reloadCurrentView(); await handleBatchUpdate()
    return
  }

  if (types.includes('application/x-eagle-folder')) {
    const draggedFidRaw = e.dataTransfer!.getData('application/x-eagle-folder')
    let draggedFids: string[] = []
    try {
      draggedFids = JSON.parse(draggedFidRaw)
    } catch {
      draggedFids = [draggedFidRaw]
    }
    
    let needsReload = false
    const target = folders.value.find(f => f.id === fid)
    if (!target) return

    for (const draggedFid of draggedFids) {
      if (draggedFid === fid) continue
      const dragged = folders.value.find(f => f.id === draggedFid)
      if (!dragged) continue
      
      let isDescendant = false, curr: any = target
      while (curr?.parentId) { if (curr.parentId === draggedFid) { isDescendant = true; break }; curr = folders.value.find(f => f.id === curr.parentId) }
      if (isDescendant) continue

      if (pos === 'inside') {
        const children = folders.value.filter(f => f.parentId === fid)
        const maxIdx = children.reduce((max, c) => Math.max(max, c.sortIndex ?? c.createdAt), 0)
        await library.updateFolder(draggedFid, { parentId: fid, sortIndex: maxIdx + 100 })
        expandedFolders.value.add(fid)
      } else {
        const siblings = folders.value.filter(f => f.parentId === target.parentId && f.id !== draggedFid).sort((a,b) => (a.sortIndex ?? a.createdAt) - (b.sortIndex ?? b.createdAt))
        const targetIdx = siblings.findIndex(f => f.id === fid)
        let newSortIndex = target.sortIndex ?? target.createdAt
        if (pos === 'before') {
          const prev = siblings[targetIdx - 1]
          newSortIndex = prev ? ((prev.sortIndex ?? prev.createdAt) + (target.sortIndex ?? target.createdAt)) / 2 : (target.sortIndex ?? target.createdAt) - 100
        } else {
          const next = siblings[targetIdx + 1]
          newSortIndex = next ? ((target.sortIndex ?? target.createdAt) + (next.sortIndex ?? next.createdAt)) / 2 : (target.sortIndex ?? target.createdAt) + 100
        }
        await library.updateFolder(draggedFid, { parentId: target.parentId, sortIndex: newSortIndex })
      }
      needsReload = true
    }
    if (needsReload) await reloadCurrentView()
  }
}

async function onSidebarOsDropVoid(paths: string[]) {
  if (!libraryInfo.value || !paths.length) return
  
  // See if some paths are internal items
  const internalItems = items.value.filter(i => paths.includes(i.contentPath))
  
  const folderName = paths.length === 1 ? paths[0].split(/[\\/]/).pop() : 'New Folder'
  const folder = await library.createFolder(folderName || 'New Folder')
  if (folder) {
    if (internalItems.length > 0) {
      // Move internal items to new folder
      for (const item of internalItems) {
        const newFolders = [...(item.folders || []), folder.id]
        await library.updateItem(item.id, { folders: newFolders })
      }
      await handleBatchUpdate()
    } else {
      // Import external files
      await window.api.invoke('item:import', { sourcePaths: paths, targetFolderId: folder.id, recursive: true })
    }
    await reloadCurrentView()
    toast.success(`Created folder "${folder.name}" with dropped items`)
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────
let _importProgressUnsub: (() => void) | null = null
const importToastId = ref<string | number | null>(null)

onMounted(async () => {
  try {
    console.log('App mounting...')
    initTheme()
    const opened = await restoreLastLibrary()
    if (opened) {
      console.log('Library restored:', opened)
      await library.fetchWatchFolders()
    }
    await library.autoTrashPurge()

    document.addEventListener('paste', onGlobalPaste as any)
    document.addEventListener('keydown', onGlobalKeydown)
    document.addEventListener('mouseover', onGlobalMouseOver)
    document.addEventListener('mouseout', onGlobalMouseOut)

    console.log('App mounted successfully')
  } catch (err) {
    console.error('CRITICAL: App failed to mount:', err)
    toast.error('Failed to load application. Check console for details.')
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('paste', onGlobalPaste as any)
  document.removeEventListener('keydown', onGlobalKeydown)
  document.removeEventListener('mouseover', onGlobalMouseOver)
  document.removeEventListener('mouseout', onGlobalMouseOut)
  _importProgressUnsub?.()
})

// ─── Scenario Handlers ──────────────────────────────────────────────────────
async function onWelcomeCreate() {
  const chosen = await library.createNewLibrary()
  if (chosen) { newLibNameDialog.value = { open: true, name: '', chosenPath: chosen as string }; nextTick(() => nameInputRef.value?.focus()) }
}
async function confirmNewLib() {
  const name = newLibNameDialog.value.name.trim()
  if (!name) return
  newLibNameDialog.value.open = false
  try { await library.createLibrary(newLibNameDialog.value.chosenPath, name) } catch (err: any) { toast.error(`Error: ${err.message}`) }
}
async function openRecent(p: string) { if (!(await library.openLibrary(p))) toast.error('Could not open library') }
async function switchToLibrary(p: string) { switcherOpen.value = false; if (p !== libraryPath.value && !(await library.openLibrary(p))) toast.error('Could not open library') }

async function onExportSelection() {
  const exportItems = [...selectedItems.value]
  if (exportItems.length === 0) return
  await startExport(exportItems)
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function extIcon(ext: string) { const m: any = { png:'🖼',jpg:'📷',jpeg:'📷',gif:'🎞',svg:'✏️',mp4:'🎬',mov:'🎬',pdf:'📄' }; return m[ext.toLowerCase()]??'📁' }
function isVideo(ext: string) { return ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext.toLowerCase()) }
function getMediaUrl(p: string) { return p ? `media://local/${encodeURIComponent(p)}` : '' }
function zoomIn() { if (zoom.value < 10) zoom.value++ }
function zoomOut() { if (zoom.value > 1) zoom.value-- }
function openUrl(url: string) { window.api.invoke('shell:openExternal', url) }
function minimizeWindow() { window.api.invoke('window:minimize') }
function maximizeWindow() { window.api.invoke('window:maximize') }
function closeWindow()    { window.api.invoke('window:close') }
</script>

<style scoped src="./styles/App.css"></style>
