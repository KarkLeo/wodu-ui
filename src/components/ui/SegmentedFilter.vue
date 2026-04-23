<script setup lang="ts">
defineProps<{
  options: Array<{ value: string; label: string }>
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="segmented" role="tablist">
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
.segmented-btn:hover { color: var(--vtt-accent-soft); }
.segmented-btn.is-active {
  background: var(--vtt-bg-elevated);
  color: var(--vtt-accent);
  box-shadow: inset 0 0 0 1px var(--vtt-border-strong);
}
</style>
