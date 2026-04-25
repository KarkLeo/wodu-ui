<script setup lang="ts" generic="T extends string">
withDefaults(defineProps<{
  options: Array<{ value: T; label: string }>
  variant?: 'block' | 'pill'
  fullWidth?: boolean
}>(), {
  variant: 'block',
  fullWidth: false,
})

const model = defineModel<T>({ required: true })
</script>

<template>
  <div
    :class="[
      'segmented',
      `is-${variant}`,
      { 'is-full': fullWidth },
    ]"
    role="tablist"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="tab"
      :aria-selected="model === opt.value"
      :class="['segmented-btn', { 'is-active': model === opt.value }]"
      @click="model = opt.value"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  overflow-x: auto;
  scrollbar-width: none;
}
.segmented::-webkit-scrollbar { display: none; }
.segmented.is-full { width: 100%; }

.segmented-btn {
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: var(--r-xs);
  color: var(--vtt-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--t-fast) var(--ease);
}
.segmented.is-full .segmented-btn { flex: 1; }
.segmented-btn:hover { color: var(--vtt-accent-soft); }
.segmented-btn.is-active {
  background: var(--vtt-bg-elevated);
  color: var(--vtt-accent);
  box-shadow: inset 0 0 0 1px var(--vtt-border-strong);
}

.segmented.is-pill {
  padding: 2px;
  border-radius: var(--r-pill);
}
.segmented.is-pill .segmented-btn {
  padding: 6px 12px;
  border-radius: var(--r-pill);
  letter-spacing: 0.14em;
}
.segmented.is-pill .segmented-btn:hover { color: var(--vtt-text-secondary); }
.segmented.is-pill .segmented-btn.is-active {
  color: var(--vtt-accent-soft);
  background: var(--vtt-bg-elevated);
  box-shadow: var(--shadow-1);
}
</style>
