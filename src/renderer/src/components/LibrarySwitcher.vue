<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="switcher">
      <div class="sw-header">
        <span class="sw-title">Libraries</span>
        <button class="sw-close" @click="$emit('close')">✕</button>
      </div>

      <button class="sw-create" @click="$emit('create')">
        <div class="sw-create-icon">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="14"/><line x1="6" y1="10" x2="14" y2="10"/></svg>
        </div>
        <div>
          <p class="sw-create-title">Create New Library</p>
          <p class="sw-create-sub">Choose a folder and start fresh</p>
        </div>
      </button>

      <button class="sw-open-existing" @click="$emit('open')">
        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/></svg>
        Open existing folder…
      </button>

      <div v-if="recentLibraries.length" class="sw-recent">
        <p class="sw-recent-label">Recent Libraries</p>
        <div class="sw-recent-list">
          <div v-for="lib in recentLibraries" :key="lib.path" class="sw-lib-row">
            <button class="sw-lib-btn" @click="$emit('switch', lib.path)">
              <div class="sw-lib-icon" :class="{ active: lib.path === libraryPath }">
                <svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/></svg>
              </div>
              <div class="sw-lib-info">
                <span class="sw-lib-name">{{ lib.name }}</span>
                <span class="sw-lib-path">{{ lib.path }}</span>
              </div>
              <span v-if="lib.path === libraryPath" class="sw-lib-badge">Open</span>
              <span v-else class="sw-lib-ago">{{ timeAgo(lib.openedAt) }}</span>
            </button>
            <button class="sw-lib-remove" @click="$emit('remove', lib.path)" title="Remove from list">✕</button>
          </div>
        </div>
      </div>

      <div v-else class="sw-empty">
        No recent libraries
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { timeAgo } from '../formatters'

defineProps<{
  recentLibraries: Array<{ path: string; name: string; openedAt: number }>,
  libraryPath: string | null
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'create'): void
  (e: 'open'): void
  (e: 'switch', path: string): void
  (e: 'remove', path: string): void
}>()
</script>

<style scoped>
.switcher{background:rgba(26,28,34,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.1);border-radius:14px;width:460px;max-width:92vw;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;animation:popIn .3s var(--anim-spring) forwards;transform-origin:center;}
.sw-header{display:flex;align-items:center;padding:16px 18px 12px;border-bottom:1px solid var(--border);}
.sw-title{font-size:14px;font-weight:600;color:var(--text-1);flex:1;}
.sw-close{background:transparent;border:none;color:var(--text-3);font-size:16px;cursor:pointer;line-height:1;}
.sw-close:hover{color:var(--text-1);}
.sw-create{display:flex;align-items:center;gap:14px;margin:14px 14px 0;padding:14px;border-radius:10px;background:var(--accent-dim);border:1px solid rgba(232,49,138,.3);cursor:pointer;text-align:left;transition:background .15s;}
.sw-create:hover{background:rgba(232,49,138,.22);}
.sw-create-icon{width:40px;height:40px;border-radius:10px;background:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.sw-create-icon svg{width:20px;height:20px;color:#fff;}
.sw-create-title{font-size:13px;font-weight:600;color:var(--text-1);margin-bottom:2px;}
.sw-create-sub{font-size:11px;color:var(--text-2);}
.sw-open-existing{display:flex;align-items:center;gap:8px;margin:8px 14px 0;padding:9px 12px;border-radius:8px;background:transparent;border:1px solid var(--border);color:var(--text-2);font-size:12px;cursor:pointer;}
.sw-open-existing:hover{border-color:var(--border-hover);color:var(--text-1);background:var(--bg-hover);}
.sw-open-existing svg{width:13px;height:13px;}
.sw-recent{flex:1;overflow-y:auto;padding:0 14px 14px;}
.sw-recent-label{font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em;padding:14px 0 8px;}
.sw-recent-list{display:flex;flex-direction:column;gap:2px;}
.sw-lib-row{display:flex;align-items:center;gap:4px;}
.sw-lib-btn{flex:1;display:flex;align-items:center;gap:11px;padding:9px 10px;border-radius:7px;background:transparent;border:none;cursor:pointer;text-align:left;transition:background .12s;min-width:0;}
.sw-lib-btn:hover{background:var(--bg-hover);}
.sw-lib-icon{width:32px;height:32px;border-radius:7px;background:var(--bg-card);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.sw-lib-icon.active{background:var(--accent-dim);border-color:rgba(232,49,138,.4);}
.sw-lib-icon svg{width:13px;height:13px;color:var(--text-2);}
.sw-lib-icon.active svg{color:var(--accent);}
.sw-lib-info{flex:1;min-width:0;}
.sw-lib-name{display:block;font-size:13px;font-weight:500;color:var(--text-1);}
.sw-lib-path{display:block;font-size:10px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}
.sw-lib-badge{font-size:10px;background:var(--accent);color:#fff;padding:2px 7px;border-radius:20px;flex-shrink:0;}
.sw-lib-ago{font-size:11px;color:var(--text-3);flex-shrink:0;}
.sw-lib-remove{width:24px;height:24px;border-radius:5px;background:transparent;border:none;color:var(--text-3);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.sw-lib-remove:hover{background:rgba(255,80,80,.15);color:#ff5f57;}
.sw-empty{padding:24px 18px;text-align:center;color:var(--text-3);font-size:13px;}
</style>