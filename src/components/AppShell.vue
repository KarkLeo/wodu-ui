<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'

withDefaults(defineProps<{
  variant?: 'top' | 'bottom'
}>(), { variant: 'bottom' })

const headerEl = ref<HTMLElement | null>(null)
const contentEl = ref<HTMLElement | null>(null)
const sentinelEl = ref<HTMLElement | null>(null)
const compact = ref(false)
const compactSpacer = ref(0)
let io: IntersectionObserver | null = null

// Collapsing the header grows the content area; if the content overflowed by less than that,
// scrollTop would snap to 0 and the header would expand again in a loop. A bottom spacer of the
// saved height keeps the scroll range (sized generously first, trimmed after the compact render).
function setCompact(next: boolean) {
  if (next === compact.value) return
  if (!next) {
    compact.value = false
    compactSpacer.value = 0
    return
  }
  const fullHeight = headerEl.value?.offsetHeight ?? 0
  compactSpacer.value = fullHeight
  compact.value = true
  void nextTick(() => {
    const compactHeight = headerEl.value?.offsetHeight ?? fullHeight
    compactSpacer.value = Math.max(0, fullHeight - compactHeight)
  })
}

onMounted(() => {
  if (!contentEl.value || !sentinelEl.value) return
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) setCompact(!e.isIntersecting)
    },
    { root: contentEl.value, threshold: 0 },
  )
  io.observe(sentinelEl.value)
})
onBeforeUnmount(() => {
  io?.disconnect()
  io = null
})
</script>

<template>
  <div :class="['app-shell', { 'variant-mobile': variant === 'bottom' }]">
    <header ref="headerEl" class="app-shell-header">
      <slot name="header" :compact="compact" />
    </header>

    <div ref="contentEl" class="app-shell-content">
      <div ref="sentinelEl" class="app-shell-sentinel" aria-hidden="true" />
      <slot />
      <div v-if="compactSpacer" class="app-shell-compact-spacer" :style="{ height: `${compactSpacer}px` }" aria-hidden="true" />
    </div>

    <nav class="app-shell-tabs">
      <slot name="tabs" />
    </nav>

    <div v-if="$slots.fab" class="app-shell-fab-slot">
      <slot name="fab" />
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--vtt-bg-base);
}

.app-shell-header {
  order: 1;
  z-index: 3;
}

.app-shell-tabs {
  order: 2;
  z-index: 2;
}

.app-shell-content {
  order: 3;
  flex: 1 1 auto;
  min-height: 0;
  padding: 0;
  position: relative;
  overflow-y: auto;
}

.app-shell-sentinel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  pointer-events: none;
}

.app-shell-fab-slot {
  position: absolute;
  right: 20px;
  bottom: 20px;
  z-index: 5;
}

.app-shell.variant-mobile .app-shell-tabs {
  position: sticky;
  top: auto;
  bottom: 0;
  order: 4;
}
.app-shell.variant-mobile .app-shell-content {
  order: 3;
  padding: 16px 14px 100px;
}
.app-shell.variant-mobile .app-shell-fab-slot {
  right: 14px;
  bottom: 86px;
}

@media (max-width: 960px) {
  .app-shell-content {
    padding: 14px 14px 16px;
  }
  .app-shell-tabs {
    order: 4;
    z-index: 4;
    background: rgba(7, 5, 10, 0.78);
    backdrop-filter: blur(22px) saturate(1.1);
    -webkit-backdrop-filter: blur(22px) saturate(1.1);
  }
  .app-shell-fab-slot {
    bottom: 86px;
  }
}
</style>
