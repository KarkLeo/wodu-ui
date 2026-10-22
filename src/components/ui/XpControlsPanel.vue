<script setup lang="ts">
import { useId } from 'vue'
import { t } from '@/locales'

const inputLabelId = useId()

const props = defineProps<{
  current: number
  max: number
  isReady?: boolean
  popoverTitle?: string
  showHeader?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:current', value: number): void
  (e: 'levelUp'): void
}>()

function setCurrent(v: number) {
  emit('update:current', Math.max(0, Math.floor(v)))
}
function step(delta: number) { setCurrent(props.current + delta) }
function onInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (!Number.isNaN(v)) setCurrent(v)
}
</script>

<template>
  <div>
    <div v-if="showHeader" class="xp-pop-head">
      <span class="xp-pop-head-title">{{ popoverTitle || t('xpControls.title') }}</span>
      <span class="xp-pop-head-meta">{{ current }} / {{ max }}</span>
    </div>

    <div class="xp-pop-steps">
      <button type="button" class="xp-step-btn is-minus" @click="step(-100)">−100</button>
      <button type="button" class="xp-step-btn is-minus" @click="step(-10)">−10</button>
      <button type="button" class="xp-step-btn is-plus" @click="step(10)">+10</button>
      <button type="button" class="xp-step-btn is-plus" @click="step(100)">+100</button>
    </div>

    <div class="xp-pop-manual">
      <span :id="inputLabelId" class="xp-pop-manual-label">{{ t('xpControls.inputLabel') }}</span>
      <input
        :aria-labelledby="inputLabelId"
        type="number"
        :value="current"
        min="0"
        :max="max"
        @input="onInput"
      />
      <span class="xp-pop-manual-total">{{ t('xpControls.outOf', { max }) }}</span>
    </div>

    <div :class="['xp-pop-levelup', { 'is-locked': !isReady }]">
      <div class="xp-pop-levelup-text">
        <template v-if="isReady">
          {{ t('xpControls.readyPrefix') }} <b>{{ t('xpControls.readyEmphasis') }}</b>.
        </template>
        <template v-else>
          {{ t('xpControls.notReady') }}
        </template>
      </div>
      <button
        type="button"
        class="xp-pop-levelup-btn"
        :disabled="!isReady"
        @click="isReady && emit('levelUp')"
      >{{ t('xpControls.levelUpBtn') }}</button>
    </div>
  </div>
</template>

<style scoped>
.xp-pop-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--vtt-border-subtle);
}
.xp-pop-head-title {
  font-family: var(--font-serif);
  font-size: 18px;
  color: var(--vtt-accent-soft);
  letter-spacing: 0.01em;
}
.xp-pop-head-meta {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}

.xp-pop-steps {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 6px;
  margin-bottom: 14px;
}
.xp-step-btn {
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
.xp-step-btn:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
  background: var(--vtt-bg-elevated);
}
.xp-step-btn.is-minus:hover {
  border-color: var(--vtt-danger);
  color: var(--vtt-danger-bright);
}
.xp-step-btn.is-plus:hover {
  border-color: var(--vtt-success);
  color: var(--vtt-success);
}

.xp-pop-manual {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid var(--vtt-border-subtle);
  border-bottom: 1px solid var(--vtt-border-subtle);
  margin-bottom: 14px;
}
.xp-pop-manual-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.xp-pop-manual input {
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
.xp-pop-manual input:focus-visible { border-color: var(--vtt-accent); }
.xp-pop-manual input::-webkit-outer-spin-button,
.xp-pop-manual input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.xp-pop-manual input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}
.xp-pop-manual-total {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-text-muted);
  white-space: nowrap;
}

.xp-pop-levelup {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(212, 168, 87, 0.08);
  border: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-sm);
}
.xp-pop-levelup-text {
  flex: 1;
  font-size: 13px;
  color: var(--vtt-accent-soft);
  line-height: 1.35;
}
.xp-pop-levelup-text b {
  color: var(--vtt-accent);
  font-weight: 600;
}
.xp-pop-levelup-btn {
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
.xp-pop-levelup-btn:hover {
  background: #BF9A4C;
  border-color: #A6833E;
  filter: drop-shadow(0 0 14px rgba(140, 106, 58, 0.5));
}
.xp-pop-levelup.is-locked {
  background: transparent;
  border-color: var(--vtt-border-subtle);
}
.xp-pop-levelup.is-locked .xp-pop-levelup-text {
  color: var(--vtt-text-muted);
}
.xp-pop-levelup.is-locked .xp-pop-levelup-btn {
  background: transparent;
  border-color: var(--vtt-border-subtle);
  color: var(--vtt-text-muted);
  cursor: not-allowed;
  box-shadow: none;
  filter: none;
}
</style>
