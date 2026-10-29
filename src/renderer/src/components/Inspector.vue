<template>
  <aside class="inspector">
    <template v-if="selectedItems.length === 1">
      <div class="insp-preview-wrap">
        <div class="insp-preview">
          <img v-if="getThumb(selectedItems[0].id)" :src="getThumb(selectedItems[0].id)!" class="preview-img"/>
          <div v-else class="preview-placeholder">{{ extIcon((selectedItems[0] as any).ext) }}</div>
        </div>
      </div>
      <div class="insp-body">
        <label class="insp-label">Title</label>
        <div style="display:flex;align-items:center;gap:6px;position:relative;">
          <input class="insp-input" :value="fullMeta?.name??selectedItems[0].name"
            @change="(e)=>emit('update-item', selectedItems[0].id, {name:(e.target as HTMLInputElement).value})"/>
          <button 
            v-if="hasEnhanced" 
            class="enhanced-toggle-btn" 
            :class="{ 'is-active': uiStore.isCompareMode }"
            @click="uiStore.toggleCompareMode()" 
            title="Toggle Before/After Comparison (✨)"
          >✨</button>
        </div>

        <label class="insp-label">Notes</label>
        <textarea class="insp-input insp-textarea" :value="fullMeta?.annotation??''" placeholder="Notes…"
          @change="(e)=>emit('update-item', selectedItems[0].id, {annotation:(e.target as HTMLTextAreaElement).value})"></textarea>
        
        <label class="insp-label">Source URL</label>
        <div class="insp-url-row" :class="{ 'is-invalid': sourceUrl && !isUrlValid, 'is-valid': sourceUrl && isUrlValid }">
          <input 
            class="insp-input" 
            v-model="sourceUrl" 
            placeholder="https://…"
            @change="updateSourceUrl"
          />
          <button class="action-btn action-btn--link" 
            :disabled="!isUrlValid"
            @click="isUrlValid ? emit('open-url', sourceUrl) : null"
            title="Open in Browser">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;"><path d="M10 3h3v3M4 12l9-9M6 3H3a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3"/></svg>
          </button>
        </div>

        <div v-if="isUrlValid && webMetadata" class="web-preview">
          <div class="wp-header">
            <img :src="`https://www.google.com/s2/favicons?domain=${getDomain(sourceUrl)}&sz=32`" class="wp-favicon" />
            <span class="wp-domain">{{ getDomain(sourceUrl) }}</span>
          </div>
          <div v-if="webMetadata.previewUrl" class="wp-thumb-wrap">
            <img :src="webMetadata.previewUrl" class="wp-thumb" />
          </div>
          <div class="wp-body">
            <div class="wp-title">{{ webMetadata.title || 'Untitled Page' }}</div>
            <div class="wp-desc">{{ webMetadata.description || 'No description available' }}</div>
          </div>
        </div>
        
        <!-- Tags -->
        <div class="insp-row">
          <label class="insp-label" style="margin:0">Tags</label>
          <button class="chip-btn" @click="openTagInput" v-if="!tagInputVisible">+ New tag</button>
        </div>
        <div class="chip-row">
          <span v-for="tag in fullMeta?.tags??[]" :key="tag" class="chip">
            {{ tag }}<button class="chip-x" @click="removeTag(tag)">×</button>
          </span>
        </div>
        <!-- Inline tag input -->
        <div v-if="tagInputVisible" class="insp-tag-input-wrap">
          <input
            ref="tagInputRef"
            v-model="newTagText"
            class="insp-tag-input"
            placeholder="Tag name…"
            @keydown.enter="confirmTagInput"
            @keydown.esc="cancelTagInput"
            @blur="cancelTagInput"
          />
          <button class="insp-tag-confirm" @mousedown.prevent="confirmTagInput">↵</button>
        </div>

        <!-- Folders -->
        <div class="insp-row" style="position:relative;">
          <label class="insp-label" style="margin:0">Folders</label>
          <button
            class="chip-btn"
            @click.stop="openFolderDropdown"
            :disabled="!availableFolders.length"
            :title="!availableFolders.length ? 'No folders available' : 'Add to folder'"
          >+ add</button>
          <!-- Inline folder dropdown -->
          <div v-if="folderDropdownVisible" class="insp-folder-dropdown" v-click-outside="closeFolderDropdown">
            <button
              v-for="f in availableFolders" :key="f.id"
              class="insp-folder-option"
              @mousedown.prevent="assignFolder(f.id)"
            >
              <svg viewBox="0 0 14 14" fill="currentColor" style="width:11px;height:11px;flex-shrink:0;opacity:.6"><path d="M1 2.5A1.5 1.5 0 012.5 1h3l1.5 2H12a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0112 13H2.5A1.5 1.5 0 011 11.5v-9z"/></svg>
              {{ f.name }}
            </button>
          </div>
        </div>
        <div class="chip-row">
          <span v-for="fid in fullMeta?.folders??[]" :key="fid" class="chip chip--folder">
            {{ folderName(fid) }}<button class="chip-x" @click="removeFromFolder(fid)">×</button>
          </span>
        </div>
        
        <label class="insp-label" style="margin-top:14px">Properties</label>
        <table class="props-table">
          <tbody>
            <tr v-if="selectedItems[0].duration"><td class="prop-key">Duration</td><td class="prop-val">{{ formatDuration(selectedItems[0].duration) }}</td></tr>
            <tr><td class="prop-key">Dimensions</td><td class="prop-val">{{ selectedItems[0].width&&selectedItems[0].height ? `${selectedItems[0].width} × ${selectedItems[0].height}` : '—' }}</td></tr>
            <tr><td class="prop-key">Size</td><td class="prop-val">{{ formatSize(selectedItems[0].size) }}</td></tr>
            <tr><td class="prop-key">Type</td><td class="prop-val">{{ selectedItems[0].ext.toUpperCase() }}</td></tr>
            <tr><td class="prop-key">Imported</td><td class="prop-val">{{ formatDate(selectedItems[0].importTime) }}</td></tr>
            <tr><td class="prop-key">Orientation</td><td class="prop-val">{{ selectedItems[0].orientation }}</td></tr>
          </tbody>
        </table>
        
        <div class="insp-actions">
  <template v-if="activeView !== 'trash'">
    <button class="action-btn action-btn--export" @click="emit('export-selection')">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><path d="M8 2v9m0 0l-3-3m3 3l3-3M2 14h12"/></svg>
              Export Content
            </button>
          </template>
          <template v-else>
            <button class="action-btn action-btn--restore" @click="emit('restore-selection')">Restore Item</button>
            <button class="action-btn action-btn--danger" @click="emit('purge-selection')">Delete Permanently</button>
          </template>
        </div>

        <!-- ✨ AI Enhancement -->
        <div v-if="activeView !== 'trash' && isImage(selectedItems[0].ext)" class="ai-enhance-section">
          <div class="sidebar-divider" style="margin: 20px -11px 16px;"></div>
          <label class="insp-label" style="margin-top:0">✨ AI Enhancement</label>
          
          <div v-if="!aiModelsPath" class="ai-setup-box">
            <p class="ai-setup-text">Set your models folder to enable AI upscaling.</p>
            <button class="chip-btn" @click="selectModelsFolder">Select Folder…</button>
          </div>

          <div v-else class="ai-controls">
            <div class="ai-row">
              <select class="insp-input" v-model="selectedModel" :disabled="isEnhancing" style="flex:2">
                <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
                <option v-if="!availableModels.length" disabled>No models found</option>
              </select>
              <select class="insp-input" v-model="selectedScale" :disabled="isEnhancing" style="flex:1">
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
                <option value="3">3x</option>
                <option value="4">4x</option>
              </select>
              <button class="action-btn action-btn--icon" @click="refreshModels" title="Refresh Models" :disabled="isEnhancing">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
              </button>
            </div>

            <div class="ai-info" v-if="targetResolution">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;opacity:.6;"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              <span>Target: {{ targetResolution.w }} × {{ targetResolution.h }} ({{ targetResolution.scale }}x)</span>
            </div>

            <div class="ai-tweaks">
              <label class="tweak-label" title="Apply high-quality sharpening to crisp up AI-generated edges">
                <input type="checkbox" v-model="selectedSharpen" :disabled="isEnhancing" />
                <span>Sharpen</span>
              </label>
              <label class="tweak-label" title="Subtly enhance colors and contrast for a professional look">
                <input type="checkbox" v-model="selectedColorBoost" :disabled="isEnhancing" />
                <span>Color Boost</span>
              </label>
            </div>

            <div class="ai-vram">
              <span class="vram-label" title="Control memory usage to prevent crashes on older GPUs">VRAM Usage</span>
              <div class="vram-options">
                <button v-for="mode in ['low', 'medium', 'high']" :key="mode" 
                  class="vram-btn" :class="{ 'is-active': selectedVRAM === mode }"
                  @click="selectedVRAM = mode" :disabled="isEnhancing">
                  {{ mode.toUpperCase() }}
                </button>
              </div>
            </div>

            <div class="enhance-btn-wrap">
              <button 
                class="enhance-btn" 
                :class="{ 'is-loading': isEnhancing }"
                :disabled="isEnhancing || !selectedModel"
                @click="startEnhance"
              >
                <div v-if="isEnhancing" class="enhance-progress-bg" :style="{ width: enhanceProgress + '%' }"></div>
                <span class="enhance-btn-text">
                  {{ isEnhancing ? `Processing ${Math.round(enhanceProgress)}%` : 'Enhance Image' }}
                </span>
              </button>
              <button v-if="isEnhancing" class="enhance-cancel" @click="cancelEnhance">✕</button>
              <button v-if="!isEnhancing && hasEnhanced" class="enhance-delete" @click="deleteEnhance" title="Remove Enhanced Version">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
              </button>
            </div>
            
            <button class="ai-settings-link" @click="selectModelsFolder">Change models folder…</button>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="selectedItems.length > 1">
      <div class="insp-body" style="padding-top: 24px;">
        <h2 style="color:var(--text-1);font-size:16px;text-align:center;margin-bottom:20px;">
          {{ selectedItems.length }} items selected
        </h2>
        
        <!-- Batch Tags -->
        <div class="insp-row">
          <label class="insp-label" style="margin:0">Add Tags</label>
          <button class="chip-btn" @click="openBatchTagInput" v-if="!batchTagInputVisible">+ New tag</button>
        </div>
        <div v-if="batchTagInputVisible" class="insp-tag-input-wrap">
          <input
            ref="batchTagInputRef"
            v-model="batchTagText"
            class="insp-tag-input"
            placeholder="Tag name…"
            @keydown.enter="confirmBatchTag"
            @keydown.esc="cancelBatchTag"
            @blur="cancelBatchTag"
          />
          <button class="insp-tag-confirm" @mousedown.prevent="confirmBatchTag">↵</button>
        </div>

        <!-- Batch Folders -->
        <div class="insp-row" style="position:relative; margin-top: 16px;">
          <label class="insp-label" style="margin:0">Add to Folders</label>
          <button class="chip-btn" @click="batchFolderDropdownVisible = true" :disabled="!folders.length">+ add</button>
          <div v-if="batchFolderDropdownVisible" class="insp-folder-dropdown" v-click-outside="() => batchFolderDropdownVisible = false">
            <button v-for="f in folders" :key="f.id" class="insp-folder-option" @mousedown.prevent="assignBatchFolder(f.id)">
              <svg viewBox="0 0 14 14" fill="currentColor" style="width:11px;height:11px;flex-shrink:0;opacity:.6"><path d="M1 2.5A1.5 1.5 0 012.5 1h3l1.5 2H12a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0112 13H2.5A1.5 1.5 0 011 11.5v-9z"/></svg>
              {{ f.name }}
            </button>
          </div>
        </div>

        <table class="props-table" style="margin-top: 24px;">
          <tbody>
            <tr><td class="prop-key">Total Size</td><td class="prop-val">{{ formatSize(selectedItems.reduce((acc, i) => acc + (i.size || 0), 0)) }}</td></tr>
          </tbody>
        </table>

        <div class="insp-actions" style="margin-top: 20px;">
          <template v-if="activeView !== 'trash'">
            <button class="action-btn action-btn--export" @click="emit('export-selection')">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><path d="M8 2v9m0 0l-3-3m3 3l3-3M2 14h12"/></svg>
              Export {{ selectedItems.length }} Items
            </button>
          </template>
          <template v-else>
            <button class="action-btn action-btn--restore" @click="emit('restore-selection')">Restore Selected</button>
            <button class="action-btn action-btn--danger" @click="emit('purge-selection')">Delete Permanently</button>
          </template>
        </div>

        <!-- ✨ Batch AI Enhancement -->
        <div v-if="activeView !== 'trash' && selectedItems.some(i => isImage(i.ext))" class="ai-enhance-section">
          <div class="sidebar-divider" style="margin: 20px -11px 16px;"></div>
          <label class="insp-label" style="margin-top:0">✨ Batch AI Enhancement</label>
          
          <div v-if="!aiModelsPath" class="ai-setup-box">
            <p class="ai-setup-text">Set your models folder to enable AI upscaling.</p>
            <button class="chip-btn" @click="selectModelsFolder">Select Folder…</button>
          </div>

          <div v-else class="ai-controls">
            <div class="ai-row">
              <select class="insp-input" v-model="selectedModel" :disabled="isEnhancing" style="flex:2">
                <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
                <option v-if="!availableModels.length" disabled>No models found</option>
              </select>
              <select class="insp-input" v-model="selectedScale" :disabled="isEnhancing" style="flex:1">
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
                <option value="3">3x</option>
                <option value="4">4x</option>
              </select>
              <button class="action-btn action-btn--icon" @click="refreshModels" title="Refresh Models" :disabled="isEnhancing">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
              </button>
            </div>

            <div class="ai-tweaks">
              <label class="tweak-label">
                <input type="checkbox" v-model="selectedSharpen" :disabled="isEnhancing" />
                <span>Sharpen</span>
              </label>
              <label class="tweak-label">
                <input type="checkbox" v-model="selectedColorBoost" :disabled="isEnhancing" />
                <span>Color Boost</span>
              </label>
            </div>

            <div class="enhance-btn-wrap">
              <button 
                class="enhance-btn" 
                :class="{ 'is-loading': isEnhancing }"
                :disabled="isEnhancing || !selectedModel"
                @click="startBatchEnhance"
              >
                <div v-if="isEnhancing" class="enhance-progress-bg" :style="{ width: enhanceProgress + '%' }"></div>
                <span class="enhance-btn-text">
                  {{ isEnhancing ? batchProgressText : `Enhance ${selectedItems.filter(i=>isImage(i.ext)).length} Images` }}
                </span>
              </button>
              <button v-if="isEnhancing" class="enhance-cancel" @click="cancelEnhance">✕</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="selectedFolder">
      <div class="insp-body" style="padding-top: 20px;">
        <input class="insp-input" :value="selectedFolder.name"
          @change="(e)=>emit('update-folder', selectedFolder!.id, {name:(e.target as HTMLInputElement).value})"
          style="margin-bottom: 12px; font-weight: 500; font-size: 13px;" />
        
        <textarea class="insp-input insp-textarea" :value="selectedFolder.description ?? ''" placeholder="Description"
          @change="(e)=>emit('update-folder', selectedFolder!.id, {description:(e.target as HTMLTextAreaElement).value})"></textarea>

        <label class="insp-label" style="margin-top:20px; margin-bottom: 10px;">Properties</label>
        <table class="props-table">
          <tbody>
            <tr><td class="prop-key">Items</td><td class="prop-val">{{ sidebarCounts.folders[selectedFolder.id] || 0 }}</td></tr>
            <tr><td class="prop-key">Size</td><td class="prop-val">{{ formatSize(sidebarCounts.folderSizes[selectedFolder.id] || 0) }}</td></tr>
            <tr><td class="prop-key">Date Created</td><td class="prop-val">{{ formatDateFolder(selectedFolder.createdAt) }}</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else>
      <div class="insp-empty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-3);text-align:center;padding:24px;">
        <svg style="width:32px;height:32px;margin-bottom:12px;opacity:0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <span style="font-size:12px">Select an item or folder<br>to view its properties</span>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '../stores/ui'

