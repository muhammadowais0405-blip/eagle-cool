<template>
  <div class="welcome">
    <div class="welcome-grid"></div>

    <div class="welcome-card">
      <!-- Logo / wordmark -->
      <div class="wc-logo">
        <div class="wc-logo-icon">
          <img :src="appIconUrl" style="width: 32px; height: 32px; margin-right: 8px;"
            @error="(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'" />
        </div>
        <span class="wc-logo-text">Media Library</span>
      </div>

      <h1 class="wc-title">Your visual library,<br>beautifully organized.</h1>
      <p class="wc-sub">Import, tag, and browse all your images, videos, and design assets — stored locally, always private.</p>

      <!-- Primary actions -->
      <div class="wc-actions">
        <button class="wc-btn wc-btn--primary" @click="$emit('create')">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="8" y1="5" x2="8" y2="11"/><line x1="5" y1="8" x2="11" y2="8"/></svg>
          Create Library
        </button>
        <button class="wc-btn wc-btn--secondary" @click="$emit('open')">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/></svg>
          Open Library
        </button>
      </div>

      <!-- Recent libraries (if any) -->
      <div v-if="recentLibraries.length" class="wc-recent">
        <p class="wc-recent-label">Recent</p>
        <div class="wc-recent-list">
          <button
            v-for="lib in recentLibraries.slice(0, 5)" :key="lib.path"
            class="wc-recent-item"
            @click="$emit('open-recent', lib.path)"
          >
            <div class="wc-recent-icon">
              <svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/></svg>
            </div>
            <div class="wc-recent-info">
              <span class="wc-recent-name">{{ lib.name }}</span>
              <span class="wc-recent-path">{{ lib.path }}</span>
            </div>
            <span class="wc-recent-date">{{ timeAgo(lib.openedAt) }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { timeAgo } from '../formatters'
const appIconUrl = new URL('../assets/icons/icon.png', import.meta.url).href

defineProps<{
  recentLibraries: Array<{ path: string; name: string; openedAt: number }>
}>()

defineEmits<{
  (e: 'create'): void
  (e: 'open'): void
  (e: 'open-recent', path: string): void
}>()
</script>

<style scoped>
.welcome{position:fixed;inset:0;background:var(--bg-base);display:flex;align-items:center;justify-content:center;z-index:100;}
.welcome-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;}
.welcome-card{position:relative;z-index:1;width:480px;max-width:90vw;display:flex;flex-direction:column;gap:0;}
.wc-logo{display:flex;align-items:center;gap:10px;margin-bottom:28px;}
.wc-logo-icon svg{width:32px;height:32px;}
.wc-logo-text{font-size:18px;font-weight:600;color:var(--text-1);letter-spacing:-.02em;}
.wc-title{font-size:30px;font-weight:700;color:var(--text-1);line-height:1.2;letter-spacing:-.03em;margin-bottom:12px;}
.wc-sub{font-size:14px;color:var(--text-2);line-height:1.6;margin-bottom:32px;}
.wc-actions{display:flex;gap:10px;margin-bottom:36px;}
.wc-btn{display:flex;align-items:center;gap:8px;padding:11px 20px;border-radius:9px;font-size:13px;font-weight:500;cursor:pointer;border:none;transition:all .15s;}
.wc-btn svg{width:15px;height:15px;}
.wc-btn--primary{background:var(--accent);color:#fff;flex:1;}
.wc-btn--primary:hover{opacity:.9;transform:translateY(-1px);}
.wc-btn--secondary{background:var(--bg-card);color:var(--text-1);border:1px solid var(--border);flex:1;}
.wc-btn--secondary:hover{border-color:var(--border-hover);background:rgba(255,255,255,.07);transform:scale(1.02);transition:transform 0.3s var(--anim-spring-fast);}
.wc-recent{border-top:1px solid var(--border);padding-top:20px;}
.wc-recent-label{font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;}
.wc-recent-list{display:flex;flex-direction:column;gap:2px;}
.wc-recent-item{display:flex;align-items:center;gap:12px;padding:9px 10px;border-radius:7px;background:transparent;border:none;cursor:pointer;text-align:left;width:100%;transition:background .12s, transform .2s var(--anim-spring-fast);}
.wc-recent-item:hover{background:var(--bg-card);transform:translateX(2px);}
.wc-recent-icon{width:30px;height:30px;border-radius:6px;background:var(--bg-card);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.wc-recent-icon svg{width:13px;height:13px;color:var(--text-2);}
.wc-recent-info{flex:1;min-width:0;}
.wc-recent-name{display:block;font-size:13px;font-weight:500;color:var(--text-1);}
.wc-recent-path{display:block;font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}
.wc-recent-date{font-size:11px;color:var(--text-3);flex-shrink:0;}
</style>