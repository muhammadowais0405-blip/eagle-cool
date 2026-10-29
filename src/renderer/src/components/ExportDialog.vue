<template>
  <Teleport to="body">
    <Transition name="exp-fade">
      <div v-if="modelValue" class="exp-backdrop" @click.self="onCancel">
        <Transition name="exp-pop">
          <div v-if="modelValue" class="exp-dialog" role="dialog" aria-modal="true" aria-labelledby="exp-title">
            
            <!-- Header -->
            <div class="exp-header">
              <span id="exp-title" class="exp-title">Choose Export Version</span>
              <button class="exp-close" @click="onCancel" aria-label="Close">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <path d="M3 3l10 10M13 3L3 13"/>
                </svg>
              </button>
            </div>

            <!-- Previews -->
            <div class="exp-cards">
              <!-- Original -->
              <div class="exp-card" :class="{ 'exp-card--selected': resolution === 'original' }" @click="resolution = 'original'">
                <div class="exp-thumb-wrap">
                  <img :src="originalUrl" class="exp-thumb-img" />
                  <span class="exp-badge exp-badge--original">Original</span>
                </div>
                <div class="exp-card-info">
                  <div class="exp-card-name" :title="item?.name">{{ item?.name }}</div>
                  <div class="exp-card-meta">
                    {{ item?.width }} × {{ item?.height }} / {{ formatSize(item?.size ?? 0) }}
                  </div>
                </div>
              </div>

              <!-- VS divider -->
              <div class="exp-vs">
                <div class="exp-vs-line"></div>
                <span class="exp-vs-label">vs</span>
                <div class="exp-vs-line"></div>
              </div>

              <!-- Enhanced -->
              <div class="exp-card" :class="{ 'exp-card--selected': resolution === 'enhanced' }" @click="resolution = 'enhanced'">
                <div class="exp-thumb-wrap">
                  <img :src="enhancedUrl" class="exp-thumb-img" />
                  <span class="exp-badge exp-badge--enhanced">✨ Enhanced</span>
                </div>
                <div class="exp-card-info">
                  <div class="exp-card-name">Enhanced Version</div>
                  <div class="exp-card-meta">
                    AI Upscaled / High Quality PNG
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="exp-footer">
              <div class="exp-options">
                <label class="exp-option" :class="{ 'exp-option--active': resolution === 'original' }">
                  <input type="radio" v-model="resolution" value="original" class="exp-radio" />
                  <span class="exp-radio-dot"></span>
                  <span class="exp-option-label">Export Original</span>
                </label>
                <label class="exp-option" :class="{ 'exp-option--active': resolution === 'enhanced' }">
                  <input type="radio" v-model="resolution" value="enhanced" class="exp-radio" />
                  <span class="exp-radio-dot"></span>
                  <span class="exp-option-label">Export Enhanced</span>
                </label>
              </div>

              <!-- Apply to all -->
              <label v-if="remainingCount > 1" class="exp-apply-all">
                <input type="checkbox" v-model="applyToAll" class="exp-check" />
                <span>Apply to all {{ remainingCount }} enhanced items</span>
              </label>

              <button class="exp-confirm-btn" @click="onConfirm">Next</button>
            </div>

          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { IndexEntry } from '../types'

const props = defineProps<{
  modelValue: boolean
  item: IndexEntry | null
  remainingCount: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'resolve', payload: {
    resolution: 'original' | 'enhanced'
    applyToAll: boolean
  }): void
  (e: 'cancel'): void
}>()

const resolution = ref<'original' | 'enhanced'>('enhanced')
const applyToAll = ref(false)

const originalUrl = computed(() => {
  if (!props.item) return ''
  const p = props.item.thumbnailPath ?? props.item.contentPath
  return `media://local/${encodeURIComponent(p)}`
})

const enhancedUrl = computed(() => {
  if (!props.item) return ''
  return `media://local/${encodeURIComponent(props.item.infoPath + (window.api.platform === 'win32' ? '\\' : '/') + 'enhanced.png')}`
})

watch(() => props.modelValue, (open) => {
  if (open) {
    resolution.value = 'enhanced'
    applyToAll.value = false
  }
})

function onConfirm() {
  emit('resolve', { resolution: resolution.value, applyToAll: applyToAll.value })
}

