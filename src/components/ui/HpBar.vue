<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'

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
}>(), {
  size: 'base',
  showControls: true,
  label: 'HP',
})

const emit = defineEmits<{
  (e: 'applyDamage', amount: number): void
  (e: 'heal', amount: number): void
  (e: 'addTemp', amount: number): void
  (e: 'rollDice', formula: string): void
}>()

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

const tab = ref<'damage' | 'heal' | 'temp'>('damage')
const amount = ref<number>(0)

function onDice(formula: string, rolled: number) {
  amount.value = rolled
  emit('rollDice', formula)
}

watch(tab, () => { amount.value = 0 })

const submitClass = computed(() => `is-${tab.value}`)
const submitLabel = computed(() => {
  if (tab.value === 'damage') return 'Нанести урон'
  if (tab.value === 'heal') return 'Восстановить'
  return 'Добавить'
})
function submit() {
  const v = Math.max(0, Math.floor(amount.value || 0))
  if (v <= 0) return
  if (tab.value === 'damage') emit('applyDamage', v)
  else if (tab.value === 'heal') emit('heal', v)
  else emit('addTemp', v)
  amount.value = 0
}

const previewResult = computed(() => {
  const v = amount.value || 0
  if (tab.value === 'damage') {
    const next = Math.max(0, props.current - v)
    return { nextValue: next, delta: -v, tempNext: props.temp ?? 0 }
  }
  if (tab.value === 'heal') {
    const next = Math.min(props.max, props.current + v)
    return { nextValue: next, delta: +v, tempNext: props.temp ?? 0 }
  }
  return { nextValue: props.current, delta: 0, tempNext: (props.temp ?? 0) + v }
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
    <span class="hp-bar-values">
      <span class="hp-current">{{ Math.max(0, current) }}</span>
      <span class="hp-sep">/</span>
      <span class="hp-max">{{ max }}</span>
      <span v-if="temp && temp > 0" class="hp-temp-suffix">+{{ temp }}</span>
    </span>

    <PopoverRoot v-if="showControls">
      <PopoverTrigger as-child>
        <button type="button" class="hp-bar-btn is-damage" aria-label="Изменить HP">−</button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent class="hp-popover" :side-offset="10" align="end">
          <div class="hp-pop-head">
            <span class="hp-pop-title">HP</span>
            <span class="hp-pop-sub">{{ current }} / {{ max }}</span>
          </div>
          <div class="hp-pop-tabs">
            <button
              type="button"
              :class="['tab-damage', { active: tab === 'damage' }]"
              @click="tab = 'damage'"
            >Урон</button>
            <button
              type="button"
              :class="['tab-heal', { active: tab === 'heal' }]"
              @click="tab = 'heal'"
            >Лечение</button>
            <button
              type="button"
              :class="[{ active: tab === 'temp' }]"
              @click="tab = 'temp'"
            >Временное</button>
          </div>

          <div class="hp-amount">
            <button type="button" @click="amount = Math.max(0, amount - 1)">−</button>
            <input
              type="number"
              min="0"
              :class="[tab === 'heal' ? 'is-heal' : tab === 'temp' ? 'is-temp' : '']"
              :value="amount"
              @input="(e) => { const v = Number((e.target as HTMLInputElement).value); amount = Number.isNaN(v) ? 0 : v }"
            />
            <button type="button" @click="amount = amount + 1">+</button>
          </div>

          <div class="hp-dice-quick">
            <button type="button" @click="onDice('d6', 1 + Math.floor(Math.random() * 6))">d6</button>
            <button type="button" @click="onDice('2d6', (1 + Math.floor(Math.random() * 6)) + (1 + Math.floor(Math.random() * 6)))">2d6</button>
            <button type="button" @click="onDice('d8', 1 + Math.floor(Math.random() * 8))">d8</button>
          </div>

          <div class="hp-pop-preview">
            <template v-if="tab === 'damage'">
              <b>{{ current }}</b>
              <span class="delta-neg"> −{{ amount || 0 }}</span>
              =
              <b>{{ previewResult.nextValue }}</b>
              / {{ max }}
            </template>
            <template v-else-if="tab === 'heal'">
              <b>{{ current }}</b>
              <span class="delta-pos"> +{{ amount || 0 }}</span>
              =
              <b>{{ previewResult.nextValue }}</b>
              / {{ max }}
            </template>
            <template v-else>
              Временно:
              <b>{{ temp || 0 }}</b>
              <span class="delta-pos"> +{{ amount || 0 }}</span>
              =
              <b>{{ previewResult.tempNext }}</b>
            </template>
          </div>

          <button
            type="button"
            :class="['hp-pop-submit', submitClass]"
            :disabled="amount <= 0"
            @click="submit"
          >{{ submitLabel }}</button>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>

    <button
      v-if="showControls"
      type="button"
      class="hp-bar-btn is-heal"
      aria-label="Восстановить HP"
      @click="$emit('heal', 1)"
    >+</button>

    <div class="hp-bar-track-wrap">
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
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  border: 1px solid var(--vtt-border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-2);
  z-index: 200;
  font-family: var(--font-sans);
  color: var(--vtt-text-primary);
}
.hp-popover .hp-pop-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}
.hp-popover .hp-pop-title {
  font-family: var(--font-serif);
  font-size: 16px;
  color: var(--vtt-accent-soft);
  font-weight: 500;
}
.hp-popover .hp-pop-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.hp-popover .hp-pop-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  padding: 3px;
  box-shadow: var(--shadow-inset);
  margin-bottom: 12px;
}
.hp-popover .hp-pop-tabs button {
  padding: 7px 8px;
  background: transparent;
  border: 0;
  color: var(--vtt-text-muted);
  font-family: var(--font-sans);
  font-size: 12px;
  cursor: pointer;
  border-radius: 2px;
  line-height: 1;
}
.hp-popover .hp-pop-tabs button.active {
  color: var(--vtt-accent-soft);
  background: var(--vtt-bg-elevated);
}
.hp-popover .hp-pop-tabs button.active.tab-damage { color: var(--vtt-danger-bright); }
.hp-popover .hp-pop-tabs button.active.tab-heal { color: var(--vtt-success); }

