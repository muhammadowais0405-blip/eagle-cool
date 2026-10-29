<template>
  <header class="toolbar" :class="{ 'toolbar--macos': isMac }">
    <!-- Sidebar context header -->
    <div class="tb-sidebar" v-show="_showSidebar" :style="{ width: sidebarWidth + 'px' }">
      <button class="tb-btn" @click="$emit('toggle-panels')" title="Toggle Panels (Tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="8" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="16" y2="21"></line></svg>
      </button>
      <div class="theme-menu-wrap" ref="themeMenuRef" style="position: relative;">
        <button class="tb-btn" @click="themeMenuOpen = !themeMenuOpen" title="Change Theme">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"></circle><path d="M12 3v18A9 9 0 0 0 12 3z" fill="currentColor"></path></svg>
        </button>
        <div v-if="themeMenuOpen" class="theme-popover">
          <div class="tp-header">Appearance</div>

          <!-- Base theme rows -->
          <div class="tp-section-label">Theme</div>
          <div class="tp-themes">
            <button
              v-for="t in THEMES" :key="t.id"
              class="tp-theme-row"
              :class="{ 'tp-theme-row--active': currentTheme === t.id }"
              @mouseenter="$emit('preview-theme', t.id)"
              @mouseleave="$emit('clear-preview')"
              @click="$emit('select-theme', t.id); themeMenuOpen = false"
            >
              <span class="tp-swatch" :style="{ background: t.color }"></span>
              <span class="tp-theme-name">{{ t.name }}</span>
              <svg v-if="currentTheme === t.id" class="tp-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 6 11 12 3"/></svg>
            </button>
          </div>

          <div class="tp-divider"></div>

          <!-- Accent color picker -->
          <div class="tp-section-label">Accent Color</div>
          <div class="tp-accents">
            <button
              v-for="a in ACCENT_COLORS" :key="a.value"
              class="tp-accent-btn"
              :class="{ 'tp-accent-btn--active': currentAccent === a.value }"
              :style="{ background: a.value }"
              :title="a.name"
              @click="$emit('select-accent', a.value)"
            ></button>
            
            <!-- Custom Color Picker -->
            <div class="tp-color-picker-wrap" title="Custom Color">
              <input 
                type="color" 
                class="tp-color-picker" 
                :value="currentAccent"
                @input="(e) => $emit('select-accent', (e.target as HTMLInputElement).value)"
              />
              <div class="tp-color-picker-visual" :style="{ background: currentAccent }">
                <svg viewBox="0 0 16 16" fill="currentColor" style="width:10px;height:10px;color:#fff;mix-blend-mode:difference;"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13zM8 4a4 4 0 100 8 4 4 0 000-8z"/></svg>
              </div>
            </div>
          </div>

          <div class="tp-divider"></div>

          <!-- Options -->
          <div class="tp-section-label">Options</div>
          <label class="tp-option-row lp-tappable">
            <span class="tp-option-label">Translucency</span>
            <div class="lp-switch">
              <input type="checkbox" :checked="currentTranslucency" @change="(e) => $emit('select-translucency', (e.target as HTMLInputElement).checked)" class="lp-switch-input"/>
              <span class="lp-switch-slider"></span>
            </div>
          </label>
        </div>
      </div>
    </div>

    <!-- Main context header -->
    <div class="tb-main">

      <!-- Left: empty drag region -->
      <div class="tb-left">
        <button v-if="showBack" class="tb-btn tb-back-btn" @click="$emit('back')" title="Back to Gallery (Esc)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          <span>Back</span>
        </button>
      </div>

      <!-- Center: zoom + layout + search -->
      <div class="tb-center">
        <button v-if="activeView === 'trash'" class="tb-btn tb-trash-btn" @click="$emit('empty-trash')">
          Empty Trash ({{ itemsLength }})
        </button>

        <div class="layout-menu-wrap" ref="sortMenuRef" style="position:relative;">
          <button class="tb-btn tb-btn--sort" :class="{ active: sortMenuOpen }" @click="sortMenuOpen = !sortMenuOpen" title="Sort Options">
            <svg viewBox="0 0 16 16" fill="currentColor" stroke="none" style="width:14px;height:14px;"><path d="M12.5 13.5v-11h-1v11l-2-2-.707.707 3.207 3.207 3.207-3.207-.707-.707-2 2zM3.5 2.5v11h1v-11l2 2 .707-.707-3.207-3.207-3.207 3.207.707.707 2-2z"/></svg>
          </button>
          <div v-if="sortMenuOpen" class="layout-popover" style="width: 200px;">
            <div class="tp-section-label" style="padding-top: 2px;">Sort By</div>
            <div class="lp-row lp-tappable" style="padding: 4px 16px;" @click="$emit('update:itemSortBy', 'date')">
              <span class="lp-label" :style="{ color: itemSortBy === 'date' ? 'var(--text-1)' : 'var(--text-2)' }">Date Added</span>
              <div class="lp-actions">
                <svg v-if="itemSortBy === 'date'" class="tp-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 6 11 12 3"/></svg>
              </div>
            </div>
            <div class="lp-row lp-tappable" style="padding: 4px 16px;" @click="$emit('update:itemSortBy', 'name')">
              <span class="lp-label" :style="{ color: itemSortBy === 'name' ? 'var(--text-1)' : 'var(--text-2)' }">Name</span>
              <div class="lp-actions">
                <svg v-if="itemSortBy === 'name'" class="tp-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 6 11 12 3"/></svg>
              </div>
            </div>
            <div class="lp-row lp-tappable" style="padding: 4px 16px;" @click="$emit('update:itemSortBy', 'size')">
              <span class="lp-label" :style="{ color: itemSortBy === 'size' ? 'var(--text-1)' : 'var(--text-2)' }">File Size</span>
              <div class="lp-actions">
                <svg v-if="itemSortBy === 'size'" class="tp-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 6 11 12 3"/></svg>
              </div>
            </div>
            <div class="lp-row lp-tappable" style="padding: 4px 16px;" @click="$emit('update:itemSortBy', 'type')">
              <span class="lp-label" :style="{ color: itemSortBy === 'type' ? 'var(--text-1)' : 'var(--text-2)' }">File Type</span>
              <div class="lp-actions">
                <svg v-if="itemSortBy === 'type'" class="tp-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 6 11 12 3"/></svg>
              </div>
            </div>
            <div class="lp-divider"></div>
            <div class="tp-section-label">Order</div>
            <div class="lp-row lp-tappable" style="padding: 4px 16px;" @click="$emit('update:itemSortDir', 'asc')">
              <span class="lp-label" :style="{ color: itemSortDir === 'asc' ? 'var(--text-1)' : 'var(--text-2)' }">Ascending</span>
              <div class="lp-actions">
                <svg v-if="itemSortDir === 'asc'" class="tp-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 6 11 12 3"/></svg>
              </div>
            </div>
            <div class="lp-row lp-tappable" style="padding: 4px 16px;" @click="$emit('update:itemSortDir', 'desc')">
              <span class="lp-label" :style="{ color: itemSortDir === 'desc' ? 'var(--text-1)' : 'var(--text-2)' }">Descending</span>
              <div class="lp-actions">
                <svg v-if="itemSortDir === 'desc'" class="tp-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 6 11 12 3"/></svg>
              </div>
            </div>
          </div>
        </div>
        <div class="tb-sep"></div>
        <div class="zoom-ctrl">
          <button class="zoom-btn" @click="$emit('zoom-out')">
            <svg viewBox="0 0 16 16" fill="currentColor" style="width:12px;height:12px;"><rect x="3" y="7" width="10" height="2" rx="1"/></svg>
          </button>
          <input type="range" min="1" max="10" v-model.number="_zoom" class="zoom-slider"/>
          <button class="zoom-btn" @click="$emit('zoom-in')">
            <svg viewBox="0 0 16 16" fill="currentColor" style="width:12px;height:12px;"><path d="M7 3a1 1 0 012 0v4h4a1 1 0 010 2H9v4a1 1 0 01-2 0V9H3a1 1 0 010-2h4V3z"/></svg>
          </button>
        </div>

        <div class="tb-sep"></div>

        <div class="layout-menu-wrap" ref="layoutMenuRef" style="position:relative;">
          <button class="tb-btn tb-btn--layout" :class="{ active: layoutMenuOpen }" @click="layoutMenuOpen = !layoutMenuOpen" title="Layout Options">
            <svg viewBox="0 0 14 14" fill="currentColor"><rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="1" width="5" height="5" rx="1"/><rect x="1" y="8" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/></svg>
          </button>
          <div v-if="layoutMenuOpen" class="layout-popover">
            <div class="lp-row">
              <span class="lp-label">Layout</span>
              <select class="lp-select" v-model="_activeLayout" style="flex:1;">
                <option value="justified">Justified</option>
                <option value="waterfall">Waterfall</option>
                <option value="grid">Grid</option>
                <option value="list">List</option>
              </select>
            </div>
            <div class="lp-divider"></div>
            <label class="lp-row lp-tappable">
              <span class="lp-label">Show Name</span>
              <div class="lp-switch"><input type="checkbox" v-model="_gridShowName" class="lp-switch-input"/><span class="lp-switch-slider"></span></div>
            </label>
            <div class="lp-row">
              <span class="lp-label">Show item info</span>
              <div class="lp-actions">
                <select class="lp-select" v-model="_gridItemInfoType" style="margin-right:8px;">
                  <option value="dimensions">Dimensions</option>
                  <option value="size">Size</option>
                  <option value="type">Type</option>
                </select>
                <label class="lp-switch"><input type="checkbox" v-model="_gridShowItemInfo" class="lp-switch-input"/><span class="lp-switch-slider"></span></label>
              </div>
            </div>
            <label class="lp-row lp-tappable">
              <span class="lp-label">Show extension label</span>
              <div class="lp-switch"><input type="checkbox" v-model="_gridShowExtension" class="lp-switch-input"/><span class="lp-switch-slider"></span></div>
            </label>
            <label class="lp-row lp-tappable">
              <span class="lp-label">Show subfolder contents</span>
              <div class="lp-switch"><input type="checkbox" v-model="_gridShowSubfolder" class="lp-switch-input"/><span class="lp-switch-slider"></span></div>
            </label>
            <div class="lp-divider"></div>
            <label class="lp-row lp-tappable">
              <span class="lp-label">Show sidebar</span>
              <div class="lp-switch"><input type="checkbox" v-model="_showSidebar" class="lp-switch-input"/><span class="lp-switch-slider"></span></div>
            </label>
            <label class="lp-row lp-tappable">
              <span class="lp-label">Show inspector</span>
              <div class="lp-switch"><input type="checkbox" v-model="_showInspector" class="lp-switch-input"/><span class="lp-switch-slider"></span></div>
            </label>
          </div>
        </div>

        <div class="tb-sep"></div>

        <button class="tb-btn" :class="{ active: _filterBarOpen }" @click="_filterBarOpen = !_filterBarOpen" title="Toggle Filters">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="5" x2="13" y2="5"/><line x1="5" y1="8" x2="11" y2="8"/><line x1="7" y1="11" x2="9" y2="11"/></svg>
        </button>

        <div class="tb-sep"></div>

        <div class="search-wrap" :class="{ 'search-active': searchFocused || searchText.length > 0 }">
          <svg class="search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6.5" r="4"/><line x1="10" y1="10" x2="14" y2="14"/></svg>
          <input class="search-input" v-model="_searchText"
            @focus="searchFocused = true" @blur="searchFocused = false"
            placeholder="Search" />
          <button v-show="searchText.length > 0" class="search-clear" @click="clearSearch">
            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 4l8 8M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <span v-show="!searchText && !searchFocused" class="search-hint">F</span>
        </div>
      </div>

      <!-- Right: sits above inspector panel -->
      <div class="tb-right">
        <div v-if="!isMac" class="win-controls">
          <button class="win-btn win-min" @click="$emit('minimize')" title="Minimize">
            <svg viewBox="0 0 12 12" fill="none"><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="win-btn win-max" @click="$emit('maximize')" title="Maximize/Restore">
            <svg viewBox="0 0 12 12" fill="none"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>
          </button>
          <button class="win-btn win-close" @click="$emit('close')" title="Close">
            <svg viewBox="0 0 12 12" fill="none"><line x1="1.5" y1="1.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="10.5" y1="1.5" x2="1.5" y2="10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>

    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{
  isMac: boolean
  showSidebar: boolean
  sidebarWidth: number
  activeView: string
  itemsLength: number
  zoom: number
  activeLayout: string
  gridShowName: boolean
  gridShowItemInfo: boolean
  gridItemInfoType: string
  gridShowExtension: boolean
  gridShowSubfolder: boolean
  showInspector: boolean
  filterBarOpen: boolean
  searchText: string
  itemSortBy: string
  itemSortDir: string
  THEMES: any[]
  ACCENT_COLORS: any[]
  currentTheme: string
  currentAccent: string
  currentTranslucency: boolean
  showBack?: boolean
}>()

