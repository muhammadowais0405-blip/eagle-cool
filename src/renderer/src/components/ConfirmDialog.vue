<template>
  <div v-if="open" class="modal-backdrop" @click.self="$emit('close')">
    <div class="confirm-dialog">
      <div class="cd-icon-col">
        <div class="cd-warning-icon">!</div>
      </div>
      <div class="cd-content-col">
        <h3 class="cd-title">{{ title }}</h3>
        <p class="cd-message">{{ message }}</p>
        <div class="cd-actions">
          <button class="cd-cancel" @click="$emit('close')">Cancel</button>
          <button class="cd-confirm" :class="actionClass" @click="$emit('confirm')">
            {{ actionLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  message: string
  actionLabel: string
  actionClass: string
}>()

defineEmits(['close', 'confirm'])
</script>

<style scoped>
.modal-backdrop {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

.confirm-dialog {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 400px;
  max-width: 90%;
  display: flex;
  padding: 24px;
  gap: 20px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.4);
  animation: slideUp 0.3s var(--anim-spring);
}

.cd-icon-col {
  flex-shrink: 0;
}

.cd-warning-icon {
  width: 40px; height: 40px;
  background: #ff5f57;
  color: white;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: bold;
}

.cd-content-col {
  flex: 1;
}

.cd-title {
  margin: 0 0 8px;
  font-size: 18px;
  color: var(--text-1);
}

.cd-message {
  margin: 0 0 24px;
  font-size: 14px;
  color: var(--text-3);
  line-height: 1.5;
}

.cd-actions {
  display: flex; justify-content: flex-end; gap: 12px;
}

.cd-cancel {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-2);
  font-size: 13px; font-weight: 500;
  cursor: pointer;
}
.cd-cancel:hover { background: var(--bg-hover); color: var(--text-1); }

.cd-confirm {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 13px; font-weight: 600;
  cursor: pointer;
}

.cd-confirm--blue { background: var(--accent); }
.cd-confirm--red { background: #ff5f57; }
.cd-confirm:hover { opacity: 0.9; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
</style>
