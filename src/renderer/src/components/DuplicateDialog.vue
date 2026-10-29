<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <Transition name="dup-fade">
      <div v-if="modelValue" class="dup-backdrop" @click.self="onCancel">

        <Transition name="dup-pop">
          <div v-if="modelValue" class="dup-dialog" role="dialog" aria-modal="true" aria-labelledby="dup-title">

            <!-- Header -->
            <div class="dup-header">
              <span id="dup-title" class="dup-title">Duplicate File Alert</span>
              <button class="dup-close" @click="onCancel" aria-label="Close">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <path d="M3 3l10 10M13 3L3 13"/>
                </svg>
              </button>
            </div>

            <!-- Card pair -->
            <div class="dup-cards">
              <!-- Existing -->
              <div class="dup-card">
                <div class="dup-thumb-wrap">
                  <img v-if="existingThumb" :src="existingThumb" class="dup-thumb-img" />
                  <div v-else class="dup-thumb-placeholder">{{ extIcon(existing?.ext ?? '') }}</div>
                  <span class="dup-badge dup-badge--existing">Existing</span>
                </div>
                <div class="dup-card-info">
                  <div class="dup-card-name" :title="existing?.name">{{ existing?.name }}</div>
                  <div class="dup-card-meta">
                    {{ existing?.width && existing?.height ? `${existing.width} × ${existing.height}` : '—' }}
                    / {{ formatSize(existing?.size ?? 0) }}
                  </div>
                  <span class="dup-ext-badge">{{ (existing?.ext ?? '').toUpperCase() }}</span>
                </div>
              </div>

              <!-- VS divider -->
              <div class="dup-vs">
                <div class="dup-vs-line"></div>
                <span class="dup-vs-label">vs</span>
                <div class="dup-vs-line"></div>
              </div>

              <!-- Incoming -->
              <div class="dup-card">
                <div class="dup-thumb-wrap">
                  <img v-if="incomingThumb" :src="incomingThumb" class="dup-thumb-img" />
                  <div v-else class="dup-thumb-placeholder">{{ extIcon(incomingExt) }}</div>
                  <span class="dup-badge dup-badge--incoming">Imported</span>
                </div>
                <div class="dup-card-info">
                  <div class="dup-card-name" :title="incomingName">{{ incomingName }}</div>
                  <div class="dup-card-meta">
                    {{ incomingMeta }}
                  </div>
                  <span class="dup-ext-badge">{{ incomingExt.toUpperCase() }}</span>
                </div>
              </div>
            </div>

            <!-- Footer: resolution choice + action -->
            <div class="dup-footer">
              <div class="dup-options">
                <label class="dup-option" :class="{ 'dup-option--active': resolution === 'use_existing' }">
                  <input type="radio" v-model="resolution" value="use_existing" class="dup-radio" />
                  <span class="dup-radio-dot"></span>
                  <span class="dup-option-label">Use existing file</span>
                </label>
                <label class="dup-option" :class="{ 'dup-option--active': resolution === 'keep_both' }">
                  <input type="radio" v-model="resolution" value="keep_both" class="dup-radio" />
                  <span class="dup-radio-dot"></span>
                  <span class="dup-option-label">Keep both</span>
                  <span class="dup-option-hint">(auto-renames copy)</span>
                </label>
              </div>

              <!-- Apply to all remaining dupes in the current import batch -->
              <label v-if="remainingCount > 1" class="dup-apply-all">
                <input type="checkbox" v-model="applyToAll" class="dup-check" />
                <span>Apply to all {{ remainingCount }} duplicates</span>
              </label>

              <button class="dup-import-btn" @click="onConfirm">Import</button>
            </div>

          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { IndexEntry } from '../types'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  modelValue: boolean                  // v-model: dialog open state
  existing: IndexEntry | null          // the already-imported item
  incomingPath: string                 // absolute path to the file being imported
  incomingName: string                 // basename of incoming file
  incomingExt: string
  incomingMeta: string                 // "275 × 183 / 18.19 KB"
  remainingCount: number               // how many dupes remain in this batch (for "apply all")
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  /** User made a choice — caller handles the actual import */
  (e: 'resolve', payload: {
    resolution: 'use_existing' | 'keep_both'
    applyToAll: boolean
  }): void
  (e: 'cancel'): void
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const resolution  = ref<'use_existing' | 'keep_both'>('use_existing')
const applyToAll  = ref(false)
const existingThumb  = ref<string | null>(null)
const incomingThumb  = ref<string | null>(null)