const props = defineProps<{
  selectedItems: any[]
  fullMeta: any
  selectedFolder: any
  folders: any[]
  activeView: string
  sidebarCounts: any

  getThumb: (id: string) => string | null
  extIcon: (ext: string) => string
  formatSize: (bytes: number) => string
  formatDate: (ts: number) => string
  formatDateFolder: (ts: number) => string
  formatDuration: (seconds: number) => string
  folderName: (id: string) => string
}>()

const emit = defineEmits([
  'update-item',
  'update-folder',
  'delete-selection',
  'restore-selection',
  'purge-selection',
  'open-url',
  'find-similar',
  'refresh-counts',
  'export-selection',
  'fetch-meta'
])

// ── Local State ─────────────────────────────────────────────────────────────
const tagInputVisible = ref(false)
const newTagText      = ref('')
const tagInputRef     = ref<HTMLInputElement | null>(null)

const folderDropdownVisible = ref(false)

const batchTagInputVisible = ref(false)
const batchTagText         = ref('')
const batchTagInputRef     = ref<HTMLInputElement | null>(null)
const batchFolderDropdownVisible = ref(false)

const uiStore = useUIStore()
const sourceUrl = ref('')
const webMetadata = ref<any>(null)

// ── Lazy Metadata Loading ──────────────────────────────────────────────────
watch([() => props.selectedItems, () => uiStore.showInspector], async ([items, show]) => {
  if (show && items.length === 1) {
    const item = items[0]
    // Only fetch if we don't have it or it's a different item
    if (!props.fullMeta || props.fullMeta.id !== item.id) {
      await emit('fetch-meta', item.id)
    }
  }
}, { immediate: true })

