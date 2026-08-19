<script setup lang="ts">
import { computed, ref } from 'vue'
import { PopoverRoot, PopoverAnchor, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import BottomSheet from './BottomSheet.vue'
import XpControlsPanel from './XpControlsPanel.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { t } from '@/locales'

type Size = 'sm' | 'base' | 'lg'

const props = withDefaults(defineProps<{
  current: number
  max: number
  hint?: string
  size?: Size
  showControls?: boolean
  isReady?: boolean
  isCap?: boolean
  popoverTitle?: string
}>(), {
  size: 'base',
  showControls: true,
})

const resolvedPopoverTitle = computed(() => props.popoverTitle || t('xpControls.title'))

const model = defineModel<number>('current', { required: false })

const emit = defineEmits<{
  (e: 'levelUp'): void
  (e: 'update:current', value: number): void
}>()

const isMobile = useIsMobile()

const state = computed(() => {
  if (props.isCap) return 'cap'
  if (props.isReady) return 'ready'
  if (props.max <= 0) return 'growing'
  const ratio = props.current / props.max
  if (ratio >= 0.8) return 'close'
  return 'growing'
})
const fillPct = computed(() => {
  if (props.max <= 0) return 0
  return Math.min(100, Math.max(0, (props.current / props.max) * 100))
})

const open = ref(false)

function setCurrent(v: number) {
  const clamped = Math.max(0, Math.floor(v))
  if (model.value !== undefined) model.value = clamped
  else emit('update:current', clamped)
}
</script>

<template>
  <div
    :class="[
      'xp-bar',
      `state-${state}`,
      size === 'sm' ? 'xp-sm' : size === 'lg' ? 'xp-lg' : '',
    ]"
  >
    <span
      :class="['xp-bar-label', { 'is-clickable': showControls }]"
      :role="showControls ? 'button' : undefined"
      :tabindex="showControls ? 0 : undefined"
      @click="showControls && (open = true)"
      @keydown.enter.prevent="showControls && (open = true)"
      @keydown.space.prevent="showControls && (open = true)"
    >XP</span>

    <PopoverRoot v-if="showControls && !isMobile" :open="open" @update:open="(v) => (open = v)">
      <PopoverAnchor as-child>
        <span
          class="xp-bar-values is-clickable"
          role="button"
          tabindex="0"
          :aria-label="t('ui.xpBar.editAria')"
          @click="open = true"
          @keydown.enter.prevent="open = true"
          @keydown.space.prevent="open = true"
        >
          <span class="xp-current">{{ current }}</span>
          <span class="xp-sep">/</span>
          <span class="xp-max">{{ max }}</span>
          <span v-if="state === 'ready'" class="xp-ready-dot" />
        </span>
      </PopoverAnchor>
      <PopoverTrigger as-child>
        <button type="button" class="xp-bar-trigger">
          <span v-if="hint" class="xp-bar-hint">{{ hint }}</span>
          <span v-else class="xp-bar-hint">+</span>
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent class="xp-popover" :side-offset="10" align="end" :avoid-collisions="true" :collision-padding="12">
          <XpControlsPanel
            :current="current"
            :max="max"
            :is-ready="isReady"
            :popover-title="popoverTitle"
            :show-header="true"
            @update:current="(v) => setCurrent(v)"
            @level-up="emit('levelUp')"
          />
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
    <span
      v-else-if="showControls"
      class="xp-bar-values is-clickable"
      role="button"
      tabindex="0"
      :aria-label="t('ui.xpBar.editAria')"
      @click="open = true"
      @keydown.enter.prevent="open = true"
      @keydown.space.prevent="open = true"
    >
      <span class="xp-current">{{ current }}</span>
      <span class="xp-sep">/</span>
      <span class="xp-max">{{ max }}</span>
      <span v-if="state === 'ready'" class="xp-ready-dot" />
    </span>
    <button
      v-if="showControls && isMobile"
      type="button"
      class="xp-bar-trigger"
      @click="open = true"
    >
      <span v-if="hint" class="xp-bar-hint">{{ hint }}</span>
      <span v-else class="xp-bar-hint">+</span>
    </button>
    <span v-if="!showControls" class="xp-bar-values">
      <span class="xp-current">{{ current }}</span>
      <span class="xp-sep">/</span>
      <span class="xp-max">{{ max }}</span>
      <span v-if="state === 'ready'" class="xp-ready-dot" />
    </span>
    <span v-if="!showControls && hint" class="xp-bar-hint">{{ hint }}</span>

    <div
      class="xp-bar-track-wrap"
      :class="{ 'is-clickable': showControls }"
      :role="showControls ? 'button' : undefined"
      :tabindex="showControls ? 0 : undefined"
      :aria-label="showControls ? t('ui.xpBar.editAria') : undefined"
      @click="showControls && (open = true)"
      @keydown.enter.prevent="showControls && (open = true)"
      @keydown.space.prevent="showControls && (open = true)"
    >
      <div class="xp-bar-track">
        <div class="xp-bar-fill" :style="{ width: `${fillPct}%` }" />
        <div class="xp-bar-ticks" />
      </div>
    </div>
  </div>

  <BottomSheet v-if="showControls && isMobile" v-model:open="open" :title="resolvedPopoverTitle">
    <div class="xp-popover xp-popover--sheet">
      <XpControlsPanel
        :current="current"
        :max="max"
        :is-ready="isReady"
        :popover-title="popoverTitle"
        :show-header="false"
        @update:current="(v) => setCurrent(v)"
        @level-up="emit('levelUp'); open = false"
      />
    </div>
  </BottomSheet>
