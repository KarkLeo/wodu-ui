<script setup lang="ts">
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button class="info-btn" type="button" aria-label="Подробнее">ⓘ</button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="info-content" :side-offset="6" align="start">
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
.info-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 13px;
  padding: 0 3px;
  line-height: 1;
  vertical-align: middle;
  flex-shrink: 0;
}
.info-btn:hover { color: var(--color-text); }
</style>

<style>
/* PopoverPortal teleports content outside component scope — scoped CSS won't match */
.info-content {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 10px 14px;
  min-width: 180px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  z-index: 200;
  font-size: 13px;
  font-family: var(--font-family);
  color: var(--color-text);
}
</style>
