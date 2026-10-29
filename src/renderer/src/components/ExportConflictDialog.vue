<template>
  <Teleport to="body">
    <Transition name="cnf-fade">
      <div v-if="modelValue" class="cnf-backdrop" @click.self="onCancel">
        <Transition name="cnf-pop">
          <div v-if="modelValue" class="cnf-dialog" role="dialog" aria-modal="true" aria-labelledby="cnf-title">
            
            <!-- Header -->
            <div class="cnf-header">
              <span id="cnf-title" class="cnf-title">File Name Collision</span>
              <button class="cnf-close" @click="onCancel" aria-label="Close">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <path d="M3 3l10 10M13 3L3 13"/>
                </svg>
              </button>
            </div>

            <!-- Content Area -->
            <div class="cnf-body">
              <div class="cnf-alert-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <div class="cnf-text">
                <p class="cnf-desc">The file <span class="cnf-filename">"{{ conflict?.name }}"</span> already exists in the destination folder.</p>
                <p class="cnf-subtext">What would you like to do?</p>
              </div>
            </div>

            <!-- Options -->
            <div class="cnf-options">
              <button class="cnf-opt-btn" :class="{ 'cnf-opt-btn--active': resolution === 'rename' }" @click="resolution = 'rename'">
                <div class="cnf-opt-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></div>
                <div class="cnf-opt-label">Rename</div>
                <div class="cnf-opt-desc">Keep both files (auto-renames)</div>
              </button>

              <button class="cnf-opt-btn" :class="{ 'cnf-opt-btn--active': resolution === 'overwrite' }" @click="resolution = 'overwrite'">
                <div class="cnf-opt-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></div>
                <div class="cnf-opt-label">Overwrite</div>
                <div class="cnf-opt-desc">Replace existing file</div>
              </button>

              <button class="cnf-opt-btn" :class="{ 'cnf-opt-btn--active': resolution === 'skip' }" @click="resolution = 'skip'">
                <div class="cnf-opt-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"></path><path d="M6 6l12 12"></path></svg></div>
                <div class="cnf-opt-label">Skip</div>
                <div class="cnf-opt-desc">Do not export this item</div>
              </button>
            </div>

            <!-- Footer -->
            <div class="cnf-footer">
              <label v-if="remainingCount > 1" class="cnf-apply-all">
                <input type="checkbox" v-model="applyToAll" class="cnf-check" />
                <span>Apply to all {{ remainingCount }} collisions</span>
              </label>
              <div style="flex:1"></div>
              <button class="cnf-confirm-btn" @click="onConfirm">Continue</button>
            </div>

          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  conflict: { id: string, name: string, existingPath: string } | null
  remainingCount: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'resolve', payload: {
    resolution: 'rename' | 'overwrite' | 'skip'
    applyToAll: boolean
  }): void
  (e: 'cancel'): void
}>()

const resolution = ref<'rename' | 'overwrite' | 'skip'>('rename')
const applyToAll = ref(false)

watch(() => props.modelValue, (open) => {
  if (open) {
    resolution.value = 'rename'
    applyToAll.value = false
  }
})

function onConfirm() {
  emit('resolve', { resolution: resolution.value, applyToAll: applyToAll.value })
}

function onCancel() {
  emit('cancel')
}
</script>

<style scoped>
.cnf-fade-enter-active, .cnf-fade-leave-active { transition: opacity .2s ease; }
.cnf-fade-enter-from, .cnf-fade-leave-to { opacity: 0; }

.cnf-pop-enter-active  { transition: transform .25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity .2s ease; }
.cnf-pop-leave-active  { transition: transform .18s ease, opacity .18s ease; }
.cnf-pop-enter-from    { transform: scale(0.92) translateY(10px); opacity: 0; }
.cnf-pop-leave-to      { transform: scale(0.95) translateY(6px);  opacity: 0; }

.cnf-backdrop {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
}

.cnf-dialog {
  width: 500px; max-width: calc(100vw - 40px);
  background: var(--bg-card, #1e2027);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 14px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.6);
  overflow: hidden;
  font-family: var(--font, 'Inter', system-ui, sans-serif);
  color: var(--text-1, #f0f0f2);
}

.cnf-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
}
.cnf-title { font-size: 14px; font-weight: 600; }
.cnf-close {
  width: 26px; height: 26px; border-radius: 6px; border: none;
  background: transparent; cursor: pointer; color: var(--text-3);
}
.cnf-close:hover { background: var(--bg-hover); color: var(--text-1); }

.cnf-body {
  padding: 24px 20px;
  display: flex; gap: 16px; align-items: flex-start;
}
.cnf-alert-icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: rgba(255, 189, 46, 0.1); color: #ffbd2e;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.cnf-alert-icon svg { width: 24px; height: 24px; }

.cnf-text { flex: 1; }
.cnf-desc { font-size: 14px; color: var(--text-1); line-height: 1.5; margin-bottom: 4px; }
.cnf-filename { font-weight: 700; color: var(--accent); }
.cnf-subtext { font-size: 12px; color: var(--text-3); }

.cnf-options {
  padding: 0 20px 20px;
  display: flex; flex-direction: column; gap: 8px;
}
.cnf-opt-btn {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; background: rgba(255,255,255,0.03);
  border: 1px solid var(--border); border-radius: 10px;
  cursor: pointer; text-align: left; transition: all 0.2s;
}
.cnf-opt-btn:hover { background: rgba(255,255,255,0.06); border-color: var(--border-hover); }
.cnf-opt-btn--active { background: rgba(var(--accent-rgb), 0.08); border-color: var(--accent); }

.cnf-opt-icon { width: 20px; height: 20px; color: var(--text-3); }
.cnf-opt-btn--active .cnf-opt-icon { color: var(--accent); }
.cnf-opt-label { font-size: 13px; font-weight: 600; color: var(--text-1); flex: 1; }
.cnf-opt-desc { font-size: 11px; color: var(--text-3); }

.cnf-footer {
  padding: 16px 20px;
  background: var(--bg-sidebar);
  border-top: 1px solid var(--border);
  display: flex; align-items: center;
}
.cnf-apply-all { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); cursor: pointer; }
.cnf-check { width: 14px; height: 14px; accent-color: var(--accent); }

.cnf-confirm-btn {
  padding: 8px 24px; background: var(--accent);
  color: #fff; border: none; border-radius: 8px;
  font-size: 13px; font-weight: 600; cursor: pointer;
}
.cnf-confirm-btn:hover { opacity: 0.9; }
</style>
