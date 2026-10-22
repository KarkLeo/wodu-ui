<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t } from '@/locales'
import { useDiceRoller } from '@/composables/useDiceRoller'
import { useRovingSelection } from '@/composables/useRovingSelection'

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
  { value: 'damage' as Mode, label: t('hpControls.tabDamage'), class: 'tab-damage' },
  { value: 'heal' as Mode, label: t('hpControls.tabHeal'), class: 'tab-heal' },
  { value: 'temp' as Mode, label: t('hpControls.tabTemp'), class: '' },
])
const { tabIndexFor, onKeydown } = useRovingSelection(() => modes.value, tab)

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
    <div class="hp-pop-tabs" role="radiogroup" :aria-label="t('hpControls.modeAria')">
      <button
        v-for="mode in modes"
        :key="mode.value"
        type="button"
        role="radio"
        :aria-checked="tab === mode.value"
        :tabindex="tabIndexFor(mode.value)"
        :class="[mode.class, { active: tab === mode.value }]"
        @click="tab = mode.value"
        @keydown="onKeydown"
      >{{ mode.label }}</button>
    </div>

    <div class="hp-amount">
      <button type="button" :aria-label="t('ui.stepper.decrease')" @click="amount = Math.max(0, amount - 1)">−</button>
      <input
        type="number"
        min="0"
        :aria-label="t('hpControls.amountAria')"
        :class="[tab === 'heal' ? 'is-heal' : tab === 'temp' ? 'is-temp' : '']"
        :value="amount"
        @input="(e) => { const v = Number((e.target as HTMLInputElement).value); amount = Number.isNaN(v) ? 0 : v }"
      />
      <button type="button" :aria-label="t('ui.stepper.increase')" @click="amount = amount + 1">+</button>
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
.hp-pop-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  padding: 3px;
  box-shadow: var(--shadow-inset);
  margin-bottom: 12px;
}
.hp-pop-tabs button {
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
.hp-pop-tabs button.active {
  color: var(--vtt-accent-soft);
  background: var(--vtt-bg-elevated);
}
.hp-pop-tabs button.active.tab-damage { color: var(--vtt-danger-bright); }
.hp-pop-tabs button.active.tab-heal { color: var(--vtt-success); }

.hp-amount {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  gap: 10px;
  align-items: center;
  padding: 8px 0 12px;
}
.hp-amount button {
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
.hp-amount button:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}
.hp-amount input {
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
.hp-amount input:focus-visible {
  border-bottom-color: var(--vtt-accent);
  box-shadow: 0 1px 0 0 var(--vtt-accent);
}
.hp-amount input.is-heal { color: var(--vtt-success); }
.hp-amount input.is-temp { color: var(--vtt-accent); }
.hp-amount input::-webkit-outer-spin-button,
.hp-amount input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.hp-dice-quick {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  margin: 2px 0 10px;
}
.hp-dice-quick button {
  padding: 5px 10px;
  background: transparent;
  border: 1px dashed var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  color: var(--vtt-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}
.hp-dice-quick button:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent);
  border-style: solid;
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

.hp-pop-submit {
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
.hp-pop-submit:disabled { opacity: 0.45; cursor: not-allowed; }
.hp-pop-submit.is-damage {
  background: var(--vtt-danger);
  border-color: var(--vtt-danger);
  color: var(--vtt-text-primary);
}
.hp-pop-submit.is-damage:hover:not(:disabled) { background: var(--vtt-danger-bright); }
.hp-pop-submit.is-heal {
  background: var(--vtt-success);
  border-color: var(--vtt-success);
  color: #0E0B08;
}
.hp-pop-submit.is-heal:hover:not(:disabled) { filter: brightness(1.1); }
.hp-pop-submit.is-temp {
  background: #A6833E;
  border-color: #8C6A3A;
  color: #1a1205;
}
</style>
