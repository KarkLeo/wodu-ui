<script setup lang="ts">
import { computed } from 'vue'
import InfoPopover from './InfoPopover.vue'

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
  <InfoPopover v-if="hasPopover" side="bottom" align="start" @open="emit('open', $event)">
    <template #trigger>
      <button
        type="button"
        :class="[
          'status-chip',
          `kind-${kind}`,
          size === 'sm' ? 'sc-sm' : size === 'lg' ? 'sc-lg' : '',
        ]"
      >
        <span v-if="$slots.symbol" class="sc-glyph" aria-hidden="true">
          <slot name="symbol" />
        </span>
        <span class="sc-value"><slot name="value">{{ value }}</slot></span>
        <span class="sc-unit">{{ label }}</span>
        <span v-if="meta" class="sc-meta">{{ meta }}</span>
        <span v-if="mod" :class="['sc-mod', modClass]">{{ mod }}</span>
      </button>
    </template>
    <slot name="popover" />
  </InfoPopover>

  <div
    v-else
    :class="[
      'status-chip',
      `kind-${kind}`,
      size === 'sm' ? 'sc-sm' : size === 'lg' ? 'sc-lg' : '',
    ]"
  >
    <span v-if="$slots.symbol" class="sc-glyph" aria-hidden="true">
      <slot name="symbol" />
    </span>
    <span class="sc-value">{{ value }}</span>
    <span class="sc-unit">{{ label }}</span>
    <span v-if="meta" class="sc-meta">{{ meta }}</span>
    <span v-if="mod" :class="['sc-mod', modClass]">{{ mod }}</span>
  </div>
</template>

<style scoped>
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-radius: var(--r-xs);
  cursor: pointer;
  transition: background var(--t-fast) var(--ease);
  user-select: none;
  position: relative;
  color: inherit;
  font-family: inherit;
  line-height: 1;
}
.status-chip:hover { background: rgba(228, 201, 160, 0.04); }

.status-chip .sc-glyph {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--vtt-accent-deep);
}
.status-chip .sc-glyph :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.status-chip .sc-value {
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 18px;
  color: var(--vtt-accent-soft);
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.status-chip .sc-unit {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}

.status-chip .sc-meta {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  opacity: 0.8;
}

.status-chip.kind-damage .sc-glyph { color: var(--vtt-danger-bright); }
.status-chip.kind-armor  .sc-glyph { color: var(--vtt-info); }
.status-chip.kind-coin   .sc-glyph { color: var(--vtt-accent); }
.status-chip.kind-coin   .sc-value { color: var(--vtt-accent); }
.status-chip.kind-dim    .sc-glyph { color: var(--vtt-text-muted); opacity: 0.5; }
.status-chip.kind-dim    .sc-value { color: var(--vtt-text-muted); }

.status-chip.sc-sm { padding: 4px 8px; gap: 6px; }
.status-chip.sc-sm .sc-glyph { width: 14px; height: 14px; }
.status-chip.sc-sm .sc-value { font-size: 14px; }
.status-chip.sc-sm .sc-unit  { font-size: 9px; letter-spacing: 0.12em; }
.status-chip.sc-sm .sc-meta  { display: none; }

.status-chip.sc-lg { padding: 8px 16px; gap: 10px; }
.status-chip.sc-lg .sc-glyph { width: 22px; height: 22px; }
.status-chip.sc-lg .sc-value { font-size: 24px; }
.status-chip.sc-lg .sc-unit  { font-size: 11px; }

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
.info-popover .breakdown-row .br-source {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--vtt-text-muted);
  margin-top: 1px;
}
.info-popover .breakdown-row .br-value.is-buff { color: var(--vtt-success); }
.info-popover .breakdown-row .br-value.is-debuff { color: var(--vtt-danger-bright); }

.info-popover .breakdown-total {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  padding: 10px 0 2px;
  border-top: 1px solid var(--vtt-border-strong);
  margin-top: 4px;
}
.info-popover .breakdown-total .bt-label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.info-popover .breakdown-total .bt-value {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 600;
  color: var(--vtt-accent);
}

.info-popover .pop-hero-roll {
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
.info-popover .pop-hero-roll:hover { background: #BF9A4C; }
</style>
