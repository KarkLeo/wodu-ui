<script setup lang="ts">
import { t } from '@/locales'

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
      <span class="xp-pop-manual-label">{{ t('xpControls.inputLabel') }}</span>
      <input
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
