<script setup lang="ts">
import { computed } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import Stepper from './Stepper.vue'

type Variant = 'default' | 'row' | 'hero' | 'minimal'
type Size = 'sm' | 'base' | 'lg'
type State = 'default' | 'zero' | 'positive' | 'high' | 'active' | 'disabled'

const props = withDefaults(defineProps<{
  label: string
  value: number | string
  variant?: Variant
  size?: Size
  mod?: number
  base?: number | string
  dice?: string
  editable?: boolean
  editing?: boolean
  state?: State
  hasPopover?: boolean
  rollHint?: string
}>(), {
  variant: 'default',
  size: 'base',
  state: 'default',
})

const model = defineModel<number>('value', { required: false })

const emit = defineEmits<{
  (e: 'toggleEdit'): void
  (e: 'open', open: boolean): void
}>()

const modClass = computed(() => {
  if (props.mod === undefined || props.mod === 0) return null
  return props.mod > 0 ? 'is-buff' : 'is-debuff'
})
const valueClass = computed(() => {
  if (!props.mod) return null
  return props.mod > 0 ? 'is-buffed' : 'is-debuffed'
})
function fmtMod(m: number): string {
  return m > 0 ? `+${m}` : `${m}`
}
</script>

<template>
  <PopoverRoot v-if="hasPopover" @update:open="emit('open', $event)">
    <PopoverTrigger as-child>
      <button
        type="button"
        :class="[
          'stat-chip',
          variant === 'row' ? 'v-row' : variant === 'hero' ? 'v-hero' : variant === 'minimal' ? 'v-minimal' : '',
          size === 'sm' ? 'sc-sm' : size === 'lg' ? 'sc-lg' : '',
          `is-${state}`,
          { 'has-mod': mod !== undefined && mod !== 0, 'is-editing': editing },
          valueClass,
        ]"
        :data-editable="editable ? 'true' : undefined"
        :disabled="state === 'disabled'"
      >
        <span class="sc-label">{{ label }}</span>
        <span v-if="!editing" class="sc-value">{{ value }}</span>
        <Stepper
          v-else
          v-model="(model as number)"
          size="base"
          :aria-label="`Правка ${label}`"
        />
        <span v-if="dice && !editing" class="sc-dice">{{ dice }}</span>
        <span v-if="base !== undefined && !editing" class="sc-base">
          база <s>{{ base }}</s>
        </span>
        <span v-if="mod !== undefined && mod !== 0" :class="['sc-mod', modClass]">
          {{ fmtMod(mod) }}
        </span>
        <span v-if="variant === 'hero' && rollHint" class="sc-roll-hint">{{ rollHint }}</span>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="stat-popover"
        :side-offset="8"
        side="right"
        align="start"
      >
        <slot name="popover" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>

  <button
    v-else
    type="button"
    :class="[
      'stat-chip',
      variant === 'row' ? 'v-row' : variant === 'hero' ? 'v-hero' : variant === 'minimal' ? 'v-minimal' : '',
      size === 'sm' ? 'sc-sm' : size === 'lg' ? 'sc-lg' : '',
      `is-${state}`,
      { 'has-mod': mod !== undefined && mod !== 0, 'is-editing': editing },
      valueClass,
    ]"
    :data-editable="editable ? 'true' : undefined"
    :disabled="state === 'disabled'"
    @click="editable && emit('toggleEdit')"
  >
    <span class="sc-label">{{ label }}</span>
    <span v-if="!editing" class="sc-value">{{ value }}</span>
    <Stepper
      v-else
      v-model="(model as number)"
      size="base"
      :aria-label="`Правка ${label}`"
    />
    <span v-if="dice && !editing" class="sc-dice">{{ dice }}</span>
    <span v-if="base !== undefined && !editing" class="sc-base">
      база <s>{{ base }}</s>
    </span>
    <span v-if="mod !== undefined && mod !== 0" :class="['sc-mod', modClass]">
      {{ fmtMod(mod) }}
    </span>
    <span v-if="variant === 'hero' && rollHint" class="sc-roll-hint">{{ rollHint }}</span>
  </button>
