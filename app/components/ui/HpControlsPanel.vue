<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t } from '@/locales'
import { useDiceRoller } from '@/composables/useDiceRoller'
import Button from './Button.vue'
import SegmentedFilter from './SegmentedFilter.vue'
import Stepper from './Stepper.vue'

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

type Mode = 'damage' | 'heal' | 'temp'

const tab = ref<Mode>('damage')
const amount = ref<number>(0)

const modes = computed(() => [
  { value: 'damage' as Mode, label: t('hpControls.tabDamage'), tone: 'danger' as const },
  { value: 'heal' as Mode, label: t('hpControls.tabHeal'), tone: 'success' as const },
  { value: 'temp' as Mode, label: t('hpControls.tabTemp') },
])
const AMOUNT_TONE = { damage: 'danger', heal: 'success', temp: 'accent' } as const

watch(tab, () => { amount.value = 0 })

function rollSides(sides: number): number {
  return 1 + Math.floor(Math.random() * sides)
}

function onDice(notation: string) {
  if (props.characterId) {
    const record = dice.rollFree(props.characterId, props.characterName, notation)
    if (record) amount.value = record.diceTotal
    return
  }
  // Fallback for contexts without a character (e.g. Storybook):
  // generate a quick number locally so the panel keeps working.
  const m = notation.match(/^(\d*)d(\d+)$/i)
  if (!m) return
  const n = m[1] ? Number(m[1]) : 1
  const sides = Number(m[2])
  let total = 0
  for (let i = 0; i < n; i++) total += rollSides(sides)
  amount.value = total
}

const SUBMIT_VARIANT = { damage: 'hero-danger', heal: 'hero-success', temp: 'hero' } as const
const submitVariant = computed(() => SUBMIT_VARIANT[tab.value])
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
    <SegmentedFilter
      v-model="tab"
      class="hp-pop-tabs"
      :options="modes"
      full-width
      :aria-label="t('hpControls.modeAria')"
    />

    <Stepper
      v-model="amount"
      class="hp-amount"
      size="lg"
      :min="0"
      :tone="AMOUNT_TONE[tab]"
      :aria-label="t('hpControls.amountAria')"
    />

    <div class="hp-dice-quick">
      <Button size="sm" @click="onDice('d6')">d6</Button>
      <Button size="sm" @click="onDice('2d6')">2d6</Button>
      <Button size="sm" @click="onDice('d8')">d8</Button>
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

    <Button
      :variant="submitVariant"
      class="hp-pop-submit"
      :disabled="tab !== 'temp' && amount <= 0"
      @click="submit"
    >{{ submitLabel }}</Button>
  </div>
</template>

<style scoped>
.hp-pop-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}
.hp-pop-title {
  font-family: var(--font-serif);
  font-size: 16px;
  color: var(--vtt-accent-soft);
  font-weight: 500;
}
.hp-pop-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.hp-pop-tabs { margin-bottom: 12px; }
.hp-amount { padding: 8px 0 12px; }

.hp-dice-quick {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  margin: 2px 0 10px;
}

.hp-pop-preview {
  padding: 10px 12px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  font-size: 12px;
  color: var(--vtt-text-secondary);
  margin-bottom: 10px;
  line-height: 1.5;
}
.hp-pop-preview b {
  color: var(--vtt-accent-soft);
  font-family: var(--font-serif);
  font-size: 14px;
}
.hp-pop-preview .delta-neg {
  color: var(--vtt-danger-bright);
  font-family: var(--font-mono);
  font-weight: 600;
}
.hp-pop-preview .delta-pos {
  color: var(--vtt-success);
  font-family: var(--font-mono);
  font-weight: 600;
}

.hp-pop-submit { width: 100%; justify-content: center; }
</style>