// ── AI Enhancement ──────────────────────────────────────────────────────────
const aiModelsPath = ref<string | null>(null)
const availableModels = ref<string[]>([])
const selectedModel = ref('')
const selectedScale = ref('4')
const selectedSharpen = ref(true)
const selectedColorBoost = ref(false)
const selectedVRAM = ref('medium') // 'low' (128), 'medium' (256), 'high' (512)
const isEnhancing = ref(false)
const enhanceProgress = ref(0)
const batchStatus = ref({ current: 0, total: 0 })
let stopProgressListen: (() => void) | null = null
let stopBatchListen: (() => void) | null = null

const batchProgressText = computed(() => {
  if (batchStatus.value.total > 0) {
    return `Item ${batchStatus.value.current} of ${batchStatus.value.total} (${Math.round(enhanceProgress.value)}%)`
  }
  return `Processing ${Math.round(enhanceProgress.value)}%`
})

const hasEnhanced = computed(() => {
  if (!props.selectedItems[0]) return false
  return !!props.selectedItems[0].hasEnhanced || !!props.selectedItems[0]._isEnhanced
})

onMounted(async () => {
  const session = await window.api.invoke('session:get')
  if (session.aiModelsPath) {
    aiModelsPath.value = session.aiModelsPath
    refreshModels()
  }
  
  stopProgressListen = window.api.on('event:enhance-progress', (p: number) => {
    enhanceProgress.value = p
  })
  stopBatchListen = window.api.on('event:enhance-batch-progress', (data: any) => {
    batchStatus.value = { current: data.current, total: data.total }
    enhanceProgress.value = data.percent
  })
})