</template>

<style scoped>
.stat-chip {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 68px;
  padding: 10px 12px 8px;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-primary);
  cursor: pointer;
  transition:
    border-color var(--t-fast) var(--ease),
    background var(--t-fast) var(--ease),
    transform var(--t-fast) var(--ease);
  user-select: none;
  font-family: inherit;
}
.stat-chip:hover:not(:disabled) {
  border-color: var(--vtt-border-strong);
  background: var(--vtt-bg-elevated);
}
.stat-chip:active:not(:disabled) { transform: translateY(1px); }

.stat-chip .sc-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  line-height: 1;
}
.stat-chip .sc-value {
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 28px;
  color: var(--vtt-accent-soft);
  line-height: 1.1;
  letter-spacing: 0.01em;
}
.stat-chip .sc-dice {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--vtt-text-muted);
  line-height: 1;
  margin-top: 1px;
}

.stat-chip.is-zero .sc-value { color: var(--vtt-text-secondary); }
.stat-chip.is-positive .sc-value { color: var(--vtt-accent-soft); }
.stat-chip.is-high .sc-value { color: var(--vtt-accent); }

.stat-chip.is-active {
  border-color: var(--vtt-accent-deep);
  background: var(--vtt-bg-elevated);
  box-shadow: 0 0 0 3px rgba(212, 168, 87, 0.12);
}

.stat-chip.is-disabled { opacity: 0.4; cursor: not-allowed; }
.stat-chip.is-disabled:hover {
  border-color: var(--vtt-border-subtle);
  background: var(--vtt-bg-surface);
}

.stat-chip.sc-sm {
  min-width: 56px;
  padding: 6px 10px 5px;
}
.stat-chip.sc-sm .sc-value { font-size: 20px; }
.stat-chip.sc-sm .sc-dice { display: none; }

.stat-chip.sc-lg {
  min-width: 88px;
  padding: 14px 16px 12px;
  gap: 4px;
}
.stat-chip.sc-lg .sc-value { font-size: 40px; }
.stat-chip.sc-lg .sc-label { font-size: 11px; }

.stat-chip.v-minimal {
  background: transparent;
  border-color: transparent;
  padding: 6px 10px;
}
.stat-chip.v-minimal:hover {
  background: var(--vtt-bg-surface);
  border-color: transparent;
}

.stat-chip.v-row {
  flex-direction: row;
  gap: 10px;
  padding: 6px 12px;
  min-width: 0;
}
.stat-chip.v-row .sc-label { letter-spacing: 0.14em; }
.stat-chip.v-row .sc-value { font-size: 18px; }
.stat-chip.v-row .sc-dice { margin: 0; }

.stat-chip.v-hero {
  min-width: 96px;
  padding: 14px 16px 10px;
}
.stat-chip.v-hero .sc-value { font-size: 36px; }
.stat-chip.v-hero .sc-roll-hint {
  position: absolute;
  inset: auto 0 6px 0;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-accent);
  opacity: 0;
  transition: opacity var(--t-fast) var(--ease);
  pointer-events: none;
}
.stat-chip.v-hero:hover .sc-roll-hint { opacity: 1; }
.stat-chip.v-hero:hover .sc-dice { opacity: 0; }
.stat-chip.v-hero .sc-dice { transition: opacity var(--t-fast) var(--ease); }

.stat-chip.has-mod { border-color: var(--vtt-border-strong); }

.stat-chip .sc-mod {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  border-radius: var(--r-pill);
  background: var(--vtt-bg-base);
  border: 1px solid var(--vtt-border-strong);
  line-height: 1;
  pointer-events: none;
}
.stat-chip .sc-mod.is-buff {
  color: var(--vtt-success);
  border-color: rgba(107, 142, 78, 0.55);
  background: rgba(107, 142, 78, 0.12);
}
.stat-chip .sc-mod.is-debuff {
  color: var(--vtt-danger-bright);
  border-color: rgba(178, 59, 79, 0.55);
  background: rgba(58, 24, 32, 0.9);
}

