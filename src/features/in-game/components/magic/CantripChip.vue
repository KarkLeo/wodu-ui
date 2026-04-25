<script setup lang="ts">
defineProps<{ name: string }>()
</script>

<template>
  <span class="cantrip-chip">
    <span class="cantrip-chip-glyph">
      <svg viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
        <path d="M5 1 L5 4 L7 4 L5 9 L5 6 L3 6 Z" />
      </svg>
    </span>
    {{ name }}
  </span>
</template>

<style scoped>
.cantrip-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--vtt-accent-deep);
  border-radius: var(--r-pill);
  color: var(--vtt-accent-soft);
  font-family: var(--font-serif);
  font-size: 13px;
  font-style: italic;
  cursor: default;
}
.cantrip-chip-glyph {
  width: 10px;
  height: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--vtt-accent);
}
.cantrip-chip-glyph svg { width: 100%; height: 100%; }
</style>
