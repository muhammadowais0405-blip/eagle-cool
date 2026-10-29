<template>
  <div class="detail-view" @dblclick="$emit('close')">
    <!-- Image View -->
    <div 
      v-if="!isMedia(item.ext)" 
      class="dv-media-container"
      :class="{ 'is-comparing': uiStore.isCompareMode && item.hasEnhanced }"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerUp"
    >
      <!-- Comparison Mode -->
      <template v-if="uiStore.isCompareMode && item.hasEnhanced">
        <div class="dv-compare-wrap" :style="imgStyle">
          <!-- Background: Original -->
          <img :src="originalUrl" class="dv-img dv-img--original" draggable="false" />
          
          <!-- Foreground: Enhanced -->
          <div class="dv-enhanced-clip" :style="{ clipPath: `inset(0 ${100 - comparePercent}% 0 0)` }">
            <img :src="mediaUrl" class="dv-img dv-img--enhanced" draggable="false" />
          </div>

          <!-- Slider Line -->
          <div 
            class="dv-compare-slider" 
            :style="{ left: comparePercent + '%' }"
            @pointerdown.stop="startCompareDrag"
          >
            <div class="dv-slider-handle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M11 5l-7 7 7 7M13 19l7-7-7-7"/></svg>
            </div>
          </div>

          <!-- Labels -->
          <div class="dv-compare-label dv-compare-label--left">Enhanced</div>
          <div class="dv-compare-label dv-compare-label--right">Original</div>
        </div>
      </template>

      <!-- Standard Mode -->
      <img 
        v-else
        :src="mediaUrl" 
        class="dv-img" 
        :style="imgStyle"
        draggable="false"
      />
    </div>

    <!-- Video/Audio View -->
    <div v-else class="dv-media-container dv-video-container" :key="item.id"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerUp"
    >
      <div v-if="isAudio(item.ext)" class="dv-audio-wrap" :style="videoWrapperStyle" @dblclick.stop>
        <img v-if="item.thumbnailPath" :src="`media://local/${encodeURIComponent(item.thumbnailPath)}`" class="dv-audio-thumb" draggable="false" />
        <div v-else class="dv-audio-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        </div>
        <audio ref="mediaRef" playsinline></audio>
      </div>
      <div v-else class="dv-video-wrap" :style="videoWrapperStyle" @dblclick.stop>
        <video ref="mediaRef" playsinline></video>
      </div>
    </div>

    <!-- Navigation Overlay (Visible on hover) -->
    <div class="dv-nav dv-nav--left" @click.stop="$emit('prev')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
    </div>
    <div class="dv-nav dv-nav--right" @click.stop="$emit('next')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </div>
    
    <button class="dv-close" @click="$emit('close')" data-tooltip="Back to Gallery (Esc)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as PlyrModule from 'plyr'
const Plyr = (PlyrModule as any).default ?? PlyrModule
import 'plyr/dist/plyr.css'
import plyrIconsRaw from '../assets/icons/plyr.svg?raw'
import { useUIStore } from '../stores/ui'

const props = defineProps<{
  item: any
}>()

const emit = defineEmits(['close', 'next', 'prev'])
const uiStore = useUIStore()

const mediaUrl = computed(() => {
  const base = `media://local/${encodeURIComponent(props.item.contentPath)}`
  const maxSide = Math.max(props.item.width || 0, props.item.height || 0)
  if (!isMedia(props.item.ext) && maxSide < 1500) {
    return base + '?upscale=1'
  }
  return base
})

const originalUrl = computed(() => {
  return `media://local/${encodeURIComponent(props.item.contentPath)}?original=1`
})

function isAudio(ext: string) {
  return ['mp3', 'wav', 'ogg'].includes(ext?.toLowerCase())
}

function isVideo(ext: string) {
  return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'mpeg', 'mpg'].includes(ext?.toLowerCase())
}

function isMedia(ext: string) {
  return isVideo(ext) || isAudio(ext)
}

// ─── Image Zoom & Pan ───────────────────────────────────────────────────────
const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const isDragging = ref(false)
const lastMouseX = ref(0)
const lastMouseY = ref(0)

// Comparison State
const comparePercent = ref(50)
const isDraggingSlider = ref(false)