</template>

<style scoped>
.xp-bar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  column-gap: 12px;
  row-gap: 6px;
  min-width: 240px;
}

.xp-bar-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  line-height: 1;
}

.xp-bar-values {
  font-family: var(--font-serif);
  font-size: 16px;
  color: var(--vtt-text-secondary);
  line-height: 1;
  white-space: nowrap;
  letter-spacing: 0.02em;
}
.xp-bar-label.is-clickable,
.xp-bar-values.is-clickable {
  cursor: pointer;
  user-select: none;
  outline: none;
  border-radius: var(--r-xs);
  transition: filter var(--t-fast) var(--ease);
}
.xp-bar-label.is-clickable:hover,
.xp-bar-values.is-clickable:hover { filter: brightness(1.2); }
.xp-bar-label.is-clickable:focus-visible,
.xp-bar-values.is-clickable:focus-visible { box-shadow: 0 0 0 2px var(--vtt-border-strong); }
.xp-bar-track-wrap.is-clickable {
  cursor: pointer;
  outline: none;
}
.xp-bar-track-wrap.is-clickable:focus-visible .xp-bar-track {
  box-shadow: var(--shadow-inset), 0 0 0 2px var(--vtt-border-strong);
}
.xp-bar-values .xp-current { color: var(--vtt-accent-soft); font-weight: 500; }
.xp-bar-values .xp-sep { color: var(--vtt-text-muted); margin: 0 2px; }
.xp-bar-values .xp-max { color: var(--vtt-text-muted); }

.xp-bar-track-wrap {
  grid-column: 1 / 4;
  grid-row: 2;
  position: relative;
  height: 4px;
}
.xp-bar-track {
  position: absolute;
  inset: 0;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  overflow: hidden;
  box-shadow: var(--shadow-inset);
}
.xp-bar-fill {
  height: 100%;
  background: linear-gradient(to right, var(--vtt-accent-deep), var(--vtt-accent));
  border-radius: var(--r-pill);
  transition: width var(--t-med) var(--ease);
}
.xp-bar-ticks {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to right,
    transparent 0,
    transparent calc(25% - 1px),
    rgba(14, 11, 8, 0.8) calc(25% - 1px),
    rgba(14, 11, 8, 0.8) 25%
  );
  opacity: 0.55;
  border-radius: var(--r-pill);
}

.xp-bar-hint {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  line-height: 1;
  white-space: nowrap;
}
.xp-bar-trigger {
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: inherit;
}

.xp-bar.state-growing .xp-bar-fill {
  background: linear-gradient(to right, var(--vtt-accent-deep), var(--vtt-accent));
}
.xp-bar.state-close .xp-bar-fill {
  background: linear-gradient(to right, var(--vtt-accent-deep), var(--vtt-accent-soft));
}
.xp-bar.state-close .xp-bar-hint { color: var(--vtt-accent-deep); }
.xp-bar.state-ready .xp-bar-fill {
  background: linear-gradient(to right, var(--vtt-accent), var(--vtt-accent-soft));
  animation: xp-pulse 2s ease-in-out infinite;
}
.xp-bar.state-ready .xp-bar-hint {
  color: var(--vtt-accent);
  font-weight: 600;
}
.xp-bar.state-cap .xp-bar-fill {
  background: linear-gradient(to right, var(--vtt-accent-deep), var(--vtt-accent-deep));
  opacity: 0.6;
}
.xp-bar.state-cap .xp-bar-hint { color: var(--vtt-text-muted); }

@keyframes xp-pulse {
  0%, 100% { filter: brightness(1); box-shadow: none; }
  50% { filter: brightness(1.2) drop-shadow(0 0 6px rgba(212, 168, 87, 0.6)); }
}

