<script setup lang="ts">
import IconBag from '@/components/ui/icons/IconBag.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import { t } from '@/locales'

defineEmits<{
  (e: 'open-catalog'): void
  (e: 'open-custom'): void
}>()
</script>

<template>
  <div class="inv-toolbar">
    <button type="button" class="inv-toolbar-btn" @click="$emit('open-catalog')">
      <IconBag />
      {{ t('inGame.inventory.openCatalog') }}
    </button>
    <button type="button" class="inv-toolbar-btn" @click="$emit('open-custom')">
      <IconPlus />
      {{ t('inGame.inventory.addCustom') }}
    </button>
  </div>
</template>

<style scoped>
.inv-toolbar {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.inv-toolbar-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 14px;
  background: transparent;
  border: 1px dashed var(--vtt-border-strong);
  border-radius: var(--r-sm);
  color: var(--vtt-text-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
.inv-toolbar-btn:hover {
  border-color: var(--vtt-border-gold);
  color: var(--vtt-accent-soft);
  background: rgba(140, 106, 58, 0.05);
}
.inv-toolbar-btn :deep(svg) { width: 14px; height: 14px; }
</style>