const emit = defineEmits([
  'update:showSidebar', 'update:zoom', 'update:activeLayout',
  'update:gridShowName', 'update:gridShowItemInfo', 'update:gridItemInfoType',
  'update:gridShowExtension', 'update:gridShowSubfolder',
  'update:showInspector', 'update:filterBarOpen', 'update:searchText', 'update:itemSortBy', 'update:itemSortDir',
  'toggle-panels', 'empty-trash', 'search', 'zoom-in', 'zoom-out',
  'minimize', 'maximize', 'close',
  'preview-theme', 'clear-preview', 'select-theme', 'select-accent',
  'select-translucency',
  'back'
])

const themeMenuOpen = ref(false)
const themeMenuRef = ref<HTMLElement>()
const sortMenuOpen = ref(false)
const sortMenuRef = ref<HTMLElement>()
const layoutMenuOpen = ref(false)
const layoutMenuRef = ref<HTMLElement>()
const searchFocused = ref(false)

const _zoom = computed({ get: () => props.zoom, set: v => emit('update:zoom', v) })
const _activeLayout = computed({ get: () => props.activeLayout, set: v => emit('update:activeLayout', v) })
const _gridShowName = computed({ get: () => props.gridShowName, set: v => emit('update:gridShowName', v) })
const _gridShowItemInfo = computed({ get: () => props.gridShowItemInfo, set: v => emit('update:gridShowItemInfo', v) })
const _gridItemInfoType = computed({ get: () => props.gridItemInfoType, set: v => emit('update:gridItemInfoType', v) })
const _gridShowExtension = computed({ get: () => props.gridShowExtension, set: v => emit('update:gridShowExtension', v) })
const _gridShowSubfolder = computed({ get: () => props.gridShowSubfolder, set: v => emit('update:gridShowSubfolder', v) })
const _showSidebar = computed({ get: () => props.showSidebar, set: v => emit('update:showSidebar', v) })
const _showInspector = computed({ get: () => props.showInspector, set: v => emit('update:showInspector', v) })
const _filterBarOpen = computed({ get: () => props.filterBarOpen, set: v => emit('update:filterBarOpen', v) })
const _searchText = computed({
  get: () => props.searchText,
  set: v => { emit('update:searchText', 'update:itemSortBy', 'update:itemSortDir', v); emit('search'); }
})

