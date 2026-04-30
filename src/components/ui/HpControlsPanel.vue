<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t } from '@/locales'
import { useDiceRoller } from '@/composables/useDiceRoller'

const props = withDefaults(defineProps<{
  current: number
  max: number
  temp?: number
  showHeader?: boolean
  characterId?: string
  characterName?: string
}>(), {
  showHeader: true,
})

const emit = defineEmits<{
  (e: 'applyDamage', amount: number): void
  (e: 'heal', amount: number): void
  (e: 'addTemp', amount: number): void
  (e: 'submitted'): void
}>()

const dice = useDiceRoller()

const tab = ref<'damage' | 'heal' | 'temp'>('damage')
const amount = ref<number>(0)

watch(tab, () => { amount.value = 0 })

function rollSides(sides: number): number {
  return 1 + Math.floor(Math.random() * sides)
}

function onDice(notation: string) {
  if (props.characterId) {
    const record = dice.rollFree(props.characterId, props.characterName, notation)
    amount.value = record.diceTotal
    return
  }
  // Fallback for contexts without a character (e.g. PrimitivesPreviewView):
  // generate a quick number locally so the preview keeps working.
  const m = notation.match(/^(\d*)d(\d+)$/i)
  if (!m) return
  const n = m[1] ? Number(m[1]) : 1
  const sides = Number(m[2])
  let total = 0
  for (let i = 0; i < n; i++) total += rollSides(sides)
  amount.value = total
}

const submitClass = computed(() => `is-${tab.value}`)
const submitLabel = computed(() => {
  if (tab.value === 'damage') return t('hpControls.submitDamage')
  if (tab.value === 'heal') return t('hpControls.submitHeal')
  return t('hpControls.submitTemp')
})

function submit() {
  const v = Math.max(0, Math.floor(amount.value || 0))
  if (tab.value === 'temp') {
    emit('addTemp', v)
    amount.value = 0
    emit('submitted')
    return
  }
  if (v <= 0) return
  if (tab.value === 'damage') emit('applyDamage', v)
  else emit('heal', v)
  amount.value = 0
  emit('submitted')
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
  <div class="hp-pop-body">
    <div v-if="showHeader" class="hp-pop-head">
      <span class="hp-pop-title">{{ t('hpControls.title') }}</span>
      <span class="hp-pop-sub">{{ current }} / {{ max }}</span>
    </div>
    <div class="hp-pop-tabs">
      <button
        type="button"
        :class="['tab-damage', { active: tab === 'damage' }]"
        @click="tab = 'damage'"
      >{{ t('hpControls.tabDamage') }}</button>
      <button
        type="button"
        :class="['tab-heal', { active: tab === 'heal' }]"
        @click="tab = 'heal'"
      >{{ t('hpControls.tabHeal') }}</button>
      <button
        type="button"
        :class="[{ active: tab === 'temp' }]"
        @click="tab = 'temp'"
      >{{ t('hpControls.tabTemp') }}</button>
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
      <button type="button" @click="onDice('d6')">d6</button>
      <button type="button" @click="onDice('2d6')">2d6</button>
      <button type="button" @click="onDice('d8')">d8</button>
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
        {{ t('hpControls.tempPreviewLabel') }}
        <b>{{ temp || 0 }}</b>
        →
        <b>{{ amount || 0 }}</b>
      </template>
    </div>

    <button
      type="button"
      :class="['hp-pop-submit', submitClass]"
      :disabled="tab !== 'temp' && amount <= 0"
      @click="submit"
    >{{ submitLabel }}</button>
  </div>
</template>
