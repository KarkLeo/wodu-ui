<script setup lang="ts">
import { computed, ref } from 'vue'
import { PopoverRoot, PopoverAnchor, PopoverPortal, PopoverContent } from 'reka-ui'
import BottomSheet from './BottomSheet.vue'
import HpControlsPanel from './HpControlsPanel.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { t } from '@/locales'

type Size = 'sm' | 'base' | 'lg'
type EffectKind = 'dot' | 'hot' | 'warn'
interface HpEffect { label: string; kind: EffectKind; meta?: string }

const props = withDefaults(defineProps<{
  current: number
  max: number
  temp?: number
  effects?: HpEffect[]
  size?: Size
  showControls?: boolean
  label?: string
  characterId?: string
  characterName?: string
}>(), {
  size: 'base',
  showControls: true,
  label: 'HP',
})

defineEmits<{
  (e: 'applyDamage', amount: number): void
  (e: 'heal', amount: number): void
  (e: 'addTemp', amount: number): void
}>()

const isMobile = useIsMobile()
const editLabel = computed(() => {
  const value = `${Math.max(0, props.current)}/${props.max}${props.temp && props.temp > 0 ? `+${props.temp}` : ''}`
  return t('ui.hpBar.editAria', { value })
})
const open = ref(false)

const state = computed(() => {
  if (props.max <= 0) return 'zero'
  if (props.current <= 0) return 'zero'
  const ratio = props.current / props.max
  if (ratio >= 1) return 'full'
  if (ratio > 0.66) return 'healthy'
  if (ratio > 0.33) return 'wounded'
  return 'critical'
})
const fillPct = computed(() => {
  if (props.max <= 0) return 0
  return Math.min(100, Math.max(0, (props.current / props.max) * 100))
})
const tempPct = computed(() => {
  if (!props.temp || props.max <= 0) return 0
  return Math.min(100, Math.max(0, (props.temp / props.max) * 100))
})
</script>

<template>
  <div
    :class="[
      'hp-bar',
      `state-${state}`,
      size === 'sm' ? 'hp-sm' : size === 'lg' ? 'hp-lg' : '',
    ]"
  >
    <span class="hp-bar-label">{{ label }}</span>

    <PopoverRoot v-if="showControls && !isMobile" :open="open" @update:open="(v) => (open = v)">
      <PopoverAnchor as-child>
        <span
          class="hp-bar-values is-clickable"
          role="button"
          tabindex="0"
          :aria-label="editLabel"
          @click="open = true"
          @keydown.enter.prevent="open = true"
          @keydown.space.prevent="open = true"
        >
          <span class="hp-current">{{ Math.max(0, current) }}</span>
          <span class="hp-sep">/</span>
          <span class="hp-max">{{ max }}</span>
          <span v-if="temp && temp > 0" class="hp-temp-suffix">+{{ temp }}</span>
        </span>
      </PopoverAnchor>
      <PopoverPortal>
        <PopoverContent class="hp-popover" :side-offset="10" align="end" :avoid-collisions="true" :collision-padding="12">
          <HpControlsPanel
            :current="current"
            :max="max"
            :temp="temp"
            :show-header="true"
            :character-id="characterId"
            :character-name="characterName"
            @apply-damage="(v) => $emit('applyDamage', v)"
            @heal="(v) => $emit('heal', v)"
            @add-temp="(v) => $emit('addTemp', v)"
          />
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
    <span
      v-else-if="showControls"
      class="hp-bar-values is-clickable"
      role="button"
      tabindex="0"
      :aria-label="editLabel"
      @click="open = true"
      @keydown.enter.prevent="open = true"
      @keydown.space.prevent="open = true"
    >
      <span class="hp-current">{{ Math.max(0, current) }}</span>
      <span class="hp-sep">/</span>
      <span class="hp-max">{{ max }}</span>
      <span v-if="temp && temp > 0" class="hp-temp-suffix">+{{ temp }}</span>
    </span>
    <span v-else class="hp-bar-values">
      <span class="hp-current">{{ Math.max(0, current) }}</span>
      <span class="hp-sep">/</span>
      <span class="hp-max">{{ max }}</span>
      <span v-if="temp && temp > 0" class="hp-temp-suffix">+{{ temp }}</span>
    </span>

    <button
      v-if="showControls"
      type="button"
      class="hp-bar-btn is-damage"
      :aria-label="t('ui.hpBar.decreaseAria')"
      @click="$emit('applyDamage', 1)"
    >−</button>

    <button
      v-if="showControls"
      type="button"
      class="hp-bar-btn is-heal"
      :aria-label="t('ui.hpBar.healAria')"
      @click="$emit('heal', 1)"
    >+</button>

    <div
      class="hp-bar-track-wrap"
      :class="{ 'is-clickable': showControls }"
      @click="showControls && (open = true)"
    >
      <div class="hp-bar-track">
        <div class="hp-bar-fill" :style="{ width: `${fillPct}%` }" />
        <div v-if="temp && temp > 0" class="hp-bar-temp" :style="{ left: `${fillPct}%`, width: `${tempPct}%` }" />
      </div>
    </div>

    <div v-if="effects && effects.length" class="hp-effects" style="grid-column: 1 / 5; grid-row: 3;">
      <span
        v-for="(ef, idx) in effects"
        :key="idx"
        :class="['hp-effect-chip', `is-${ef.kind}`]"
      >
        {{ ef.label }}<span v-if="ef.meta" class="chip-meta"> · {{ ef.meta }}</span>
      </span>
    </div>
  </div>

  <BottomSheet v-if="showControls && isMobile" v-model:open="open" :title="t('hpControls.title')">
    <div class="hp-popover hp-popover--sheet">
      <HpControlsPanel
        :current="current"
        :max="max"
        :temp="temp"
        :show-header="false"
        :character-id="characterId"
        :character-name="characterName"
        @apply-damage="(v) => $emit('applyDamage', v)"
        @heal="(v) => $emit('heal', v)"
        @add-temp="(v) => $emit('addTemp', v)"
        @submitted="open = false"
      />
    </div>
  </BottomSheet>
