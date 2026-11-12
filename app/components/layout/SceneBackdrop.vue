<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import bgUrl from '@/assets/bg.jpeg'
import { createLogger } from '@/utils/logger'

const props = defineProps<{
  /** The picture to show; null is the bundled default. */
  url: string | null
}>()

const log = createLogger('scene-backdrop')

// Matches SCENE_FADE_SECONDS of the sound: the picture and the sound change over together.
const FADE_MS = 2000

// `base` is what is on screen; `incoming` is decoded and fading in over it. At most these two exist.
const base = ref(bgUrl)
const incoming = ref<string | null>(null)
const fading = ref(false)

let request = 0
let promote: ReturnType<typeof setTimeout> | undefined
let failed: string | null = null

function reduceMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function settle() {
  clearTimeout(promote)
  if (incoming.value !== null) base.value = incoming.value
  incoming.value = null
  fading.value = false
}

async function decoded(src: string): Promise<boolean> {
  const img = new Image()
  img.src = src
  try {
    await img.decode()
    return true
  } catch (err) {
    // One line per picture, however often the same address is asked for again.
    if (failed !== src) log.warn('picture could not be decoded, keeping the current one', { err })
    failed = src
    return false
  }
}

watch(() => props.url ?? bgUrl, async (next) => {
  const mine = ++request
  if (next === base.value && incoming.value === null) return
  // Back to what is already showing under a fade: drop the fade.
  if (next === base.value) {
    clearTimeout(promote)
    incoming.value = null
    fading.value = false
    return
  }
  if (!(await decoded(next)) || mine !== request) return
  // A fade still running is finished at once, so the new picture fades in over the last one.
  settle()
  if (reduceMotion()) {
    base.value = next
    return
  }
  incoming.value = next
  // The layer needs one frame at opacity 0 before the transition has anything to run from.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (mine !== request) return
    fading.value = true
    promote = setTimeout(settle, FADE_MS + 50)
  }))
}, { immediate: true })

onBeforeUnmount(() => {
  request++
  clearTimeout(promote)
})
</script>

<template>
  <div class="scene-backdrop" aria-hidden="true">
    <div class="sb-layer" data-layer="base" :style="{ backgroundImage: `url(${base})` }" />
    <div
      v-if="incoming !== null"
      :class="['sb-layer', 'sb-incoming', { 'is-visible': fading }]"
      data-layer="incoming"
      :style="{ backgroundImage: `url(${incoming})` }"
    />
    <div class="sb-shade" />
  </div>
</template>

<style scoped>
.scene-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.sb-layer {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}
.sb-incoming {
  opacity: 0;
  transition: opacity 2s ease;
}
.sb-incoming.is-visible { opacity: 1; }
/* The gradient lies over both layers, so it does not fade with the picture. */
.sb-shade {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(to bottom, var(--vtt-sunken-a35), var(--vtt-sunken-a15) 40%, var(--vtt-sunken-a55));
}

@media (prefers-reduced-motion: reduce) {
  .sb-incoming { transition: none; }
}
</style>