// Reset each time the dialog opens with a new pair
watch(() => props.modelValue, async (open) => {
  if (!open) return
  resolution.value  = 'use_existing'
  applyToAll.value  = false
  existingThumb.value  = null
  incomingThumb.value  = null
  await loadThumbs()
})

async function loadThumbs() {
  // Load existing item thumb (via thumbnailPath or contentPath)
  if (props.existing) {
    const thumbPath = (props.existing as any).thumbnailPath ?? props.existing.contentPath
    existingThumb.value = `media://local/${encodeURIComponent(thumbPath)}`
  }
  // Load incoming file thumb directly from its source path
  incomingThumb.value = `media://local/${encodeURIComponent(props.incomingPath)}`
}

// ── Actions ───────────────────────────────────────────────────────────────────

function onConfirm() {
  emit('resolve', { resolution: resolution.value, applyToAll: applyToAll.value })
  emit('update:modelValue', false)
}

function onCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function extIcon(ext: string): string {
  const map: Record<string, string> = {
    png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🎞', webp: '🖼', svg: '✏️',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬', webm: '🎬',
    pdf: '📄', ai: '✏️', psd: '🎨', sketch: '💎',
  }
  return map[ext.toLowerCase()] ?? '📁'
}
</script>

<style scoped>
/* ── Transitions ─────────────────────────────────────────────────────────── */
.dup-fade-enter-active, .dup-fade-leave-active { transition: opacity .2s ease; }
.dup-fade-enter-from, .dup-fade-leave-to { opacity: 0; }

.dup-pop-enter-active  { transition: transform .25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity .2s ease; }
.dup-pop-leave-active  { transition: transform .18s ease, opacity .18s ease; }
.dup-pop-enter-from    { transform: scale(0.92) translateY(10px); opacity: 0; }
.dup-pop-leave-to      { transform: scale(0.95) translateY(6px);  opacity: 0; }

/* ── Backdrop ────────────────────────────────────────────────────────────── */
.dup-backdrop {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
}