</template>

<style scoped>
.hp-bar {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 12px;
  min-width: 240px;
}

.hp-bar-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  line-height: 1;
}

.hp-bar-track-wrap {
  grid-column: 1 / 5;
  grid-row: 2;
  position: relative;
  height: 8px;
}
.hp-bar-track {
  position: absolute;
  inset: 0;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  overflow: hidden;
  box-shadow: var(--shadow-inset);
}
.hp-bar-fill {
  height: 100%;
  background: linear-gradient(to right, var(--vtt-danger), var(--vtt-danger-bright));
  border-radius: var(--r-pill);
  transition:
    width var(--t-med) var(--ease),
    background var(--t-med) var(--ease);
}
.hp-bar-temp {
  position: absolute;
  top: 0;
  height: 100%;
  background: linear-gradient(to right, rgba(212, 168, 87, 0.75), rgba(228, 201, 160, 0.85));
  border-radius: var(--r-pill);
  box-shadow: 0 0 8px rgba(212, 168, 87, 0.4);
  transition: width var(--t-med) var(--ease);
}

.hp-bar-values {
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 22px;
  color: var(--vtt-accent-soft);
  line-height: 1;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.hp-bar-values.is-clickable {
  cursor: pointer;
  user-select: none;
  border-radius: var(--r-xs);
  transition: filter var(--t-fast) var(--ease);
}
.hp-bar-values.is-clickable:hover { filter: brightness(1.15); }
.hp-bar-track-wrap.is-clickable { cursor: pointer; }
.hp-bar-values .hp-current { font-weight: 600; }
.hp-bar-values .hp-max { color: var(--vtt-text-secondary); font-weight: 400; }
.hp-bar-values .hp-sep { color: var(--vtt-text-muted); margin: 0 2px; }
.hp-bar-values .hp-temp-suffix {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--vtt-accent);
  margin-left: 6px;
}

.hp-bar-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  color: var(--vtt-text-secondary);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
.hp-bar-btn:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
  background: var(--vtt-bg-elevated);
}
.hp-bar-btn.is-damage:hover { border-color: var(--vtt-danger); color: var(--vtt-danger-bright); }
.hp-bar-btn.is-heal:hover { border-color: var(--vtt-success); color: var(--vtt-success); }

.hp-bar.state-full .hp-bar-fill {
  background: linear-gradient(to right, var(--vtt-success), #8FAF68);
}
.hp-bar.state-healthy .hp-bar-fill {
  background: linear-gradient(to right, var(--vtt-accent-deep), var(--vtt-accent));
}
.hp-bar.state-wounded .hp-bar-fill {
  background: linear-gradient(to right, var(--vtt-warning), #D9A45C);
}
.hp-bar.state-critical .hp-bar-fill {
  background: linear-gradient(to right, var(--vtt-danger), var(--vtt-danger-bright));
  animation: hp-pulse 1.8s ease-in-out infinite;
}
.hp-bar.state-zero .hp-bar-fill { background: var(--vtt-bg-elevated); }
.hp-bar.state-zero .hp-bar-values .hp-current { color: var(--vtt-danger-bright); }

@keyframes hp-pulse {
  0%, 100% { filter: brightness(0.9); }
  50% { filter: brightness(1.2) drop-shadow(0 0 6px rgba(178, 59, 79, 0.5)); }
}

.hp-bar.hp-sm { gap: 8px; min-width: 160px; }
.hp-bar.hp-sm .hp-bar-track-wrap { height: 5px; }
.hp-bar.hp-sm .hp-bar-values { font-size: 14px; }
.hp-bar.hp-sm .hp-bar-btn { display: none; }

.hp-bar.hp-lg { gap: 14px; min-width: 320px; }
.hp-bar.hp-lg .hp-bar-track-wrap { height: 12px; }
.hp-bar.hp-lg .hp-bar-values { font-size: 34px; }
.hp-bar.hp-lg .hp-bar-btn { width: 36px; height: 36px; font-size: 18px; }

.hp-effects {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 2px;
}
.hp-effect-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  border-radius: var(--r-pill);
  background: rgba(26, 21, 16, 0.7);
  border: 1px solid var(--vtt-border-subtle);
  color: var(--vtt-text-secondary);
}
.hp-effect-chip::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.hp-effect-chip.is-dot { color: var(--vtt-danger-bright); border-color: rgba(178, 59, 79, 0.35); }
.hp-effect-chip.is-hot { color: var(--vtt-success); border-color: rgba(107, 142, 78, 0.35); }
.hp-effect-chip.is-warn { color: var(--vtt-warning); border-color: rgba(192, 138, 62, 0.35); }
.hp-effect-chip .chip-meta {
  color: var(--vtt-text-muted);
  font-weight: 400;
}
</style>

<style>
.hp-popover {
  position: relative;
  width: 320px;
  min-width: 0;
  max-width: 340px;
  padding: 14px 16px;
  background: rgba(36, 28, 21, 0.96);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  backdrop-filter: blur(14px) saturate(1.2);
  border: 1px solid var(--vtt-border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-2);
  z-index: 200;
  font-family: var(--font-sans);
  color: var(--vtt-text-primary);
}
.hp-popover.hp-popover--sheet {
  width: auto;
  max-width: none;
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
</style>