onUnmounted(() => {
  if (stopProgressListen) stopProgressListen()
  if (stopBatchListen) stopBatchListen()
})

const isUrlValid = computed(() => {
  try {
    const url = new URL(sourceUrl.value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch { return false }
})

watch(() => props.fullMeta?.url, (newUrl) => {
  if (!props.fullMeta) {
    sourceUrl.value = ''
    webMetadata.value = null
    return
  }
  sourceUrl.value = newUrl || ''
  if (isUrlValid.value) fetchWebMetadata()
  else webMetadata.value = null
}, { immediate: true })

async function fetchWebMetadata() {
  if (!isUrlValid.value) return
  const meta = await window.api.invoke('web:getMetadata', sourceUrl.value)
  webMetadata.value = meta
}

function getDomain(url: string) {
  try { return new URL(url).hostname.replace('www.', '') }
  catch { return '' }
}

function updateSourceUrl() {
  if (props.selectedItems.length === 1) {
    emit('update-item', props.selectedItems[0].id, { url: sourceUrl.value })
    if (isUrlValid.value) fetchWebMetadata()
    else webMetadata.value = null
  }
}

const availableFolders = computed(() => {
  if (!props.fullMeta) return []
  const assigned: string[] = props.fullMeta.folders ?? []
  return props.folders.filter(f => !assigned.includes(f.id))
})

// ── Tag Methods ─────────────────────────────────────────────────────────────
function openTagInput() {
  tagInputVisible.value = true
  newTagText.value = ''
  nextTick(() => tagInputRef.value?.focus())
}

function cancelTagInput() {
  tagInputVisible.value = false
  newTagText.value = ''
}

function confirmTagInput() {
  const tag = newTagText.value.trim()
  if (!tag || props.selectedItems.length !== 1 || !props.fullMeta) {
    cancelTagInput()
    return
  }
  if (props.fullMeta.tags?.includes(tag)) {
    cancelTagInput()
    return
  }
  const tags = [...(props.fullMeta.tags ?? []), tag]
  emit('update-item', props.selectedItems[0].id, { tags })
  cancelTagInput()
}

function removeTag(tag: string) {
  if (props.selectedItems.length !== 1 || !props.fullMeta) return
  const tags = props.fullMeta.tags.filter((t: string) => t !== tag)
  emit('update-item', props.selectedItems[0].id, { tags })
}

// ── Folder Methods ──────────────────────────────────────────────────────────
function openFolderDropdown() {
  if (!availableFolders.value.length) return
  folderDropdownVisible.value = true
}

function closeFolderDropdown() {
  folderDropdownVisible.value = false
}

function assignFolder(fid: string) {
  if (props.selectedItems.length !== 1 || !props.fullMeta) return
  const currentFolders = props.fullMeta.folders || []
  const foldersArr = [...currentFolders, fid]
  emit('update-item', props.selectedItems[0].id, { folders: foldersArr })
  folderDropdownVisible.value = false
}

function removeFromFolder(fid: string) {
  if (props.selectedItems.length !== 1 || !props.fullMeta) return
  const currentFolders = props.fullMeta.folders || []
  const foldersArr = currentFolders.filter((f: string) => f !== fid)
  emit('update-item', props.selectedItems[0].id, { folders: foldersArr })
}

// ── Batch Operations ────────────────────────────────────────────────────────
function openBatchTagInput() {
  batchTagInputVisible.value = true
  batchTagText.value = ''
  nextTick(() => batchTagInputRef.value?.focus())
}

function cancelBatchTag() {
  batchTagInputVisible.value = false
  batchTagText.value = ''
}

async function confirmBatchTag() {
  const tag = batchTagText.value.trim()
  if (!tag || props.selectedItems.length < 2) {
    cancelBatchTag()
    return
  }
  for (const item of props.selectedItems) {
    const currentTags = item.tags || []
    if (!currentTags.includes(tag)) {
      await emit('update-item', item.id, { tags: [...currentTags, tag] })
    }
  }
  cancelBatchTag()
  emit('refresh-counts')
}

async function assignBatchFolder(fid: string) {
  if (props.selectedItems.length < 2) return
  for (const item of props.selectedItems) {
    const currentFolders = item.folders || []
    if (!currentFolders.includes(fid)) {
      await emit('update-item', item.id, { folders: [...currentFolders, fid] })
    }
  }
  batchFolderDropdownVisible.value = false
  emit('refresh-counts')
}

// ── AI Enhancement ──────────────────────────────────────────────────────────
function isImage(ext: string) {
  return ['png', 'jpg', 'jpeg', 'jfif', 'webp', 'bmp', 'tiff', 'avif'].includes(ext.toLowerCase())
}

async function selectModelsFolder() {
  const paths = await window.api.invoke('dialog:pickFolders')
  if (paths && paths.length > 0) {
    aiModelsPath.value = paths[0]
    await window.api.invoke('session:set-ai-models-path', aiModelsPath.value)
    refreshModels()
  }
}

async function refreshModels() {
  if (!aiModelsPath.value) return
  const models = await window.api.invoke('enhance:getModels', aiModelsPath.value)
  availableModels.value = models
  if (models.length > 0 && !selectedModel.value) {
    selectedModel.value = models[0]
  }
}

const targetResolution = computed(() => {
  if (!props.selectedItems[0] || !selectedModel.value) return null
  const w = props.selectedItems[0].width || 0
  const h = props.selectedItems[0].height || 0
  if (!w || !h) return null
  
  const scale = parseFloat(selectedScale.value)
  return { w: Math.round(w * scale), h: Math.round(h * scale), scale }
})

async function startEnhance() {
  if (!props.selectedItems[0] || !selectedModel.value || !aiModelsPath.value) return
  
  isEnhancing.value = true
  enhanceProgress.value = 0
  
  const vramMap = { low: 128, medium: 256, high: 512 }
  
  try {
    const item = props.selectedItems[0]
    const infoPath = item.infoPath
    
    await window.api.invoke('enhance:start', {
      id: item.id,
      inputPath: item.contentPath,
      outputPath: pathJoin(infoPath, 'enhanced.png'),
      modelsPath: aiModelsPath.value,
      modelName: selectedModel.value,
      scale: parseFloat(selectedScale.value),
      sharpen: selectedSharpen.value,
      colorBoost: selectedColorBoost.value,
      tileSize: (vramMap as any)[selectedVRAM.value]
    })
    
    // Once done, the protocol will automatically show enhanced.png.
    // We trigger an update to ensure components re-render if they rely on the image.
    emit('update-item', item.id, { _lastEnhanced: Date.now(), _isEnhanced: true })
    
  } catch (e: any) {
    alert('Enhancement failed: ' + e.message)
  } finally {
    isEnhancing.value = false
    enhanceProgress.value = 0
  }
}

function cancelEnhance() {
  window.api.invoke('enhance:cancel')
}

async function startBatchEnhance() {
  if (!selectedModel.value || !aiModelsPath.value) return
  const eligibleItems = props.selectedItems.filter(i => isImage(i.ext))
  if (!eligibleItems.length) return

  isEnhancing.value = true
  enhanceProgress.value = 0
  batchStatus.value = { current: 0, total: eligibleItems.length }
  
  const vramMap = { low: 128, medium: 256, high: 512 }

  try {
    const items = eligibleItems.map(item => ({
      id: item.id,
      inputPath: item.contentPath,
      outputPath: pathJoin(item.infoPath, 'enhanced.png'),
      modelsPath: aiModelsPath.value!,
      modelName: selectedModel.value,
      scale: parseFloat(selectedScale.value),
      sharpen: selectedSharpen.value,
      colorBoost: selectedColorBoost.value,
      tileSize: (vramMap as any)[selectedVRAM.value]
    }))

    await window.api.invoke('enhance:startBatch', items)
    
    // Trigger update for all items
    for (const item of eligibleItems) {
      emit('update-item', item.id, { _lastEnhanced: Date.now(), _isEnhanced: true })
    }
  } catch (e: any) {
    alert('Batch enhancement failed: ' + e.message)
  } finally {
    isEnhancing.value = false
    enhanceProgress.value = 0
    batchStatus.value = { current: 0, total: 0 }
  }
}

async function deleteEnhance() {
  if (!props.selectedItems[0]) return
  const item = props.selectedItems[0]
  if (!confirm('Are you sure you want to remove the upscaled version? The original file will be kept.')) return
  
  const res = await window.api.invoke('enhance:delete', item.infoPath)
  if (res.ok) {
    emit('update-item', item.id, { _lastEnhanced: Date.now(), _isEnhanced: false, hasEnhanced: false })
  } else {
    alert('Failed to delete: ' + (res.error?.message || 'Unknown error'))
  }
}

// Helper because 'path' isn't available in renderer
function pathJoin(...parts: string[]) {
  return parts.join(window.api.platform === 'win32' ? '\\' : '/')
}

// ── Directives ──────────────────────────────────────────────────────────────
const vClickOutside = {
  mounted(el: any, binding: any) {
    el._co = (e: MouseEvent) => {
      if (!el.contains(e.target as Node)) binding.value()
    }
    document.addEventListener('mousedown', el._co)
  },
  unmounted(el: any) {
    if (el._co) document.removeEventListener('mousedown', el._co)
    delete el._co
  }
}
</script>

<style scoped>
.inspector{ width:290px;min-width:290px; background:var(--bg-sidebar); border-left:1px solid var(--border); display:flex;flex-direction:column; overflow-y:auto; font-family:var(--font); }
.inspector::-webkit-scrollbar{width:6px;}
.inspector::-webkit-scrollbar-track{background:transparent;}
.inspector::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:3px;}
.inspector::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.2);}
.inspector{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.12) transparent;}
.insp-preview{margin:10px;border-radius:5px;overflow:hidden;background:var(--bg-card);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;}
.preview-img{max-width:100%;max-height:260px;object-fit:contain;display:block;}
.insp-preview-wrap{display:flex;flex-direction:column;margin:10px 10px 0;}
.preview-placeholder{font-size:36px;}
.insp-body{padding:0 11px 20px;}
.insp-label{ display:block; font-size:10px;font-weight:700; color:var(--text-3); text-transform:uppercase;letter-spacing:.1em; margin:12px 0 5px; font-family:var(--font); }
.insp-input{ width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:8px 10px; color:var(--text-1); font-size:12.5px; font-family:var(--font); transition:border-color .15s, background .15s; }
.insp-input:hover{background:var(--bg-hover);}
.insp-input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-dim);background:var(--bg-input);}
.insp-textarea{resize:vertical;min-height:100px;line-height:1.55;}
.insp-row{display:flex;align-items:center;justify-content:space-between;margin-top:13px;margin-bottom:4px;}

