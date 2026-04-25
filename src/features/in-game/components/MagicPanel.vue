<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Character, Ritual, Spirit, Magic, AbilityId } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { useInventory } from '@/composables/useInventory'
import { useDiceRoller, isRolling } from '@/composables/useDiceRoller'
import { grantsSection } from '@/data/abilities'
import { isQuicksilverOverdose, effectiveStat } from '@/utils/derived'
import { createLogger } from '@/utils/logger'
import { t } from '@/locales'

import SpiritCard from './magic/SpiritCard.vue'
import RitualCard from './magic/RitualCard.vue'
import CantripChip from './magic/CantripChip.vue'
import QuicksilverCounter from './magic/QuicksilverCounter.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import Button from '@/components/ui/Button.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'

const log = createLogger('magic')

type Dispatcher = (cmd: CharacterCommand) => void

const props = defineProps<{ char: Character; abilityIds: AbilityId[]; dispatch: Dispatcher }>()

const inv = useInventory(props.dispatch)
const { rollStat } = useDiceRoller()

const EMPTY_MAGIC: Magic = { spirits: [], rituals: [], cantrips: [] }
const magic = computed<Magic>(() => props.char.magic ?? EMPTY_MAGIC)

const hasSpirits = computed(() => grantsSection(props.abilityIds, 'spirits'))
const hasRituals = computed(() => grantsSection(props.abilityIds, 'rituals'))
const hasCantrips = computed(() => grantsSection(props.abilityIds, 'cantrips'))
const hasQuicksilver = computed(() => hasSpirits.value)

const quicksilverCount = computed(() => props.char.quicksilverCount ?? 0)
const quicksilverLimit = computed(() => props.char.level)
const overdose = computed(() => isQuicksilverOverdose(props.char))

const mercuryItem = computed(() =>
  props.char.inventory.find(i => i.templateId === 'mercury' && (i.quantity ?? 1) > 0) ?? null,
)
const canDrink = computed(() => mercuryItem.value !== null)

const overdoseOpen = ref(false)

function updateMagic(patch: Partial<Magic>) {
  props.dispatch({ type: 'UPDATE_MAGIC', magic: { ...magic.value, ...patch } })
}

function addSpirit() {
  updateMagic({
    spirits: [
      ...magic.value.spirits,
      { id: crypto.randomUUID(), name: '', appearance: '', sphere1: '', sphere2: '' },
    ],
  })
}
function updateSpirit(idx: number, patch: Partial<Spirit>) {
  const spirits = magic.value.spirits.map((s, i) => (i === idx ? { ...s, ...patch } : s))
  updateMagic({ spirits })
}
function removeSpirit(idx: number) {
  updateMagic({ spirits: magic.value.spirits.filter((_, i) => i !== idx) })
}

function addRitual() {
  updateMagic({ rituals: [...magic.value.rituals, { name: '', description: '' }] })
}
function updateRitual(idx: number, patch: Partial<Ritual>) {
  const rituals = magic.value.rituals.map((r, i) => (i === idx ? { ...r, ...patch } : r))
  updateMagic({ rituals })
}
function removeRitual(idx: number) {
  updateMagic({ rituals: magic.value.rituals.filter((_, i) => i !== idx) })
}

function onDrink() {
  if (!mercuryItem.value) return
  if (overdose.value) {
    overdoseOpen.value = true
    return
  }
  inv.use(mercuryItem.value.id)
}

function onResetQuicksilver() {
  props.dispatch({ type: 'RESET_QUICKSILVER' })
}

function overdoseReset() {
  props.dispatch({ type: 'RESET_QUICKSILVER' })
  overdoseOpen.value = false
}

async function overdoseRoll() {
  const item = mercuryItem.value
  if (!item) { overdoseOpen.value = false; return }
  try {
    await rollStat(
      props.char.id,
      props.char.name,
      'con',
      t('inGame.inventory.overdose.rollLabel'),
      effectiveStat(props.char, 'con'),
    )
  } catch (err) {
    log.error('overdose roll failed', err)
  }
  inv.use(item.id)
  overdoseOpen.value = false
}

</script>

<template>
  <section class="mg-panel">
    <QuicksilverCounter
      v-if="hasQuicksilver"
      :count="quicksilverCount"
      :limit="quicksilverLimit"
      :overdose="overdose"
      :can-drink="canDrink"
      @drink="onDrink"
      @reset="onResetQuicksilver"
    />

    <div v-if="hasSpirits" class="mg-section">
      <div class="mg-section-head">
        <span class="mg-section-title">
          {{ t('inGame.magic.spirits.title') }}
          <b>· {{ magic.spirits.length }}</b>
        </span>
        <button class="mg-section-add" @click="addSpirit">
          <IconPlus />
          {{ t('inGame.magic.spirits.add') }}
        </button>
      </div>
      <div class="mg-list">
        <SpiritCard
          v-for="(sp, idx) in magic.spirits"
          :key="sp.id"
          :spirit="sp"
          @update="updateSpirit(idx, $event)"
          @remove="removeSpirit(idx)"
        />
      </div>
    </div>

    <div v-if="hasRituals" class="mg-section">
      <div class="mg-section-head">
        <span class="mg-section-title">
          {{ t('inGame.magic.rituals.title') }}
          <b>· {{ magic.rituals.length }}</b>
        </span>
        <button class="mg-section-add" @click="addRitual">
          <IconPlus />
          {{ t('inGame.magic.rituals.add') }}
        </button>
      </div>
      <div class="mg-list">
        <RitualCard
          v-for="(r, idx) in magic.rituals"
          :key="idx"
          :ritual="r"
          @update="updateRitual(idx, $event)"
          @remove="removeRitual(idx)"
        />
      </div>
    </div>

    <div v-if="hasCantrips && magic.cantrips.length > 0" class="mg-section">
      <div class="mg-section-head">
        <span class="mg-section-title">
          {{ t('inGame.magic.cantrips.title') }}
          <b>· {{ magic.cantrips.length }}</b>
        </span>
      </div>
      <div class="mg-cantrips">
        <CantripChip v-for="c in magic.cantrips" :key="c" :name="c" />
      </div>
    </div>

    <ConfirmSheet
      v-model:open="overdoseOpen"
      variant="danger"
      :title="t('inGame.magic.overdose.title')"
    >
      <p>
        {{ t('inGame.magic.overdose.body', { count: quicksilverCount, level: quicksilverLimit }) }}
      </p>
      <template #actions>
        <Button variant="hero-danger" :disabled="isRolling" @click="overdoseRoll">
          {{ t('inGame.magic.overdose.roll') }}
        </Button>
        <Button variant="primary" @click="overdoseReset">
          {{ t('inGame.magic.overdose.reset') }}
        </Button>
        <Button variant="ghost" @click="overdoseOpen = false">{{ t('common.cancel') }}</Button>
      </template>
    </ConfirmSheet>
  </section>
</template>

<style scoped>
.mg-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 14px 16px;
}
.mg-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mg-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.mg-section-title {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.mg-section-title :deep(b),
.mg-section-title b {
  color: var(--vtt-text-muted);
  font-weight: normal;
  margin-left: 6px;
}
.mg-section-add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: transparent;
  border: 1px dashed var(--vtt-border-strong);
  border-radius: var(--r-pill);
  color: var(--vtt-text-secondary);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
.mg-section-add:hover {
  border-color: var(--vtt-border-gold);
  color: var(--vtt-accent-soft);
  background: rgba(140, 106, 58, 0.05);
}
.mg-section-add :deep(svg) { width: 10px; height: 10px; }

.mg-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mg-cantrips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