/* ── Dialog box ──────────────────────────────────────────────────────────── */
.dup-dialog {
  width: 760px; max-width: calc(100vw - 40px);
  background: var(--bg-card, #1e2027);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 14px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.3);
  overflow: hidden;
  font-family: var(--font, 'Inter', system-ui, sans-serif);
  color: var(--text-1, #f0f0f2);
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.dup-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
}
.dup-title {
  font-size: 14px; font-weight: 600; color: var(--text-1, #f0f0f2);
}
.dup-close {
  width: 26px; height: 26px; border-radius: 6px; border: none;
  background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-3, #595e69); transition: background .15s, color .15s;
}
.dup-close svg { width: 13px; height: 13px; }
.dup-close:hover { background: var(--bg-hover, rgba(255,255,255,0.06)); color: var(--text-1, #f0f0f2); }

/* ── Card pair ───────────────────────────────────────────────────────────── */
.dup-cards {
  display: flex; align-items: stretch; gap: 0;
  padding: 20px;
}

.dup-card {
  flex: 1;
  display: flex; flex-direction: column; gap: 12px;
  background: var(--bg-base, rgba(14,15,17,0.5));
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  border-radius: 10px;
  padding: 14px;
}

.dup-vs {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 0 14px; flex-shrink: 0;
}
.dup-vs-line {
  width: 1px; flex: 1;
  background: var(--border, rgba(255,255,255,0.07));
  max-height: 60px;
}
.dup-vs-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .08em; color: var(--text-3, #595e69);
}

/* ── Thumbnail ────────────────────────────────────────────────────────────── */
.dup-thumb-wrap {
  position: relative;
  width: 100%; aspect-ratio: 16/9;
  background: var(--bg-input, #121316);
  border-radius: 7px; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.dup-thumb-img {
  width: 100%; height: 100%; object-fit: cover;
}
.dup-thumb-placeholder {
  font-size: 36px; opacity: .5;
}

/* ── Existing / Incoming badges ─────────────────────────────────────────── */
.dup-badge {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  padding: 5px 14px; border-radius: 20px;
  font-size: 11px; font-weight: 700; letter-spacing: .04em;
  pointer-events: none;
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.dup-badge--existing {
  background: rgba(0,0,0,0.72); color: #fff;
}
.dup-badge--incoming {
  background: var(--accent, #0066cc); color: #fff;
  box-shadow: 0 2px 12px rgba(0,102,204,0.4);
}

/* ── Card info area ──────────────────────────────────────────────────────── */
.dup-card-info {
  display: flex; flex-direction: column; gap: 4px;
}
.dup-card-name {
  font-size: 13px; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--text-1, #f0f0f2);
}
.dup-card-meta {
  font-size: 11px; color: var(--text-2, #9ba1af);
}
.dup-ext-badge {
  display: inline-block;
  padding: 2px 7px; border-radius: 4px;
  font-size: 10px; font-weight: 600; font-family: monospace;
  background: var(--bg-hover, rgba(255,255,255,0.06));
  color: var(--text-2, #9ba1af);
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  align-self: flex-start;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.dup-footer {
  display: flex; align-items: center; gap: 16px;
  padding: 14px 20px 16px;
  border-top: 1px solid var(--border, rgba(255,255,255,0.07));
  background: var(--bg-sidebar, rgba(19,21,24,0.6));
}

.dup-options {
  display: flex; align-items: center; gap: 20px; flex: 1;
}

/* Radio option */
.dup-option {
  display: flex; align-items: center; gap: 8px;
  cursor: pointer; user-select: none;
  font-size: 13px; color: var(--text-2, #9ba1af);
  transition: color .15s;
}
.dup-option--active { color: var(--text-1, #f0f0f2); }
.dup-option:hover   { color: var(--text-1, #f0f0f2); }

/* Hide the actual radio, show custom dot */
.dup-radio { display: none; }
.dup-radio-dot {
  width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--border-hover, rgba(255,255,255,0.2));
  background: transparent;
  position: relative; transition: border-color .15s;
}
.dup-option--active .dup-radio-dot {
  border-color: var(--accent, #0066cc);
  background: var(--accent, #0066cc);
  box-shadow: 0 0 0 3px var(--accent-dim, rgba(0,102,204,0.2));
}
.dup-option--active .dup-radio-dot::after {
  content: '';
  position: absolute; inset: 3px;
  background: #fff; border-radius: 50%;
}

.dup-option-hint {
  font-size: 11px; color: var(--text-3, #595e69); margin-left: -4px;
}

/* Apply-to-all checkbox */
.dup-apply-all {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-2, #9ba1af);
  cursor: pointer; user-select: none;
  white-space: nowrap;
}
.dup-check {
  width: 14px; height: 14px; accent-color: var(--accent, #0066cc); cursor: pointer;
}

/* Import button */
.dup-import-btn {
  padding: 7px 22px;
  background: var(--accent, #0066cc);
  color: #fff; border: none; border-radius: 7px;
  font-size: 13px; font-weight: 600;
  cursor: pointer;
  transition: opacity .15s, transform .1s;
  white-space: nowrap;
  flex-shrink: 0;
}
.dup-import-btn:hover  { opacity: .88; }
.dup-import-btn:active { transform: scale(.97); }
</style>
