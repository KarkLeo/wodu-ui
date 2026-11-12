<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconImage from './icons/IconImage.vue'

const props = withDefaults(defineProps<{
  /** The picture's address; none draws the empty frame. */
  src?: string | null
  /** Empty for a picture that a caption beside it already names. */
  alt?: string
  /** CSS `aspect-ratio` of the frame (`4 / 3`); without it the frame takes `width` and `height`. */
  aspect?: string
  width?: string
  height?: string
  iconSize?: number
}>(), {
  src: null,
  alt: '',
  aspect: undefined,
  width: undefined,
  height: undefined,
  iconSize: 20,
})

// A picture that fails to load draws the same dashed frame as no picture, with its own state for a story or a test.
const failed = ref(false)
watch(() => props.src, () => { failed.value = false })

const state = computed(() => (!props.src ? 'empty' : failed.value ? 'failed' : 'loaded'))
const style = computed(() => ({ aspectRatio: props.aspect, width: props.width, height: props.height }))
</script>

<template>
  <span :class="['thumb', { 'is-empty': state !== 'loaded' }]" :data-state="state" :style="style">
    <img v-if="state === 'loaded'" class="thumb-img" :src="src ?? undefined" :alt="alt" @error="failed = true">
    <IconImage v-else :size="iconSize" />
    <slot />
  </span>
</template>

<style scoped>
.thumb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--r-sm);
  background: var(--vtt-bg-sunken);
}
/* Cropped to the frame; the picture itself is never changed. */
.thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb.is-empty { border: 1px dashed var(--vtt-border-strong); color: var(--vtt-text-muted); }
</style>