.chip-btn{ background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:4px 8px; font-size:11px; font-weight:500; color:var(--text-2); font-family:var(--font); cursor:pointer; transition:border-color .12s, color .12s; }
.chip-btn:hover{border-color:var(--border-hover);color:var(--text-1);}
.chip-row{display:flex;flex-wrap:wrap;gap:4px;}
.chip{ display:flex;align-items:center;gap:4px; background:rgba(255,255,255,.06); border:1px solid var(--border); border-radius:20px; padding:4px 8px; font-size:11px;color:var(--text-1); font-family:var(--font); }
.chip--folder{background:var(--accent-dim);border-color:rgba(232,49,138,.2);}
.chip-x{background:transparent;border:none;color:var(--text-3);font-size:12px;cursor:pointer;padding:0;line-height:1;}
.chip-x:hover{color:var(--accent);}

.props-table{ width:100%;border-collapse:collapse;margin-top:8px; font-family:var(--font); }
.props-table tr+tr td{padding-top:5px;border-top:1px solid rgba(255,255,255,.05);}
.prop-key{ font-size:11px;color:var(--text-3); padding:5px 10px 0 0; font-weight:500; font-family:var(--font); letter-spacing:.01em; }
.prop-val{ font-size:12px;color:var(--text-1); text-align:right; font-family:var(--font); font-weight:500; letter-spacing:0; }