function onCancel() {
  emit('cancel')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
</script>

<style scoped>
.exp-fade-enter-active, .exp-fade-leave-active { transition: opacity .2s ease; }
.exp-fade-enter-from, .exp-fade-leave-to { opacity: 0; }

.exp-pop-enter-active  { transition: transform .25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity .2s ease; }
.exp-pop-leave-active  { transition: transform .18s ease, opacity .18s ease; }
.exp-pop-enter-from    { transform: scale(0.92) translateY(10px); opacity: 0; }
.exp-pop-leave-to      { transform: scale(0.95) translateY(6px);  opacity: 0; }

.exp-backdrop {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
}

.exp-dialog {
  width: 760px; max-width: calc(100vw - 40px);
  background: var(--bg-card, #1e2027);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 14px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.3);
  overflow: hidden;
  font-family: var(--font, 'Inter', system-ui, sans-serif);
  color: var(--text-1, #f0f0f2);
}

.exp-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
}
.exp-title { font-size: 14px; font-weight: 600; }
.exp-close {
  width: 26px; height: 26px; border-radius: 6px; border: none;
  background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-3, #595e69); transition: background .15s, color .15s;
}
.exp-close svg { width: 13px; height: 13px; }
.exp-close:hover { background: var(--bg-hover, rgba(255,255,255,0.06)); color: var(--text-1); }

.exp-cards { display: flex; align-items: stretch; padding: 20px; }
.exp-card {
  flex: 1; display: flex; flex-direction: column; gap: 12px;
  background: var(--bg-base, rgba(14,15,17,0.5));
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  border-radius: 10px; padding: 14px; cursor: pointer; transition: all 0.2s;
}
.exp-card:hover { border-color: var(--border-hover, rgba(255,255,255,0.15)); background: rgba(255,255,255,0.03); }
.exp-card--selected { border-color: var(--accent); background: rgba(var(--accent-rgb), 0.05); }

.exp-vs { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 0 14px; flex-shrink: 0; }
.exp-vs-line { width: 1px; flex: 1; background: var(--border, rgba(255,255,255,0.07)); max-height: 60px; }
.exp-vs-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--text-3); }

.exp-thumb-wrap {
  position: relative; width: 100%; aspect-ratio: 4/3;
  background: var(--bg-input, #121316);
  border-radius: 7px; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.exp-thumb-img { width: 100%; height: 100%; object-fit: contain; }

.exp-badge {
  position: absolute; bottom: 8px; right: 8px;
  padding: 4px 10px; border-radius: 6px;
  font-size: 10px; font-weight: 700; letter-spacing: .02em;
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.exp-badge--original { background: rgba(0,0,0,0.6); color: #fff; }
.exp-badge--enhanced { background: var(--accent); color: #fff; box-shadow: 0 2px 10px rgba(var(--accent-rgb), 0.4); }

.exp-card-info { display: flex; flex-direction: column; gap: 4px; }
.exp-card-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.exp-card-meta { font-size: 11px; color: var(--text-3); }

.exp-footer {
  display: flex; align-items: center; gap: 16px;
  padding: 14px 20px 16px;
  border-top: 1px solid var(--border, rgba(255,255,255,0.07));
  background: var(--bg-sidebar, rgba(19,21,24,0.6));
}

.exp-options { display: flex; align-items: center; gap: 20px; flex: 1; }
.exp-option { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: var(--text-2); transition: color .15s; }
.exp-option--active { color: var(--text-1); }
.exp-radio { display: none; }
.exp-radio-dot {
  width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--border-hover, rgba(255,255,255,0.2));
  background: transparent; position: relative; transition: border-color .15s;
}
.exp-option--active .exp-radio-dot {
  border-color: var(--accent); background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}
.exp-option--active .exp-radio-dot::after { content: ''; position: absolute; inset: 3px; background: #fff; border-radius: 50%; }

.exp-apply-all { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); cursor: pointer; user-select: none; white-space: nowrap; }
.exp-check { width: 14px; height: 14px; accent-color: var(--accent); cursor: pointer; }

.exp-confirm-btn {
  padding: 7px 22px; background: var(--accent);
  color: #fff; border: none; border-radius: 7px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: opacity .15s, transform .1s; white-space: nowrap; flex-shrink: 0;
}
.exp-confirm-btn:hover  { opacity: .88; }
.exp-confirm-btn:active { transform: scale(.97); }
</style>
