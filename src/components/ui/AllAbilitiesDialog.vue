<script setup lang="ts">
import { DialogRoot, DialogTrigger, DialogPortal, DialogOverlay, DialogContent, DialogClose } from 'reka-ui'
import { ABILITIES } from '@/types/character'
</script>

<template>
  <DialogRoot>
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="all-abilities-overlay" />
      <DialogContent class="all-abilities-dialog">
        <div class="all-abilities-dialog__header">
          <span class="all-abilities-dialog__title">Все способности</span>
          <DialogClose class="all-abilities-dialog__close">✕</DialogClose>
        </div>
        <ul class="all-abilities-dialog__list">
          <li v-for="ab in ABILITIES" :key="ab.id" class="all-abilities-dialog__item">
            <span class="all-abilities-dialog__name">{{ ab.name }}</span>
            <span class="all-abilities-dialog__desc">{{ ab.description }}</span>
          </li>
        </ul>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
.all-abilities-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 300;
}

.all-abilities-dialog {
  position: fixed;
  inset: 0;
  z-index: 301;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  font-family: var(--font-family);
  color: var(--color-text);
}

.all-abilities-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.all-abilities-dialog__title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.all-abilities-dialog__close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
  line-height: 1;
}

.all-abilities-dialog__close:hover {
  color: var(--color-text);
}

.all-abilities-dialog__list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  flex: 1;
}

.all-abilities-dialog__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.all-abilities-dialog__name {
  font-size: 14px;
  font-weight: 600;
}

.all-abilities-dialog__desc {
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.5;
}
</style>
