<script setup lang="ts">
import { computed } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'

type Kind = 'damage' | 'armor' | 'coin' | 'dim'
type Size = 'sm' | 'base' | 'lg'

const props = withDefaults(defineProps<{
  kind: Kind
  label: string
  value: string | number
  meta?: string
  size?: Size
  mod?: string
  hasPopover?: boolean
}>(), {
  size: 'base',
})

const emit = defineEmits<{
  (e: 'open', open: boolean): void
}>()

const modClass = computed(() => {
  if (!props.mod) return null
  const trimmed = props.mod.trim()
  if (trimmed.startsWith('+')) return 'is-buff'
  if (trimmed.startsWith('−') || trimmed.startsWith('-')) return 'is-debuff'
  return null
})
</script>

<template>
  <PopoverRoot v-if="hasPopover" @update:open="emit('open', $event)">
    <PopoverTrigger as-child>
      <button
        type="button"
        :class="[
          'status-chip',
          `kind-${kind}`,
          size === 'sm' ? 'sc-sm' : size === 'lg' ? 'sc-lg' : '',
        ]"
      >
        <span class="sc-label">{{ label }}</span>
        <span class="sc-value-row">
          <span v-if="$slots.symbol" class="sc-symbol" aria-hidden="true">
            <slot name="symbol" />
          </span>
          <span class="sc-value">{{ value }}</span>
        </span>
        <span v-if="meta" class="sc-meta">{{ meta }}</span>
        <span v-if="mod" :class="['sc-mod', modClass]">{{ mod }}</span>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="sc-popover"
        :side-offset="8"
        side="bottom"
        align="start"
      >
        <slot name="popover" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>

  <div
    v-else
    :class="[
      'status-chip',
      `kind-${kind}`,
      size === 'sm' ? 'sc-sm' : size === 'lg' ? 'sc-lg' : '',
    ]"
  >
    <span class="sc-label">{{ label }}</span>
    <span class="sc-value-row">
      <span v-if="$slots.symbol" class="sc-symbol" aria-hidden="true">
        <slot name="symbol" />
      </span>
      <span class="sc-value">{{ value }}</span>
    </span>
    <span v-if="meta" class="sc-meta">{{ meta }}</span>
    <span v-if="mod" :class="['sc-mod', modClass]">{{ mod }}</span>
  </div>
</template>

<style scoped>
.status-chip {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 68px;
  padding: 6px 14px 8px;
  background: transparent;
  border: none;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background var(--t-fast) var(--ease);
  user-select: none;
  position: relative;
  color: inherit;
  font-family: inherit;
}
.status-chip:hover { background: var(--vtt-bg-surface); }

.status-chip .sc-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  line-height: 1;
}

.status-chip .sc-value-row {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  line-height: 1;
}
.status-chip .sc-value {
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 22px;
  color: var(--vtt-accent-soft);
  letter-spacing: 0.01em;
}
.status-chip .sc-symbol {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--vtt-text-muted);
  opacity: 0.9;
}
.status-chip .sc-symbol :deep(svg) {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}

.status-chip .sc-meta {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  line-height: 1;
  margin-top: 2px;
}

.status-chip.kind-damage .sc-value { color: var(--vtt-accent-soft); }
.status-chip.kind-damage .sc-symbol { color: var(--vtt-danger); }

.status-chip.kind-armor .sc-value { color: var(--vtt-accent-soft); }
.status-chip.kind-armor .sc-symbol { color: var(--vtt-info); }

.status-chip.kind-coin .sc-value { color: var(--vtt-accent); }
.status-chip.kind-coin .sc-symbol { color: var(--vtt-accent-deep); }

.status-chip.kind-dim .sc-value { color: var(--vtt-text-muted); }
.status-chip.kind-dim .sc-symbol { color: var(--vtt-text-muted); opacity: 0.5; }

.status-chip.sc-sm { min-width: 48px; padding: 4px 10px 5px; gap: 2px; }
.status-chip.sc-sm .sc-value { font-size: 16px; }
.status-chip.sc-sm .sc-label { font-size: 9px; letter-spacing: 0.16em; }
.status-chip.sc-sm .sc-meta { display: none; }
.status-chip.sc-sm .sc-symbol { width: 12px; height: 12px; }
.status-chip.sc-sm .sc-symbol :deep(svg) { width: 11px; height: 11px; }

.status-chip.sc-lg { min-width: 104px; padding: 10px 18px 12px; gap: 4px; }
.status-chip.sc-lg .sc-value { font-size: 34px; }
.status-chip.sc-lg .sc-label { font-size: 11px; }

.status-chip.is-active {
  background: var(--vtt-bg-elevated);
  box-shadow: 0 0 0 1px var(--vtt-border-strong);
}

.status-chip .sc-mod {
  position: absolute;
  top: -2px;
  right: 2px;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  border-radius: var(--r-pill);
  background: var(--vtt-bg-base);
  border: 1px solid var(--vtt-border-strong);
  line-height: 1;
  pointer-events: none;
}
.status-chip .sc-mod.is-buff {
  color: var(--vtt-success);
  border-color: rgba(107, 142, 78, 0.55);
  background: rgba(107, 142, 78, 0.12);
}
.status-chip .sc-mod.is-debuff {
  color: var(--vtt-danger-bright);
  border-color: rgba(178, 59, 79, 0.55);
  background: rgba(58, 24, 32, 0.9);
}
</style>

<style>
.sc-popover {
  position: relative;
  width: 300px;
  padding: 14px 16px;
  background: rgba(36, 28, 21, 0.96);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  border: 1px solid var(--vtt-border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-2);
  z-index: 200;
  font-family: var(--font-sans);
  color: var(--vtt-text-primary);
}

.sc-popover .pop-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}
.sc-popover .pop-title {
  font-family: var(--font-serif);
  font-size: 16px;
  color: var(--vtt-accent-soft);
  font-weight: 500;
}
.sc-popover .pop-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}

.sc-popover .breakdown {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.sc-popover .breakdown-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: 8px 0;
  border-top: 1px solid var(--vtt-border-subtle);
}
.sc-popover .breakdown-row:first-child { border-top: 0; }
.sc-popover .breakdown-row .br-name {
  font-size: 13px;
  color: var(--vtt-text-primary);
  line-height: 1.3;
}
.sc-popover .breakdown-row .br-source {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--vtt-text-muted);
  margin-top: 1px;
}
.sc-popover .breakdown-row .br-value {
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  padding-left: 16px;
  white-space: nowrap;
}
.sc-popover .breakdown-row .br-value.is-buff { color: var(--vtt-success); }
.sc-popover .breakdown-row .br-value.is-debuff { color: var(--vtt-danger-bright); }

.sc-popover .breakdown-total {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  padding: 10px 0 2px;
  border-top: 1px solid var(--vtt-border-strong);
  margin-top: 4px;
}
.sc-popover .breakdown-total .bt-label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.sc-popover .breakdown-total .bt-value {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 600;
  color: var(--vtt-accent);
}

.sc-popover .pop-hero-roll {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 12px;
  padding: 10px 16px;
  background: #A6833E;
  color: #1a1205;
  border: 1px solid #8C6A3A;
  border-radius: var(--r-pill);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  filter: drop-shadow(0 0 10px rgba(140, 106, 58, 0.28));
}
.sc-popover .pop-hero-roll:hover { background: #BF9A4C; }
</style>
