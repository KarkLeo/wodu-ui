<script setup lang="ts">
import IconWarning from '@/components/ui/icons/IconWarning.vue'
</script>

<template>
  <div class="inv-warning" role="alert">
    <div class="inv-warning-icon"><IconWarning /></div>
    <div class="inv-warning-body"><slot /></div>
  </div>
</template>

<style scoped>
.inv-warning {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(192, 138, 62, 0.08);
  border: 1px solid rgba(192, 138, 62, 0.35);
  border-left: 2px solid var(--vtt-warning);
  border-radius: var(--r-sm);
  color: var(--vtt-text-secondary);
  font-size: 13px;
}
.inv-warning-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--vtt-warning);
}
.inv-warning-icon :deep(svg) { width: 100%; height: 100%; }
.inv-warning-body :deep(b) { color: var(--vtt-warning); }
</style>
