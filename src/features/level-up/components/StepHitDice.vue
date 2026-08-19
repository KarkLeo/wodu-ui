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