const imgStyle = computed(() => ({
  transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`,
  cursor: isDraggingSlider.value ? 'col-resize' : (isDragging.value ? 'grabbing' : (scale.value > 1 ? 'grab' : 'default')),
  transition: (isDragging.value || isDraggingSlider.value) ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)'
}))

const videoWrapperStyle = computed(() => {
  const style: any = { ...imgStyle.value }
  if (props.item.width && props.item.height && !isAudio(props.item.ext)) {
    const ratio = props.item.width / props.item.height
    // Ensure it doesn't exceed screen height (accounting for padding)
    style.maxWidth = `calc((100vh - 80px) * ${ratio})`
  }
  return style
})

function onWheel(e: WheelEvent) {
  const delta = -e.deltaY
  const factor = Math.pow(1.1, delta / 150)
  const oldScale = scale.value
  const newScale = Math.max(0.5, Math.min(20, oldScale * factor))
  
  if (newScale === oldScale) return

  // Zoom to cursor logic
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  const dx = (mouseX - rect.width / 2 - offsetX.value) / oldScale
  const dy = (mouseY - rect.height / 2 - offsetY.value) / oldScale

  scale.value = newScale
  offsetX.value -= dx * (newScale - oldScale)
  offsetY.value -= dy * (newScale - oldScale)
  
  if (scale.value <= 1.01) {
    scale.value = 1
    offsetX.value = 0
    offsetY.value = 0
  }
}

// ─── Unified Pointer Handling (Mouse + Touch + Pen) ────────────────────────
const activePointers = new Map<number, { x: number, y: number }>()
let pinchStartDistance = 0
let pinchStartScale = 1
let pinchCenterX = 0
let pinchCenterY = 0
let pinchStartOffsetX = 0
let pinchStartOffsetY = 0

function getPinchDistance() {
  const pts = [...activePointers.values()]
  if (pts.length < 2) return 0
  return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
}

function getPinchCenter() {
  const pts = [...activePointers.values()]
  if (pts.length < 2) return { x: 0, y: 0 }
  return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
}

function onPointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement
  if (target?.closest('.plyr__controls') || target?.closest('.plyr__control') || target?.closest('button') || target?.closest('input')) return

  // Capture pointer so we keep getting events even if finger leaves element
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}

  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (activePointers.size === 1) {
    // Single pointer (mouse drag OR single-finger touch drag) — start pan if zoomed
    if (scale.value <= 1 && !(uiStore.isCompareMode && props.item.hasEnhanced)) return

    // Compare mode click-to-move-slider (mouse only)
    if (e.pointerType === 'mouse' && uiStore.isCompareMode && props.item.hasEnhanced && scale.value <= 1) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = e.clientX - rect.left
      comparePercent.value = (x / rect.width) * 100
      isDraggingSlider.value = true
      return
    }

    isDragging.value = true
    lastMouseX.value = e.clientX
    lastMouseY.value = e.clientY
  } else if (activePointers.size === 2) {
    // Two pointers — start pinch zoom + two-finger pan
    isDragging.value = false
    isDraggingSlider.value = false
    pinchStartDistance = getPinchDistance()
    pinchStartScale = scale.value
    const center = getPinchCenter()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    pinchCenterX = center.x - rect.left
    pinchCenterY = center.y - rect.top
    pinchStartOffsetX = offsetX.value
    pinchStartOffsetY = offsetY.value
  }
}

function onPointerMove(e: PointerEvent) {
  if (!activePointers.has(e.pointerId)) return
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  // Compare slider drag (mouse only)
  if (isDraggingSlider.value) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    comparePercent.value = Math.max(0, Math.min(100, (x / rect.width) * 100))
    return
  }

  if (activePointers.size === 2 && pinchStartDistance > 0) {
    // Pinch zoom: distance ratio drives scale, center point drives pan
    const currentDistance = getPinchDistance()
    if (currentDistance < 1) return

    const factor = currentDistance / pinchStartDistance
    const newScale = Math.max(0.5, Math.min(20, pinchStartScale * factor))
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const center = getPinchCenter()
    const centerX = center.x - rect.left
    const centerY = center.y - rect.top

    // Two-finger drag: pan based on center movement
    const dx = centerX - pinchCenterX
    const dy = centerY - pinchCenterY

    // Cursor-centered zoom math: keep the pinch center anchored
    const oldScale = scale.value
    const zoomDx = (centerX - rect.width / 2 - pinchStartOffsetX - dx) / oldScale
    const zoomDy = (centerY - rect.height / 2 - pinchStartOffsetY - dy) / oldScale

    scale.value = newScale
    offsetX.value = pinchStartOffsetX + dx - zoomDx * (newScale - oldScale)
    offsetY.value = pinchStartOffsetY + dy - zoomDy * (newScale - oldScale)

    if (scale.value <= 1.01) {
      scale.value = 1
      offsetX.value = 0
      offsetY.value = 0
    }
    return
  }

  // Single pointer pan
  if (activePointers.size === 1 && isDragging.value) {
    const dx = e.clientX - lastMouseX.value
    const dy = e.clientY - lastMouseY.value
    offsetX.value += dx
    offsetY.value += dy
    lastMouseX.value = e.clientX
    lastMouseY.value = e.clientY
  }
}

function onPointerUp(e: PointerEvent) {
  activePointers.delete(e.pointerId)
  try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {}

  if (activePointers.size < 2) {
    pinchStartDistance = 0
  }
  if (activePointers.size === 0) {
    isDragging.value = false
    isDraggingSlider.value = false
  }
}

function startCompareDrag(e: PointerEvent) {
  isDraggingSlider.value = true
}

// ─── Plyr Integration ───────────────────────────────────────────────────────
const mediaRef = ref<HTMLVideoElement | HTMLAudioElement | null>(null)
let player: Plyr | null = null

function syncPositionState() {
  if ('mediaSession' in navigator && mediaRef.value && mediaRef.value.duration) {
    try {
      navigator.mediaSession.setPositionState({
        duration: mediaRef.value.duration,
        playbackRate: mediaRef.value.playbackRate,
        position: mediaRef.value.currentTime
      })
    } catch (e) {}
  }
}

function updateMediaSession() {
  if ('mediaSession' in navigator && props.item) {
    const artUrl = props.item.thumbnailPath 
      ? `media://local/${encodeURIComponent(props.item.thumbnailPath)}`
      : mediaUrl.value
      
    const artType = props.item.thumbnailPath ? 'image/webp' : getMimeType(props.item.ext)

    navigator.mediaSession.metadata = new MediaMetadata({
      title: props.item.name,
      artist: 'Eagle Media Manager',
      artwork: [
        { src: artUrl, sizes: '512x512', type: artType }
      ]
    })

    navigator.mediaSession.setActionHandler('play', () => player?.play())
    navigator.mediaSession.setActionHandler('pause', () => player?.pause())
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const skipTime = details.seekOffset || 5
      player!.currentTime = Math.max(0, player!.currentTime - skipTime)
      syncPositionState()
    })
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const skipTime = details.seekOffset || 5
      player!.currentTime = Math.min(player!.duration, player!.currentTime + skipTime)
      syncPositionState()
    })
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        player!.currentTime = details.seekTime
        syncPositionState()
      }
    })
  }
}

