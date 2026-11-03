<script setup lang="ts">
import { useId } from 'vue'
import { t } from '@/locales'
import Button from './Button.vue'
import Stepper from './Stepper.vue'

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
</script>

<template>
  <div>
    <div v-if="showHeader" class="xp-pop-head">
      <span class="xp-pop-head-title">{{ popoverTitle || t('xpControls.title') }}</span>
      <span class="xp-pop-head-meta">{{ current }} / {{ max }}</span>
    </div>

    <div class="xp-pop-steps">
      <Button size="sm" class="xp-step-btn" @click="step(-100)">−100</Button>
      <Button size="sm" class="xp-step-btn" @click="step(-10)">−10</Button>
      <Button size="sm" class="xp-step-btn" @click="step(10)">+10</Button>
      <Button size="sm" class="xp-step-btn" @click="step(100)">+100</Button>
    </div>

    <div class="xp-pop-manual">
      <span :id="inputLabelId" class="xp-pop-manual-label">{{ t('xpControls.inputLabel') }}</span>
      <!-- No max: experience may go past the next level's threshold. -->
      <Stepper
        class="xp-pop-manual-field"
        :model-value="current"
        :min="0"
        :labelledby="inputLabelId"
        lazy
        hide-buttons
        @update:model-value="setCurrent"
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
      <Button
        :variant="isReady ? 'hero' : 'ghost'"
        :disabled="!isReady"
        @click="isReady && emit('levelUp')"
      >{{ t('xpControls.levelUpBtn') }}</Button>
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
.xp-step-btn { justify-content: center; }

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
.xp-pop-manual-field {
  --stepper-field-width: 100%;
  display: flex;
  min-width: 0;
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
.xp-pop-levelup.is-locked {
  background: transparent;
  border-color: var(--vtt-border-subtle);
}
.xp-pop-levelup.is-locked .xp-pop-levelup-text {
  color: var(--vtt-text-muted);
}
</style>