function clearSearch() {
  emit('update:searchText', 'update:itemSortBy', 'update:itemSortDir', '')
  emit('search')
}

function onDocClick(e: MouseEvent) {
  if (layoutMenuOpen.value && layoutMenuRef.value && !layoutMenuRef.value.contains(e.target as Node)) {
    layoutMenuOpen.value = false
  }
  if (sortMenuOpen.value && sortMenuRef.value && !sortMenuRef.value.contains(e.target as Node)) {
    sortMenuOpen.value = false
  }
  if (themeMenuOpen.value && themeMenuRef.value && !themeMenuRef.value.contains(e.target as Node)) {
    themeMenuOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<style scoped>
.toolbar{position:relative;z-index:100;height:50px;flex-shrink:0;background:var(--bg-gallery);display:flex;align-items:center;-webkit-app-region:drag;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);}
.toolbar--macos{padding-left:80px;}

.tb-sidebar{height:100%;flex-shrink:0;background:var(--bg-sidebar);border-bottom:1px solid var(--border);border-right:1px solid var(--border);display:flex;align-items:center;justify-content:flex-end;padding:0 12px;gap:12px;box-sizing:border-box;}
.tb-main{flex:1;height:100%;display:flex;align-items:center;border-bottom:1px solid var(--border);min-width:0;}
.tb-left{flex:1;height:100%;-webkit-app-region:drag;}
.tb-center{display:flex;align-items:center;gap:10px;-webkit-app-region:no-drag;padding:0 12px;}
.tb-right{width:290px;flex-shrink:0;height:100%;display:flex;align-items:center;justify-content:flex-end;padding-right:12px;-webkit-app-region:no-drag;border-left:1px solid var(--border);}
.tb-sep{width:1px;height:18px;background:var(--border);margin:0 2px;flex-shrink:0;}
.tb-trash-btn{background:#ff5f57;color:white;border-radius:6px;padding:0 14px;font-weight:600;font-size:12px;border:none;width:auto;height:28px;cursor:pointer;white-space:nowrap;}

.tb-btn{width:28px;height:28px;border-radius:6px;border:none;background:transparent;color:var(--text-2);display:flex;align-items:center;justify-content:center;-webkit-app-region:no-drag;transition:all .2s var(--anim-spring-fast);}
.tb-btn:not(:disabled):hover{background:var(--bg-hover);color:var(--text-1);transform:scale(1.05);}
.tb-btn:disabled{opacity:0.3;cursor:default;}
.tb-btn svg{width:16px;height:16px;}
.tb-btn--layout svg{width:14px;height:14px;}
.tb-btn--layout.active{color:var(--accent);}

.zoom-ctrl{display:flex;align-items:center;gap:6px;-webkit-app-region:no-drag;}
.zoom-btn{width:22px;height:22px;border-radius:4px;border:none;background:transparent;color:var(--text-2);display:flex;align-items:center;justify-content:center;cursor:pointer;}
.zoom-btn:hover{color:var(--text-1);background:var(--bg-hover);}
.zoom-slider{-webkit-appearance:none;appearance:none;width:90px;height:4px;border-radius:2px;background:var(--border);outline:none;cursor:pointer;transition:background .2s;}
.zoom-slider:hover{background:var(--border-hover);}
.zoom-slider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.3);border:none;}