function getMimeType(ext: string) {
  const m: any = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg' }
  return m[ext?.toLowerCase()] || 'video/mp4'
}

function initPlayer() {
  if (mediaRef.value) {
    mediaRef.value.src = mediaUrl.value

    player = new Plyr(mediaRef.value, {
      iconUrl: '', // empty string forces Plyr to use inline symbols without fetching
      controls: ['play-large', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'mute', 'volume', 'settings', 'speed', 'fullscreen'],
      seekTime: 5,
      hideControls: false,
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] }
    })

    // Listeners to keep Media Session in sync
    mediaRef.value.addEventListener('play', syncPositionState)
    mediaRef.value.addEventListener('pause', syncPositionState)
    mediaRef.value.addEventListener('timeupdate', syncPositionState)
    mediaRef.value.addEventListener('loadedmetadata', () => {
      updateMediaSession()
      syncPositionState()
    })

    updateMediaSession()
  }
}

watch(() => props.item.id, async () => {
  scale.value = 1
  offsetX.value = 0
  offsetY.value = 0

  await nextTick()

  if (isMedia(props.item.ext)) {
    if (mediaRef.value) {
      if (player) {
        try { player.destroy() } catch(e) {}
        player = null
      }
      initPlayer()
    }
  } else {
    if (player) {
      try { player.destroy() } catch(e) {}
      player = null
    }
  }
})

