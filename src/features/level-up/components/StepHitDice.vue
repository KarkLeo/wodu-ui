<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDiceRoller, isRolling } from '@/composables/useDiceRoller'
import { t } from '@/locales'

const props = defineProps<{
  numDice: number
  targetLevel: number
  characterId: string
  characterName?: string
  previousMaxHp: number
}>()
const emit = defineEmits<{ 'update:result': [total: number | null] }>()

const { roll } = useDiceRoller()
const rolls = ref<number[]>([])

const kept = computed(() => rolls.value.slice(0, props.targetLevel))
const discarded = computed(() => rolls.value.slice(props.targetLevel))
const total = computed(() => kept.value.reduce((a, b) => a + b, 0))
const newMaxHp = computed(() => Math.max(props.previousMaxHp, total.value))

async function doRoll() {
  const result = await roll({
    notation: `${props.numDice}d6`,
    label: t('levelUp.steps.hitDice.rollLabel', { dice: props.numDice, level: props.targetLevel }),
    purpose: {
      kind: 'hit-dice',
      fromLevel: props.targetLevel - 1,
      toLevel: props.targetLevel,
      numDice: props.numDice,
      kept: props.targetLevel,
    },
    characterId: props.characterId,
    characterName: props.characterName,
  })
  if (!result) return
  rolls.value = result.dice.map(d => d.value).sort((a, b) => b - a)
  emit('update:result', total.value)
}

const hintPost = computed(() => t('levelUp.steps.hitDice.hintPost', { vals: kept.value.join(' · ') }))
const captionPost = computed(() => {
  const keptStr = kept.value.join(' · ')
  const discStr = discarded.value.join(' · ')
  return discStr
    ? t('levelUp.steps.hitDice.captionPostBoth', { kept: keptStr, discarded: discStr })
    : t('levelUp.steps.hitDice.captionPostKeptOnly', { kept: keptStr })
})
</script>

<template>
  <div class="cc-section">
    <div class="cc-section-head">
      <span class="cc-section-label">{{ t('levelUp.steps.hitDice.label') }}</span>
      <span class="cc-section-hint">
        <template v-if="rolls.length">{{ hintPost }}</template>
        <template v-else>{{ t('levelUp.steps.hitDice.hintPre', { n: numDice, k: targetLevel }) }}</template>
      </span>
      <span class="cc-section-action">
        <button type="button" class="btn-roll" :disabled="isRolling" @click="doRoll">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
            <rect x="2" y="2" width="8" height="8" rx="1"/>
            <circle cx="4.5" cy="4.5" r="0.6" fill="currentColor"/>
            <circle cx="7.5" cy="4.5" r="0.6" fill="currentColor"/>
            <circle cx="6" cy="6" r="0.6" fill="currentColor"/>
            <circle cx="4.5" cy="7.5" r="0.6" fill="currentColor"/>
            <circle cx="7.5" cy="7.5" r="0.6" fill="currentColor"/>
          </svg>
          {{ rolls.length ? t('levelUp.steps.hitDice.reroll') : t('levelUp.steps.hitDice.roll') }}
        </button>
      </span>
    </div>

    <div class="lu-dice-scene">
      <div class="lu-dice-row">
        <template v-if="!rolls.length">
          <div v-for="i in numDice" :key="i" class="lu-die is-empty" :class="{ 'is-rolling': isRolling }">?</div>
        </template>
        <template v-else>
          <div
            v-for="(val, i) in rolls"
            :key="i"
            class="lu-die"
            :class="i < targetLevel ? 'is-kept' : 'is-discarded'"
          >{{ val }}</div>
        </template>
      </div>
      <div class="lu-dice-caption">
        <template v-if="!rolls.length">
          <span v-html="t('levelUp.steps.hitDice.captionPre', { n: numDice, k: targetLevel }).replace(/(\d+d\d+|\d+)/g, '<b>$1</b>')" />
        </template>
        <template v-else>
          <span v-html="captionPost.replace(/((?:\d+\s*·\s*)*\d+)/g, '<b>$1</b>')" />
        </template>
      </div>
    </div>

    <div v-if="rolls.length" class="lu-hp-result">
      <span class="lu-hp-result-value">{{ newMaxHp }}</span>
      <div class="lu-hp-result-body">
        <span class="lu-hp-result-label">{{ t('levelUp.steps.hitDice.resultLabel') }}</span>
        <span class="lu-hp-result-formula" v-html="t('levelUp.steps.hitDice.resultFormula', { old: previousMaxHp }).replace(/(\d+)/, '<em>$1</em>')" />
      </div>
    </div>
  </div>
</template>

<style scoped src="./stepShared.css"></style>

<style scoped>
.btn-roll {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 12px;
  background: rgba(36, 28, 21, 0.55);
  border: 1px solid rgba(140, 106, 58, 0.35);
  border-radius: var(--r-sm);
  color: var(--vtt-accent);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--t-fast) var(--ease);
}
.btn-roll:hover:not(:disabled) {
  background: rgba(140, 106, 58, 0.2);
  border-color: var(--vtt-border-gold);
}
.btn-roll:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-roll svg { width: 12px; height: 12px; }
.lu-dice-scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-4);
  padding: var(--s-5) 0;
}
.lu-dice-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.lu-die {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  background: var(--vtt-bg-elevated);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  box-shadow: var(--shadow-inset);
  transition: all var(--t-med) var(--ease);
  position: relative;
}
.lu-die::after {
  content: "d6";
  position: absolute;
  top: 3px;
  right: 5px;
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--vtt-text-muted);
  opacity: 0.55;
  letter-spacing: 0.08em;
}
.lu-die.is-empty {
  color: var(--vtt-text-muted);
  border-style: dashed;
  border-color: rgba(140, 106, 58, 0.25);
  background: transparent;
  box-shadow: none;
}
.lu-die.is-kept {
  background: var(--vtt-accent);
  border-color: var(--vtt-accent);
  color: var(--vtt-bg-base);
  box-shadow: 0 0 16px rgba(212, 168, 87, 0.24);
}
.lu-die.is-kept::after { color: var(--vtt-bg-base); opacity: 0.6; }
.lu-die.is-discarded { opacity: 0.35; }
.lu-die.is-discarded::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 8%;
  right: 8%;
  height: 1px;
  background: var(--vtt-text-muted);
  transform: rotate(-12deg);
  opacity: 0.6;
}
.lu-die.is-rolling { animation: lu-die-roll 520ms var(--ease) infinite alternate; }
.lu-dice-caption {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  text-align: center;
}
.lu-dice-caption :deep(b) { color: var(--vtt-accent-soft); font-weight: 500; }
.lu-hp-result {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  column-gap: var(--s-4);
  padding: 14px 18px;
  background: rgba(36, 28, 21, 0.45);
  border-radius: var(--r-md);
}
.lu-hp-result-value {
  font-family: var(--font-serif);
  font-size: 40px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
}
.lu-hp-result-body { display: flex; flex-direction: column; gap: 4px; }
.lu-hp-result-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.lu-hp-result-formula {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--vtt-text-muted);
}
.lu-hp-result-formula :deep(em) { color: var(--vtt-text-secondary); font-style: normal; }
</style>