.search-wrap{position:relative;display:flex;align-items:center;-webkit-app-region:no-drag;width:180px;transition:width 0.25s cubic-bezier(0.16, 1, 0.3, 1);}
.search-wrap.search-active{width:300px;}
.search-icon{position:absolute;left:10px;width:14px;height:14px;color:var(--text-3);pointer-events:none;}
.search-input{background:var(--bg-input);border:1px solid var(--border);border-radius:10px;padding:6px 28px 6px 30px;color:var(--text-1);font-size:12.5px;width:100%;transition:border-color 0.2s, box-shadow 0.2s, background 0.2s;outline:none;}
.search-input:hover{background:var(--bg-hover);}
.search-input:focus{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-dim);background:var(--bg-input);}
.search-clear{position:absolute;right:8px;width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;color:var(--text-2);display:flex;align-items:center;justify-content:center;cursor:pointer;}
.search-clear:hover{background:rgba(255,255,255,0.2);color:var(--text-1);}
.search-clear svg{width:8px;height:8px;}
.search-hint{position:absolute;right:10px;pointer-events:none;font-size:10px;color:var(--text-3);background:rgba(255,255,255,0.05);padding:2px 5px;border-radius:4px;border:1px solid rgba(255,255,255,0.05);font-family:var(--font-mono);}