.xp-ready-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: var(--r-pill);
  background: var(--vtt-accent);
  box-shadow: 0 0 6px rgba(212, 168, 87, 0.8);
  margin-left: 6px;
  vertical-align: middle;
  animation: xp-dot-pulse 1.6s ease-in-out infinite;
}
@keyframes xp-dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.xp-bar.xp-sm { gap: 8px; row-gap: 4px; min-width: 140px; }
.xp-bar.xp-sm .xp-bar-track-wrap { height: 3px; }
.xp-bar.xp-sm .xp-bar-values { font-size: 13px; }
.xp-bar.xp-sm .xp-bar-hint { display: none; }

.xp-bar.xp-lg { gap: 14px; row-gap: 8px; min-width: 320px; }
.xp-bar.xp-lg .xp-bar-track-wrap { height: 6px; }
.xp-bar.xp-lg .xp-bar-values { font-size: 20px; }
</style>

<style>
.xp-popover {
  width: 340px;
  min-width: 0;
  max-width: 360px;
  background: rgba(26, 21, 16, 0.88);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  border: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-2);
  padding: 16px 18px;
  font-family: var(--font-sans);
  color: var(--vtt-text-primary);
  text-align: left;
  z-index: 200;
}
.xp-popover.xp-popover--sheet {
  width: auto;
  max-width: none;
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.xp-popover .xp-pop-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--vtt-border-subtle);
}
.xp-popover .xp-pop-head-title {
  font-family: var(--font-serif);
  font-size: 18px;
  color: var(--vtt-accent-soft);
  letter-spacing: 0.01em;
}
.xp-popover .xp-pop-head-meta {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}

.xp-popover .xp-pop-steps {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 6px;
  margin-bottom: 14px;
}
.xp-popover .xp-step-btn {
  height: 34px;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
.xp-popover .xp-step-btn:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
  background: var(--vtt-bg-elevated);
}
.xp-popover .xp-step-btn.is-minus:hover {
  border-color: var(--vtt-danger);
  color: var(--vtt-danger-bright);
}
.xp-popover .xp-step-btn.is-plus:hover {
  border-color: var(--vtt-success);
  color: var(--vtt-success);
}

.xp-popover .xp-pop-manual {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid var(--vtt-border-subtle);
  border-bottom: 1px solid var(--vtt-border-subtle);
  margin-bottom: 14px;
}
.xp-popover .xp-pop-manual-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.xp-popover .xp-pop-manual input {
  width: 100%;
  min-width: 0;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  color: var(--vtt-accent-soft);
  font-family: var(--font-serif);
  font-size: 18px;
  text-align: center;
  padding: 6px 10px;
  outline: none;
  transition: border-color var(--t-fast) var(--ease);
}
.xp-popover .xp-pop-manual input:focus { border-color: var(--vtt-border-gold); }
.xp-popover .xp-pop-manual input::-webkit-outer-spin-button,
.xp-popover .xp-pop-manual input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.xp-popover .xp-pop-manual input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}
.xp-popover .xp-pop-manual-total {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-text-muted);
  white-space: nowrap;
}

.xp-popover .xp-pop-levelup {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(212, 168, 87, 0.08);
  border: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-sm);
}
.xp-popover .xp-pop-levelup-text {
  flex: 1;
  font-size: 13px;
  color: var(--vtt-accent-soft);
  line-height: 1.35;
}
.xp-popover .xp-pop-levelup-text b {
  color: var(--vtt-accent);
  font-weight: 600;
}
.xp-popover .xp-pop-levelup-btn {
  padding: 10px 20px;
  background: #A6833E;
  border: 1px solid #8C6A3A;
  border-radius: var(--r-pill);
  color: #1a1205;
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.02em;
  line-height: 1;
  cursor: pointer;
  filter: drop-shadow(0 0 10px rgba(140, 106, 58, 0.35));
  transition:
    background var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease),
    filter var(--t-fast) var(--ease);
  white-space: nowrap;
}
.xp-popover .xp-pop-levelup-btn:hover {
  background: #BF9A4C;
  border-color: #A6833E;
  filter: drop-shadow(0 0 14px rgba(140, 106, 58, 0.5));
}
.xp-popover .xp-pop-levelup.is-locked {
  background: transparent;
  border-color: var(--vtt-border-subtle);
}
.xp-popover .xp-pop-levelup.is-locked .xp-pop-levelup-text {
  color: var(--vtt-text-muted);
}
.xp-popover .xp-pop-levelup.is-locked .xp-pop-levelup-btn {
  background: transparent;
  border-color: var(--vtt-border-subtle);
  color: var(--vtt-text-muted);
  cursor: not-allowed;
  box-shadow: none;
  filter: none;
}
</style>
