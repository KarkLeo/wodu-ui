<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogClose, DialogTitle, DialogDescription } from 'reka-ui'
import IconButton from './IconButton.vue'
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
            <DialogClose as-child>
              <IconButton class="bs-close" :label="t('common.close')"><IconClose :size="12" /></IconButton>
            </DialogClose>
          </div>
          <div class="cs-icon">
            <IconWarning />
          </div>
          <DialogTitle as="div" class="cs-title">{{ title }}</DialogTitle>
          <DialogDescription as="div" class="cs-body">
            <slot />
          </DialogDescription>
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
  background: var(--vtt-warning-a08);
}
.confirm-sheet.v-danger .cs-icon {
  border-color: var(--vtt-danger-bright);
  color: var(--vtt-danger-bright);
  background: var(--vtt-danger-glow-a08);
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
