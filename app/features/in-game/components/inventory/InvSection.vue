<script setup lang="ts">
defineProps<{
  title: string
  count?: number | string
  summary?: string
}>()
</script>

<template>
  <section class="inv-section">
    <div class="inv-section-head">
      <span class="inv-section-title">
        {{ title }}<template v-if="count !== undefined"> · {{ count }}</template>
      </span>
      <span v-if="summary" class="inv-section-count">{{ summary }}</span>
    </div>
    <div class="inv-list">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.inv-section { padding: 6px 0; }
.inv-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 12px;
}
.inv-section-title {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.inv-section-count {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--vtt-text-muted);
}
.inv-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