.insp-actions{margin-top:20px;}

/* Source URL row */
.insp-url-row{display:flex;gap:5px;align-items:stretch;}
.insp-url-row .insp-input{flex:1;min-width:0;}
.insp-url-row.is-invalid .insp-input { border-color: #ff5f57; background: rgba(255, 95, 87, 0.05); }
.insp-url-row.is-valid .insp-input { border-color: #3cc870; }

.action-btn--link {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.15s;
}
.action-btn--link:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-dim);
}
.action-btn--link:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.web-preview {
  margin-top: 10px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideDown 0.2s ease-out;
}
@keyframes slideDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

.wp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid var(--border);
}
.wp-favicon { width: 14px; height: 14px; border-radius: 2px; }
.wp-domain { font-size: 11px; font-weight: 600; color: var(--text-2); }

.wp-thumb-wrap { width: 100%; height: 120px; overflow: hidden; background: #000; position: relative; }
.wp-thumb { width: 100%; height: 100%; object-fit: cover; opacity: 0.8; transition: opacity 0.3s; }
.wp-thumb:hover { opacity: 1; }

.wp-body { padding: 8px 10px; }
.wp-title { font-size: 12px; font-weight: 600; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
.wp-desc { font-size: 10px; color: var(--text-3); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; line-height: 1.4; }


.insp-tag-input-wrap { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
.insp-tag-input { flex: 1; background: var(--bg-input); border: 1px solid var(--accent); border-radius: 6px; padding: 5px 8px; color: var(--text-1); font-size: 12px; font-family: var(--font); outline: none; box-shadow: 0 0 0 2px var(--accent-dim); }
.insp-tag-confirm { width: 26px; height: 26px; border-radius: 5px; border: none; background: var(--accent); color: #fff; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity .15s; }
.insp-tag-confirm:hover { opacity: .85; }

.insp-folder-dropdown { position: absolute; top: calc(100% + 4px); right: 0; min-width: 180px; max-height: 200px; overflow-y: auto; background: var(--bg-sidebar); border: 1px solid var(--border); border-radius: 8px; padding: 4px 0; box-shadow: 0 0 0 1px rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.2), 0 16px 32px rgba(0,0,0,0.4), 0 24px 64px rgba(0,0,0,0.5); z-index: 200; animation: popIn .15s var(--anim-spring-fast) forwards; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
.insp-folder-option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 12px; background: transparent; border: none; color: var(--text-1); font-size: 12px; font-family: var(--font); cursor: pointer; text-align: left; transition: background .1s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.insp-folder-option:hover { background: var(--bg-hover); }

@keyframes popIn {
  from { opacity: 0; transform: scale(.95); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }
.enhanced-badge { font-size: 14px; cursor: help; filter: drop-shadow(0 0 4px var(--accent-dim)); animation: pulse 2s infinite; }

.enhanced-toggle-btn { 
  background: transparent; border: 1px solid var(--border); border-radius: 6px; 
  padding: 2px 6px; font-size: 14px; cursor: pointer; transition: all 0.2s;
  filter: grayscale(1); opacity: 0.6;
}
.enhanced-toggle-btn:hover { background: var(--bg-hover); opacity: 1; border-color: var(--accent); }
.enhanced-toggle-btn.is-active { 
  filter: grayscale(0) drop-shadow(0 0 4px var(--accent-dim)); 
  opacity: 1; border-color: var(--accent); background: var(--accent-dim);
  animation: pulse 2s infinite;
}

/* AI Enhancement Styles */
.ai-enhance-section { margin-top: 4px; }
.ai-setup-box { background: rgba(255,255,255,0.03); border: 1px dashed var(--border); border-radius: 8px; padding: 12px; text-align: center; }
.ai-setup-text { font-size: 11px; color: var(--text-3); margin-bottom: 8px; line-height: 1.4; }
.ai-controls { display: flex; flex-direction: column; gap: 8px; }
.ai-row { display: flex; gap: 6px; }
.ai-info { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-2); padding: 2px 4px; }

.ai-vram { display: flex; align-items: center; justify-content: space-between; padding: 4px; margin-top: 2px; }
.vram-label { font-size: 10px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.05em; }
.vram-options { display: flex; gap: 4px; background: var(--bg-input); padding: 2px; border-radius: 6px; }
.vram-btn { border: none; background: transparent; color: var(--text-3); font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 4px; cursor: pointer; transition: all 0.15s; }
.vram-btn:hover:not(:disabled) { color: var(--text-1); }
.vram-btn.is-active { background: var(--bg-sidebar); color: var(--accent); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.vram-btn:disabled { cursor: not-allowed; opacity: 0.5; }

.ai-tweaks { display: flex; gap: 12px; padding: 4px; margin-top: 2px; }
.tweak-label { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
.tweak-label span { font-size: 11px; color: var(--text-2); font-weight: 500; }
.tweak-label input { accent-color: var(--accent); cursor: pointer; width: 13px; height: 13px; }
.tweak-label:hover span { color: var(--text-1); }

.ai-settings-link { background: none; border: none; color: var(--text-3); font-size: 10px; cursor: pointer; text-decoration: underline; text-align: left; padding: 0; margin-top: 4px; opacity: 0.6; }
.ai-settings-link:hover { opacity: 1; color: var(--accent); }

.enhance-btn-wrap { position: relative; display: flex; gap: 6px; align-items: center; margin-top: 4px; }
.enhance-btn { position: relative; flex: 1; height: 32px; background: var(--accent); color: #fff; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; overflow: hidden; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s, transform 0.1s; }
.enhance-btn:hover:not(:disabled) { opacity: 0.9; }
.enhance-btn:active:not(:disabled) { transform: scale(0.98); }
.enhance-btn:disabled { background: var(--bg-card); color: var(--text-3); cursor: not-allowed; border: 1px solid var(--border); }
.enhance-btn.is-loading { background: var(--bg-input); border: 1px solid var(--border); color: var(--text-1); cursor: default; }

.enhance-progress-bg { position: absolute; left: 0; top: 0; bottom: 0; background: var(--accent-dim); opacity: 0.4; transition: width 0.3s ease; z-index: 1; }
.enhance-btn-text { position: relative; z-index: 2; }

.enhance-cancel { width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-3); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; transition: color 0.2s; }
.enhance-cancel:hover { color: #ff5f57; border-color: #ff5f57; }

.enhance-delete { width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.enhance-delete:hover { color: #ff5f57; border-color: #ff5f57; background: rgba(255, 95, 87, 0.05); }

/* Custom class for export button to ensure visibility */
.action-btn--export {
  color: var(--accent) !important;
  background: var(--accent-dim) !important;
  border-color: var(--accent) !important;
  font-weight: 600 !important;
  letter-spacing: 0.01em;
}
.action-btn--export:hover {
  background: var(--accent) !important;
  color: #fff !important;
}
.action-btn--export svg {
  color: currentColor !important;
  opacity: 1 !important;
}
</style>
