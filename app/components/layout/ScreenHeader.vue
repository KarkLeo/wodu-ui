<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="screen-header">
    <div class="screen-header-titles">
      <h1 class="screen-header-title">{{ title }}</h1>
      <p v-if="subtitle" class="screen-header-subtitle">{{ subtitle }}</p>
    </div>
    <slot name="actions" />
  </header>
</template>

<style scoped>
.screen-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.screen-header-titles { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.screen-header-title {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 22px;
  line-height: 1.2;
  color: var(--vtt-accent-soft);
}
.screen-header-subtitle {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
  color: var(--vtt-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
