<script setup lang="ts">
import SectionHeader from '@/components/ui/SectionHeader.vue'

defineProps<{
  title: string
  count?: number | string
  summary?: string
}>()
</script>

<template>
  <section class="inv-section">
    <SectionHeader class="inv-section-head" :title="title" :count="count" :meta="summary" />
    <div class="inv-list">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.inv-section { padding: 6px 0; }
.inv-section-head { margin-bottom: 10px; }
.inv-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