.stat-chip .sc-base {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--vtt-text-muted);
  line-height: 1;
  margin-top: 1px;
}
.stat-chip .sc-base s {
  text-decoration: line-through;
  opacity: 0.85;
}

.stat-chip.has-mod.is-buffed .sc-value { color: var(--vtt-success); }
.stat-chip.has-mod.is-debuffed .sc-value { color: var(--vtt-danger-bright); }

.stat-chip.is-editing {
  padding: 8px 6px 6px;
  background: var(--vtt-bg-elevated);
  border-color: var(--vtt-accent-deep);
  box-shadow: 0 0 0 3px rgba(212, 168, 87, 0.15);
  cursor: default;
}
.stat-chip.is-editing .sc-dice { display: none; }

.stat-chip[data-editable="true"]:hover::after {
  content: "✎";
  position: absolute;
  top: 4px;
  right: 6px;
  font-size: 10px;
  color: var(--vtt-text-muted);
  opacity: 0.6;
  pointer-events: none;
}
</style>

<style>
/* Portal — глобальные стили для popover-контента */
.stat-popover {
  position: relative;
  display: inline-block;
  min-width: 280px;
  max-width: 320px;
  padding: 14px 16px 12px;
  background: rgba(36, 28, 21, 0.96);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  border: 1px solid var(--vtt-border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-2);
  color: var(--vtt-text-primary);
  z-index: 200;
  font-family: var(--font-sans);
  font-size: 13px;
}

.stat-popover .pop-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.stat-popover .pop-title {
  font-family: var(--font-serif);
  font-size: 17px;
  color: var(--vtt-accent-soft);
  font-weight: 500;
}
.stat-popover .pop-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}

.stat-popover .pop-hero {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
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
.stat-popover .pop-hero:hover { background: #BF9A4C; }

.stat-popover .pop-divider {
  height: 1px;
  margin: 12px -16px;
  background: linear-gradient(to right, transparent, var(--vtt-border-subtle), transparent);
}

.stat-popover .pop-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}
.stat-popover .pop-section-head .pop-sub { margin: 0; }

.stat-popover .pop-effect {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-top: 1px solid var(--vtt-border-subtle);
}
.stat-popover .pop-effect:first-of-type { border-top: 0; }
.stat-popover .pop-effect-delta {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 13px;
  min-width: 32px;
  text-align: center;
  padding: 2px 0;
  border-radius: var(--r-xs);
}
.stat-popover .pop-effect-delta.is-buff {
  color: var(--vtt-success);
  background: rgba(107, 142, 78, 0.1);
}
.stat-popover .pop-effect-delta.is-debuff {
  color: var(--vtt-danger-bright);
  background: rgba(178, 59, 79, 0.1);
}
.stat-popover .pop-effect-name {
  flex: 1;
  font-size: 13px;
  color: var(--vtt-text-primary);
  line-height: 1.2;
}
.stat-popover .pop-effect-meta {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--vtt-text-muted);
  margin-top: 1px;
  display: block;
}
.stat-popover .pop-effect-remove {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  color: var(--vtt-text-muted);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.stat-popover .pop-effect-remove:hover {
  color: var(--vtt-danger-bright);
  border-color: var(--vtt-danger);
}

.stat-popover .pop-empty {
  font-size: 12px;
  color: var(--vtt-text-muted);
  font-style: italic;
  padding: 4px 0 2px;
}

.stat-popover .pop-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.stat-popover .pop-btn {
  flex: 1;
  padding: 8px 10px;
  background: transparent;
  color: var(--vtt-text-secondary);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  line-height: 1;
}
.stat-popover .pop-btn:hover {
  color: var(--vtt-accent-soft);
  border-color: var(--vtt-border-strong);
}
</style>
