<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogClose } from 'reka-ui'
import IconClose from './icons/IconClose.vue'
import IconWarning from './icons/IconWarning.vue'
import { t } from '@/locales'

withDefaults(defineProps<{
  title: string
  variant?: 'gold' | 'danger'
}>(), {
  variant: 'gold',
})

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="bs-overlay" />
      <DialogContent class="bs-content-wrap">
        <div :class="['bottom-sheet', 'confirm-sheet', `v-${variant}`]">
          <div class="cs-head">
            <DialogClose class="bs-close" :aria-label="t('common.close')">
              <IconClose />
            </DialogClose>
          </div>
          <div class="cs-icon">
            <IconWarning />
          </div>
          <div class="cs-title">{{ title }}</div>
          <div class="cs-body">
            <slot />
          </div>
          <div class="cs-actions">
            <slot name="actions" />
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.confirm-sheet {
  max-width: 400px;
  text-align: center;
  padding: 10px 20px 18px;
  position: relative;
}
.confirm-sheet.v-danger {
  border-color: var(--vtt-danger-bright);
}
.cs-head {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}
.bs-close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  color: var(--vtt-text-secondary);
  cursor: pointer;
  padding: 0;
}
.bs-close:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}
.bs-close :deep(svg) { width: 12px; height: 12px; }

.cs-icon {
  width: 44px;
  height: 44px;
  margin: 0 auto 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vtt-warning);
  border-radius: var(--r-pill);
  color: var(--vtt-warning);
  background: rgba(192, 138, 62, 0.08);
}
.confirm-sheet.v-danger .cs-icon {
  border-color: var(--vtt-danger-bright);
  color: var(--vtt-danger-bright);
  background: rgba(178, 59, 79, 0.08);
}
.cs-icon :deep(svg) { width: 22px; height: 22px; }

.cs-title {
  font-family: var(--font-serif);
  font-size: 18px;
  color: var(--vtt-accent-soft);
  margin-bottom: 6px;
}
.cs-body {
  color: var(--vtt-text-secondary);
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 18px;
}
.cs-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