.hp-popover .hp-amount {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  gap: 10px;
  align-items: center;
  padding: 8px 0 12px;
}
.hp-popover .hp-amount button {
  width: 40px;
  height: 40px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  color: var(--vtt-text-secondary);
  font-family: var(--font-sans);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.hp-popover .hp-amount button:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}
.hp-popover .hp-amount input {
  width: 100%;
  min-width: 0;
  padding: 10px 0;
  text-align: center;
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 36px;
  color: var(--vtt-danger-bright);
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--vtt-border-subtle);
  outline: none;
  -moz-appearance: textfield;
}
.hp-popover .hp-amount input.is-heal { color: var(--vtt-success); }
.hp-popover .hp-amount input.is-temp { color: var(--vtt-accent); }
.hp-popover .hp-amount input::-webkit-outer-spin-button,
.hp-popover .hp-amount input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.hp-popover .hp-dice-quick {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  margin: 2px 0 10px;
}
.hp-popover .hp-dice-quick button {
  padding: 5px 10px;
  background: transparent;
  border: 1px dashed var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  color: var(--vtt-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}
.hp-popover .hp-dice-quick button:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent);
  border-style: solid;
}

.hp-popover .hp-pop-preview {
  padding: 10px 12px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  font-size: 12px;
  color: var(--vtt-text-secondary);
  margin-bottom: 10px;
  line-height: 1.5;
}
.hp-popover .hp-pop-preview b {
  color: var(--vtt-accent-soft);
  font-family: var(--font-serif);
  font-size: 14px;
}
.hp-popover .hp-pop-preview .delta-neg {
  color: var(--vtt-danger-bright);
  font-family: var(--font-mono);
  font-weight: 600;
}
.hp-popover .hp-pop-preview .delta-pos {
  color: var(--vtt-success);
  font-family: var(--font-mono);
  font-weight: 600;
}

.hp-popover .hp-pop-submit {
  width: 100%;
  padding: 10px 16px;
  border-radius: var(--r-pill);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  border: 1px solid;
  line-height: 1;
}
.hp-popover .hp-pop-submit:disabled { opacity: 0.45; cursor: not-allowed; }
.hp-popover .hp-pop-submit.is-damage {
  background: var(--vtt-danger);
  border-color: var(--vtt-danger);
  color: var(--vtt-text-primary);
}
.hp-popover .hp-pop-submit.is-damage:hover:not(:disabled) { background: var(--vtt-danger-bright); }
.hp-popover .hp-pop-submit.is-heal {
  background: var(--vtt-success);
  border-color: var(--vtt-success);
  color: #0E0B08;
}
.hp-popover .hp-pop-submit.is-heal:hover:not(:disabled) { filter: brightness(1.1); }
.hp-popover .hp-pop-submit.is-temp {
  background: #A6833E;
  border-color: #8C6A3A;
  color: #1a1205;
}
</style>
