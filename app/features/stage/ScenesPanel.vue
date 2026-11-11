<script setup lang="ts">
import { t } from '@/locales'
</script>

<template>
  <section class="scenes-panel" :aria-label="t('stage.scenes.title')">
    <h2 class="sp-title">{{ t('stage.scenes.title') }}</h2>
  </section>
</template>

<style scoped>
.scenes-panel { padding: var(--s-4); }
.sp-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 17px;
  color: var(--vtt-accent-soft);
}
</style>
