<template>
  <div v-if="open && item" class="qv-backdrop" @click="$emit('close')">
    <div class="qv-content" @click.stop>
      <video v-if="isVideo(item.ext)" 
        :src="'media://local/' + encodeURIComponent(item.contentPath)" 
        controls autoplay class="qv-img"></video>
      <img v-else :src="'media://local/' + encodeURIComponent(item.contentPath) + (item.width < 1200 || item.height < 1200 ? '?upscale=1' : '')" 
        class="qv-img" 
        @error="(e: any) => e.target.src = thumbUrl" />
    </div>
    <button class="qv-close" @click="$emit('close')">✕</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
  item: any
  thumbUrl: string | null
}>()

defineEmits(['close'])

function isVideo(ext: string) {
  return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'mpeg', 'mpg'].includes(ext.toLowerCase())
}
</script>
