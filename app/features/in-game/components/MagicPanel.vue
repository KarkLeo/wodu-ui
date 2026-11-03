<script setup lang="ts">
import { computed } from 'vue'
import type { Character, Ritual, Spirit, Magic, AbilityId } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { useMercury } from '@/composables/useMercury'
import { isRolling } from '@/composables/useDiceRoller'
import { useSheetReadonly } from '@/composables/useSheetReadonly'
import { grantsSection } from '@/data/abilities'
import { t } from '@/locales'
import { cantripName } from '@/locales/content'

import SpiritCard from './magic/SpiritCard.vue'
import RitualCard from './magic/RitualCard.vue'
import CantripChip from './magic/CantripChip.vue'
import QuicksilverCounter from './magic/QuicksilverCounter.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import Button from '@/components/ui/Button.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'

type Dispatcher = (cmd: CharacterCommand) => void

const props = defineProps<{ char: Character; abilityIds: AbilityId[]; dispatch: Dispatcher }>()

const readonly = useSheetReadonly()

const {
  count: quicksilverCount,
  limit: quicksilverLimit,
  isOverdose: overdose,
  mercuryItem,
  overdoseOpen,
  drink,
  reset: resetQuicksilver,
  rollOverdose,
} = useMercury(() => props.char, props.dispatch)

const EMPTY_MAGIC: Magic = { spirits: [], rituals: [], cantrips: [] }
const magic = computed<Magic>(() => props.char.magic ?? EMPTY_MAGIC)

const hasSpirits = computed(() => grantsSection(props.abilityIds, 'spirits'))
const hasRituals = computed(() => grantsSection(props.abilityIds, 'rituals'))
const hasCantrips = computed(() => grantsSection(props.abilityIds, 'cantrips'))
const hasQuicksilver = computed(() => hasSpirits.value)

const canDrink = computed(() => mercuryItem.value !== null)

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
  drink(mercuryItem.value.id)
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
      @reset="resetQuicksilver"
    />

    <div v-if="hasSpirits" class="mg-section">
      <SectionHeader :title="t('inGame.magic.spirits.title')" :count="magic.spirits.length">
        <template v-if="!readonly" #action>
          <Button variant="dashed" size="sm" :icon-left="IconPlus" @click="addSpirit">
            {{ t('inGame.magic.spirits.add') }}
          </Button>
        </template>
      </SectionHeader>
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
      <SectionHeader :title="t('inGame.magic.rituals.title')" :count="magic.rituals.length">
        <template v-if="!readonly" #action>
          <Button variant="dashed" size="sm" :icon-left="IconPlus" @click="addRitual">
            {{ t('inGame.magic.rituals.add') }}
          </Button>
        </template>
      </SectionHeader>
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
      <SectionHeader :title="t('inGame.magic.cantrips.title')" :count="magic.cantrips.length" />
      <div class="mg-cantrips">
        <CantripChip v-for="c in magic.cantrips" :key="c" :name="cantripName(c)" />
      </div>
    </div>

    <ConfirmSheet
      v-if="!readonly"
      v-model:open="overdoseOpen"
      variant="danger"
      :title="t('inGame.magic.overdose.title')"
    >
      <p>
        {{ t('inGame.magic.overdose.body', { count: quicksilverCount, level: quicksilverLimit }) }}
      </p>
      <template #actions>
        <Button variant="hero-danger" :disabled="isRolling" @click="rollOverdose">
          {{ t('inGame.magic.overdose.roll') }}
        </Button>
        <Button variant="primary" @click="resetQuicksilver">
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
