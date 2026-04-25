<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

withDefaults(defineProps<{
  variant?: 'top' | 'bottom'
}>(), { variant: 'bottom' })

const contentEl = ref<HTMLElement | null>(null)
const sentinelEl = ref<HTMLElement | null>(null)
const compact = ref(false)
let io: IntersectionObserver | null = null

onMounted(() => {
  if (!contentEl.value || !sentinelEl.value) return
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) compact.value = !e.isIntersecting
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
    <header class="app-shell-header">
      <slot name="header" :compact="compact" />
    </header>

    <div ref="contentEl" class="app-shell-content">
      <div ref="sentinelEl" class="app-shell-sentinel" aria-hidden="true" />
      <slot />
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
</style>
