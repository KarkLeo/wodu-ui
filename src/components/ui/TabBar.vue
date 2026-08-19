<script setup lang="ts">
import type { Component } from 'vue'

interface TabItem {
  value: string
  label: string
  icon?: Component
  dot?: 'accent' | 'danger' | 'info'
  badge?: number | string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  tabs: TabItem[]
  variant?: 'top' | 'bottom'
  size?: 'sm' | 'md' | 'lg'
}>(), {
  variant: 'top',
  size: 'md',
})

const model = defineModel<string>({ required: true })
</script>

<template>
  <div
    :class="[
      'tab-bar',
      { 'variant-bottom': props.variant === 'bottom' },
      props.size === 'sm' ? 'size-sm' : props.size === 'lg' ? 'size-lg' : '',
    ]"
    role="tablist"
  >
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      role="tab"
      :aria-selected="model === tab.value"
      :class="[
        'tab-item',
        {
          'is-active': model === tab.value,
          'is-disabled': tab.disabled,
        },
      ]"
      :disabled="tab.disabled"
      @click="!tab.disabled && (model = tab.value)"
    >
      <span v-if="tab.icon" class="tab-item-glyph"><component :is="tab.icon" /></span>
      <span class="tab-item-label">{{ tab.label }}</span>
      <span
        v-if="tab.dot"
        :class="['tab-item-dot', `kind-${tab.dot}`]"
      />
      <span v-if="tab.badge !== undefined" class="tab-item-badge">{{ tab.badge }}</span>
    </button>
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--vtt-bg-surface);
  border-bottom: 1px solid var(--vtt-border-subtle);
  overflow-x: auto;
  scrollbar-width: none;
}
.tab-bar::-webkit-scrollbar { display: none; }

.tab-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1 1 0;
  min-width: 0;
  padding: 10px 10px 12px;
  background: transparent;
  border: none;
  border-radius: var(--r-xs) var(--r-xs) 0 0;
  color: var(--vtt-text-muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.04em;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color var(--t-fast) var(--ease),
    background var(--t-fast) var(--ease);
}
.tab-item:hover:not(:disabled) {
  color: var(--vtt-text-secondary);
  background: rgba(228, 201, 160, 0.03);
}
.tab-item:focus-visible {
  outline: 1px solid var(--vtt-border-gold);
  outline-offset: -2px;
}

.tab-item.is-active {
  color: var(--vtt-accent-soft);
  background: var(--vtt-bg-elevated);
}
.tab-item.is-active::after {
  content: "";
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: -1px;
  height: 2px;
  background: linear-gradient(to right, var(--vtt-accent-deep), var(--vtt-accent));
  border-radius: 2px 2px 0 0;
}

.tab-item.is-disabled {
  color: var(--vtt-border-strong);
  cursor: not-allowed;
  pointer-events: none;
}

.tab-item-glyph {
  width: 14px;
  height: 14px;
  color: currentColor;
  opacity: 0.7;
  flex-shrink: 0;
}
.tab-item-glyph :deep(svg) { width: 100%; height: 100%; display: block; }
.tab-item.is-active .tab-item-glyph { opacity: 1; }

.tab-item-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-item-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--r-pill);
  background: var(--vtt-accent);
  box-shadow: 0 0 6px rgba(212, 168, 87, 0.8);
  animation: tab-dot-pulse 1.8s ease-in-out infinite;
  flex-shrink: 0;
}
.tab-item-dot.kind-danger {
  background: var(--vtt-danger-bright);
  box-shadow: 0 0 6px rgba(178, 59, 79, 0.7);
}
.tab-item-dot.kind-info {
  background: var(--vtt-info);
  box-shadow: 0 0 6px rgba(90, 122, 142, 0.7);
  animation: none;
}
@keyframes tab-dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.tab-item-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--vtt-text-secondary);
  line-height: 1;
  flex-shrink: 0;
}
.tab-item.is-active .tab-item-badge {
  background: var(--vtt-bg-elevated);
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}

.tab-bar.size-sm .tab-item { padding: 7px 12px 9px; font-size: 12px; gap: 6px; }
.tab-bar.size-sm .tab-item-glyph { width: 12px; height: 12px; }
.tab-bar.size-sm .tab-item-badge { min-width: 16px; height: 16px; font-size: 9px; }

.tab-bar.size-lg .tab-item { padding: 12px 22px 14px; font-size: 14px; }

@media (max-width: 480px) {
  .tab-item {
    padding: 10px 4px 12px;
    font-size: 11.5px;
    letter-spacing: 0.02em;
  }
}

.tab-bar.variant-bottom {
  border-top: 1px solid var(--vtt-border-subtle);
  border-bottom: none;
  padding: 6px;
}
.tab-bar.variant-bottom .tab-item {
  flex-direction: column;
  gap: 4px;
  padding: 8px 4px;
  border-radius: var(--r-sm);
  font-size: 11px;
  letter-spacing: 0.06em;
  min-width: 0;
}
.tab-bar.variant-bottom .tab-item-glyph { width: 18px; height: 18px; opacity: 0.75; }
.tab-bar.variant-bottom .tab-item.is-active { background: var(--vtt-bg-elevated); }
.tab-bar.variant-bottom .tab-item.is-active::after {
  left: 50%;
  right: auto;
  bottom: 2px;
  transform: translateX(-50%);
  width: 16px;
  height: 2px;
}
.tab-bar.variant-bottom .tab-item-dot {
  position: absolute;
  top: 6px;
  right: calc(50% - 14px);
}
.tab-bar.variant-bottom .tab-item-badge {
  position: absolute;
  top: 4px;
  right: calc(50% - 20px);
  min-width: 14px;
  height: 14px;
  font-size: 9px;
  padding: 0 4px;
}
</style>
