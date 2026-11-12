<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import bgUrl from '@/assets/bg.jpeg'
import { createLogger } from '@/utils/logger'

const props = defineProps<{
  /** The picture to show; null is the bundled default. */
  url: string | null
}>()

const log = createLogger('scene-backdrop')

// `base` is what is on screen; `incoming` is decoded and fading in over it. At most these two exist.
// A fade is never interrupted: while one runs, a new request only records the newest target. When the fade
// ends, the backdrop fades on from what is then shown to the newest target, so every picture a viewer sees
// arrives by a full fade and nothing is ever cut. Superseded targets are never shown, and their loads stop.
const base = ref(bgUrl)
const incoming = ref<string | null>(null)
const fading = ref(false)
// A new element per fade, so the one that just finished is never reused (it would run its transition backwards).
const fadeId = ref(0)

let target: string = bgUrl
// The target whose picture has decoded and is ready to fade in.
let decodedTarget: string | null = null
// The target being decoded right now, if any.
let preparing: string | null = null
let request = 0
// The picture being decoded: its download is stopped when a newer request, or the unmount, replaces it.
let pending: HTMLImageElement | null = null
// Only if the incoming layer never reports the end of its transition (a hidden tab, a browser that drops the event).
let backstop: ReturnType<typeof setTimeout> | undefined
let failed: string | null = null

function reduceMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function cancelPending() {
  if (!pending) return
  pending.src = ''
  pending = null
}

async function decoded(src: string, token: number): Promise<boolean> {
  const img = new Image()
  pending = img
  img.src = src
  try {
    await img.decode()
    if (pending === img) pending = null
    return true
  } catch (err) {
    if (pending === img) pending = null
    // A request that was replaced is not a failure. One line per picture, however often the same address is asked for again.
    if (token === request) {
      if (failed !== src) log.warn('picture could not be decoded, keeping the current one', { err })
      failed = src
    }
    return false
  }
}

// The length of the layer's opacity transition in ms, as its style says (the fade length lives in the CSS).
function transitionMs(el: HTMLElement): number {
  const style = getComputedStyle(el)
  const names = style.transitionProperty.split(',').map(s => s.trim())
  const durations = style.transitionDuration.split(',').map(s => s.trim())
  const at = Math.max(0, names.findIndex(n => n === 'opacity' || n === 'all'))
  const raw = durations[at % durations.length] ?? '0s'
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return 0
  return raw.endsWith('ms') ? value : value * 1000
}

const layer = ref<HTMLElement | null>(null)

function startFade(src: string) {
  if (reduceMotion()) {
    base.value = src
    return
  }
  fadeId.value++
  incoming.value = src
  // The layer needs one frame at opacity 0 before the transition has anything to run from.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (incoming.value !== src) return
    fading.value = true
    const ms = layer.value ? transitionMs(layer.value) : 0
    // The end of the fade is the layer's own transitionend; this only stops a lost event from holding the next picture forever.
    backstop = setTimeout(settle, ms * 2 + 1000)
  }))
}

// The incoming layer's opacity transition ended (or was cancelled, which leaves it fully shown): the fade is over.
function onTransitionEnd(event: TransitionEvent) {
  // Only the current layer's own opacity: a layer already gone, or a child, is not the fade under way.
  if (event.target !== layer.value || event.propertyName !== 'opacity' || !fading.value) return
  settle()
}

// Decodes the newest target; once it is ready and no fade is running, the fade to it starts.
async function prepare() {
  const wanted = target
  const token = ++request
  preparing = wanted
  const ok = await decoded(wanted, token)
  if (token !== request) return
  preparing = null
  if (!ok) return
  decodedTarget = wanted
  advance()
}

function advance() {
  if (incoming.value !== null || target === base.value || decodedTarget !== target) return
  startFade(target)
}

function settle() {
  clearTimeout(backstop)
  if (incoming.value !== null) base.value = incoming.value
  incoming.value = null
  fading.value = false
  // A newer target arrived during the fade: continue from what is shown now.
  if (target === base.value) return
  if (decodedTarget === target) advance()
  else if (preparing !== target) void prepare()
}

watch(() => props.url ?? bgUrl, (next) => {
  if (next === target && (decodedTarget === next || next === base.value)) return
  target = next
  decodedTarget = null
  preparing = null
  cancelPending()
  request++
  if (next === base.value && incoming.value === null) return
  // Under a fade, the newest target is decoded in the meantime unless it is what the fade is heading to
  // (or back to what already shows): the end of the fade decides what comes next.
  if (next === incoming.value || next === base.value) return
  void prepare()
}, { immediate: true })

onBeforeUnmount(() => {
  request++
  cancelPending()
  clearTimeout(backstop)
})
</script>

<template>
  <div class="scene-backdrop" aria-hidden="true">
    <div class="sb-layer" data-layer="base" :style="{ backgroundImage: `url(${base})` }" />
    <div
      v-if="incoming !== null"
      :key="fadeId"
      ref="layer"
      :class="['sb-layer', 'sb-incoming', { 'is-visible': fading }]"
      data-layer="incoming"
      :style="{ backgroundImage: `url(${incoming})` }"
      @transitionend="onTransitionEnd"
      @transitioncancel="onTransitionEnd"
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
  /* 2 s matches SCENE_FADE_SECONDS of the sound: the picture and the sound change over together. Stories lengthen it. */
  transition: opacity var(--sb-fade, 2s) ease;
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