.win-controls{display:flex;height:100%;}
.win-btn{ width:46px;height:100%; border:none;background:transparent; color:var(--text-3); display:flex;align-items:center;justify-content:center; cursor:pointer; transition:background .12s, color .12s; }
.win-btn svg{width:10px;height:10px;}
.win-btn:hover{background:rgba(255,255,255,.07);color:var(--text-1);}
.win-close:hover{background:#ff5f57 !important;color:#fff !important;}
.win-min:hover{background:rgba(255,255,255,.07);}
.win-max:hover{background:rgba(255,255,255,.07);}

/* ── Theme Popover ───────────────────────────────────────────────────────── */
.theme-popover { position: absolute; top: calc(100% + 8px); left: 0; width: 220px; background: rgba(28, 30, 38, 0.96); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.09); border-radius: 12px; padding: 8px 0 10px; box-shadow: 0 0 0 1px rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.2), 0 16px 32px rgba(0,0,0,0.4), 0 24px 64px rgba(0,0,0,0.5); z-index: 1000; animation: popIn .2s var(--anim-spring-fast) forwards; transform-origin: top left; }
.tp-header { font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .1em; padding: 4px 14px 8px; font-family: var(--font); }
.tp-section-label { font-size: 10px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .08em; padding: 6px 14px 4px; font-family: var(--font); }
.tp-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 8px 0; }
.tp-themes { display: flex; flex-direction: column; }
.tp-theme-row { display: flex; align-items: center; gap: 10px; padding: 6px 14px; background: transparent; border: none; cursor: pointer; color: var(--text-2); font-size: 13px; font-family: var(--font); transition: background .1s, color .1s; width: 100%; text-align: left; }
.tp-theme-row:hover { background: rgba(255,255,255,0.06); color: var(--text-1); }
.tp-theme-row--active { color: var(--text-1); }
.tp-swatch { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.15); }
.tp-theme-name { flex: 1; font-size: 12px; }
.tp-check { width: 12px; height: 12px; color: var(--accent); flex-shrink: 0; }
.tp-accents { display: flex; flex-wrap: wrap; gap: 7px; padding: 6px 14px 4px; }
.tp-accent-btn { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; flex-shrink: 0; transition: transform .15s cubic-bezier(0.34,1.56,0.64,1), border-color .15s; box-shadow: 0 2px 6px rgba(0,0,0,0.25); }
.tp-accent-btn:hover { transform: scale(1.2); }
.tp-accent-btn--active { border-color: #fff; transform: scale(1.15); box-shadow: 0 0 0 3px rgba(255,255,255,0.2); }

/* Custom Color Picker */
.tp-color-picker-wrap {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  border: 1px solid rgba(255,255,255,0.2);
  transition: transform .15s;
}
.tp-color-picker-wrap:hover { transform: scale(1.2); }
.tp-color-picker {
  position: absolute;
  inset: -10px;
  width: 200%;
  height: 200%;
  cursor: pointer;
  padding: 0;
  border: none;
  background: transparent;
}
.tp-color-picker-visual {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tp-option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
}
.tp-option-label {
  font-size: 12px;
  color: var(--text-2);
}

/* ── Layout Popover ──────────────────────────────────────────────────────── */
.layout-popover { position: absolute; top: 100%; right: -8px; margin-top: 12px; width: 250px; background: rgba(30, 32, 39, 0.95); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; box-shadow: 0 0 0 1px rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.2), 0 16px 32px rgba(0,0,0,0.4), 0 24px 64px rgba(0,0,0,0.5); padding: 8px 0; z-index: 1000; animation: popIn .25s var(--anim-spring-fast) forwards; transform-origin: top right; font-family: var(--font); color: var(--text-1); }
.lp-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; font-size: 13px; }
.lp-tappable { cursor: pointer; user-select: none; }
.lp-tappable:hover { background: rgba(255,255,255,0.05); }
.lp-label { font-weight: 500; }
.lp-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 6px 0; }
.lp-actions { display: flex; align-items: center; justify-content: flex-end; }
.lp-select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; color: var(--text-1); font-size: 11px; padding: 4px 20px 4px 8px; cursor: pointer; appearance: none; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="8" height="6" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M1 1l3 3 3-3"/></svg>'); background-repeat: no-repeat; background-position: right 8px center; outline: none; }
.lp-select:hover { background-color: rgba(255,255,255,0.1); }
.lp-select option { background: #1e2027; color: #fff; }
.lp-switch { position: relative; display: inline-block; width: 34px; height: 18px; }
.lp-switch-input { opacity: 0; width: 0; height: 0; margin: 0; }
.lp-switch-slider { position: absolute; cursor: pointer; inset: 0; background-color: rgba(255,255,255,0.1); border-radius: 20px; transition: .15s ease-in-out; }
.lp-switch-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px; background-color: #fff; border-radius: 50%; transition: .15s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
.lp-switch-input:checked + .lp-switch-slider { background-color: var(--accent); }
.lp-switch-input:checked + .lp-switch-slider:before { transform: translateX(16px); }

@keyframes popIn {
  from { opacity: 0; transform: scale(.95); }
  to   { opacity: 1; transform: scale(1); }
}

.tb-btn:active, .zoom-btn:active {
  transform: scale(0.95) !important;
  transition: transform 0.05s !important;
}
</style>