// ─── Global Keydown for Seeking & Navigation ──────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

  if (isMedia(props.item.ext) && player) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault(); e.stopPropagation()
      player.rewind(5)
      return
    } else if (e.key === 'ArrowRight') {
      e.preventDefault(); e.stopPropagation()
      player.forward(5)
      return
    } else if (e.key === '.') {
      e.preventDefault(); e.stopPropagation()
      player.currentTime = Math.min(player.duration, player.currentTime + (1/30))
      return
    } else if (e.key === ',') {
      e.preventDefault(); e.stopPropagation()
      player.currentTime = Math.max(0, player.currentTime - (1/30))
      return
    } else if (e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation()
      player.speed = Math.min(2, player.speed + 0.25)
      return
    } else if (e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation()
      player.speed = Math.max(0.5, player.speed - 0.25)
      return
    } else if (e.key.toLowerCase() === 'p') {
      e.preventDefault()
      player.pip = !player.pip
      return
    } else if (e.key === ' ') {
      e.preventDefault(); player.togglePlay()
      return
    }
  }

  // Prevent Space bar from scrolling the page when not a media item
  if (e.key === ' ' || e.key === 'Space') {
    e.preventDefault()
  }

  // Gallery Navigation (if not handled by video seeking)
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    e.stopPropagation()
    emit('prev')
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    e.stopPropagation()
    emit('next')
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    emit('close')
  }
}

onMounted(() => {
  if (!document.getElementById('plyr-svg-sprite')) {
    const div = document.createElement('div')
    div.id = 'plyr-svg-sprite'
    div.innerHTML = plyrIconsRaw
    div.style.display = 'none'
    document.body.appendChild(div)
  }

  if (isMedia(props.item.ext)) {
    initPlayer()
  }
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (player) {
    try { player.destroy() } catch(e) {}
    player = null
  }
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.detail-view {
  position: absolute;
  inset: 0;
  background: var(--bg-gallery);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  user-select: none;
}

.dv-media-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  touch-action: none; /* Prevent browser pinch-zoom & pan */
  -webkit-user-select: none;
  user-select: none;
}

.dv-img {
  max-width: 95%;
  max-height: 95%;
  object-fit: contain;
  transition: transform 0.05s ease-out;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}

/* Comparison Styles */
.dv-compare-wrap {
  position: relative;
  width: 95%;
  height: 95%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dv-compare-wrap .dv-img {
  position: absolute;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  object-fit: contain;
  box-shadow: none;
}

.dv-enhanced-clip {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dv-compare-slider {
  position: absolute;
  top: 0; bottom: 0;
  width: 2px;
  background: #fff;
  z-index: 10;
  cursor: col-resize;
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
}

.dv-slider-handle {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 36px; height: 36px;
  background: #fff;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  pointer-events: none;
}
.dv-slider-handle svg { width: 18px; height: 18px; }

.dv-compare-label {
  position: absolute;
  bottom: 20px;
  padding: 4px 10px;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(10px);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 4px;
  z-index: 11;
  pointer-events: none;
}
.dv-compare-label--left { left: 20px; }
.dv-compare-label--right { right: 20px; }

.is-comparing {
  cursor: col-resize;
}

.dv-video-container {
  padding: 40px;
  background: #000;
  overflow: hidden;
}

.dv-video-wrap {
  width: 100%;
  max-height: calc(100vh - 80px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.05s ease-out;
}

.dv-audio-wrap {
  width: 100%;
  max-width: 600px;
  background: #111;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  transition: transform 0.05s ease-out;
}

.dv-audio-thumb {
  width: 100%;
  height: 300px;
  object-fit: cover;
  background: #000;
}

.dv-audio-placeholder {
  width: 100%;
  height: 300px;
  background: #222;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
}
.dv-audio-placeholder svg { width: 64px; height: 64px; }

.dv-video-container :deep(.plyr) {
  width: 100%;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}
.dv-video-wrap :deep(.plyr) {
  border-radius: 8px;
}

.dv-close {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: all 0.2s;
  z-index: 110;
}
.dv-close:hover {
  background: var(--accent);
  border-color: var(--accent);
  transform: scale(1.1);
}
.dv-close svg { width: 20px; height: 20px; }

.dv-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 60px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.3);
  cursor: pointer;
  transition: all 0.2s;
  z-index: 105;
  opacity: 0;
}
.detail-view:hover .dv-nav {
  opacity: 1;
}
.dv-nav:hover {
  color: #fff;
  background: rgba(255,255,255,0.05);
}
.dv-nav--left { left: 0; border-radius: 0 8px 8px 0; }
.dv-nav--right { right: 0; border-radius: 8px 0 0 8px; }
.dv-nav svg { width: 32px; height: 32px; }
</style>

