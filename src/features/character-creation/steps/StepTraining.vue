<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { Character, SkillId, AbilityId, Spirit, Magic, Ritual } from '@/types/character'
import { SKILLS, ABILITIES } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { CLASSES, MAGIC_ABILITY_IDS } from '@/data/classes'
import { getAbilityEffect, hasMagicAbility } from '@/data/abilities'
import SpiritCard from '@/features/in-game/components/magic/SpiritCard.vue'
import RitualCard from '@/features/in-game/components/magic/RitualCard.vue'
import CantripChip from '@/features/in-game/components/magic/CantripChip.vue'
import { t } from '@/locales'

const props = defineProps<{ draft: Character; dispatch: (cmd: CharacterCommand) => void }>()
const emit = defineEmits<{ patch: [Partial<Character>] }>()

const classData = computed(() => CLASSES[props.draft.classId])

const autoSkills = computed<SkillId[]>(() => classData.value.grantedSkillIds)
const requiredSkillPicks = computed(() => Math.max(0, 2 - autoSkills.value.length))
const autoAbilities = computed<AbilityId[]>(() => classData.value.autoAbilityIds ?? [])
const requiredAbilityPicks = computed(() => 2 - autoAbilities.value.length)
const abilityPool = computed<AbilityId[]>(() => classData.value.abilityPool)

const pickedSkills = computed(() =>
  props.draft.skillIds.filter(id => !autoSkills.value.includes(id)),
)
const pickedAbilities = computed(() =>
  props.draft.abilityIds.filter(id => !autoAbilities.value.includes(id)),
)

const abilitySlotsFull = computed(() => pickedAbilities.value.length >= requiredAbilityPicks.value)
const skillSlotsFull = computed(() => pickedSkills.value.length >= requiredSkillPicks.value)

function toggleSkill(id: SkillId) {
  if (autoSkills.value.includes(id)) return
  if (requiredSkillPicks.value === 0) return
  const has = props.draft.skillIds.includes(id)
  let nextPicked: SkillId[]
  if (has) {
    nextPicked = pickedSkills.value.filter(x => x !== id)
  } else {
    if (skillSlotsFull.value) return
    nextPicked = [...pickedSkills.value, id]
  }
  emit('patch', { skillIds: [...autoSkills.value, ...nextPicked] })
}

function toggleAbility(id: AbilityId) {
  if (autoAbilities.value.includes(id)) return
  if (!abilityPool.value.includes(id)) return
  const has = props.draft.abilityIds.includes(id)
  let nextPicked: AbilityId[]
  if (has) {
    nextPicked = pickedAbilities.value.filter(x => x !== id)
  } else {
    if (abilitySlotsFull.value) return
    nextPicked = [...pickedAbilities.value, id]
  }
  const patch: Partial<Character> = { abilityIds: [...autoAbilities.value, ...nextPicked] }
  const effect = getAbilityEffect(id)
  if (effect?.initMagicOnAcquire && !has && !props.draft.magic) {
    patch.magic = ensureMagic()
  } else if (effect?.initMagicOnAcquire && has && props.draft.classId !== 'wizard') {
    const remainingMagicIds = nextPicked.filter(a => (MAGIC_ABILITY_IDS as readonly string[]).includes(a))
    if (remainingMagicIds.length === 0) patch.magic = undefined
  }
  const cantrips = effect?.startingCantrips
  if (cantrips && !has) {
    const base = patch.magic ?? props.draft.magic ?? ensureMagic()
    patch.magic = { ...base, cantrips }
  }
  emit('patch', patch)
}

function ensureMagic(): Magic {
  if (props.draft.magic) return props.draft.magic
  const spirits: Spirit[] = props.draft.classId === 'wizard'
    ? [
        { id: crypto.randomUUID(), name: '', appearance: '', sphere1: '', sphere2: '' },
        { id: crypto.randomUUID(), name: '', appearance: '', sphere1: '', sphere2: '' },
      ]
    : []
  return { spirits, rituals: [], cantrips: [] }
}

function updateSpirit(idx: number, patchSp: Partial<Spirit>) {
  const magic = ensureMagic()
  const spirits = magic.spirits.map((s, i) => (i === idx ? { ...s, ...patchSp } : s))
  props.dispatch({ type: 'UPDATE_MAGIC', magic: { ...magic, spirits } })
}
function removeSpirit(idx: number) {
  const magic = ensureMagic()
  const spirits = magic.spirits.filter((_, i) => i !== idx)
  props.dispatch({ type: 'UPDATE_MAGIC', magic: { ...magic, spirits } })
}

function updateRitual(idx: number, patchRit: Partial<Ritual>) {
  const magic = ensureMagic()
  const rituals = [...(magic.rituals ?? [])]
  while (rituals.length < 2) rituals.push({ name: '', description: '' })
  rituals[idx] = { ...rituals[idx], ...patchRit }
  props.dispatch({ type: 'UPDATE_MAGIC', magic: { ...magic, rituals } })
}
function removeRitual(idx: number) {
  const magic = ensureMagic()
  const rituals = (magic.rituals ?? []).filter((_, i) => i !== idx)
  props.dispatch({ type: 'UPDATE_MAGIC', magic: { ...magic, rituals } })
}

const showMagic = computed(() =>
  props.draft.classId === 'wizard' || hasMagicAbility(props.draft.abilityIds),
)
const startingCantrips = computed<string[]>(() => {
  for (const id of pickedAbilities.value) {
    const eff = getAbilityEffect(id)
    if (eff?.startingCantrips?.length) return eff.startingCantrips
  }
  return props.draft.magic?.cantrips ?? []
})
const hasRitualAbility = computed(() => pickedAbilities.value.includes('ritual'))

const visibleAbilities = computed(() => {
  const allowed = new Set<AbilityId>([...autoAbilities.value, ...abilityPool.value])
  return ABILITIES.filter(a => allowed.has(a.id))
})

function syncAutos() {
  const skills = Array.from(new Set([...autoSkills.value, ...pickedSkills.value]))
  const abilities = Array.from(
    new Set([...autoAbilities.value, ...pickedAbilities.value.filter(a => abilityPool.value.includes(a))]),
  )
  emit('patch', { skillIds: skills, abilityIds: abilities })
}

const abilitiesCounterText = computed(() =>
  t('characterCreation.training.abilitiesCounter', {
    picked: autoAbilities.value.length + pickedAbilities.value.length,
    total: 2,
  }),
)
const skillsCounterText = computed(() =>
  t('characterCreation.training.skillsCounter', {
    picked: autoSkills.value.length + pickedSkills.value.length,
    total: 2,
  }),
)

const abilitiesHint = computed(() => {
  if (autoAbilities.value.length > 0) {
    return t('characterCreation.training.abilitiesHintLocked', {
      locked: autoAbilities.value.length,
      count: requiredAbilityPicks.value,
    })
  }
  return t('characterCreation.training.abilitiesHint', {
    count: requiredAbilityPicks.value,
    total: abilityPool.value.length,
  })
})
const skillsHint = computed(() => {
  if (autoSkills.value.length > 0) {
    const autoNames = autoSkills.value.map(id => SKILLS.find(s => s.id === id)?.name ?? id).join(', ')
    if (requiredSkillPicks.value === 0) return t('characterCreation.training.skillsHintAllLocked', { auto: autoNames })
    return t('characterCreation.training.skillsHintLocked', { auto: autoNames, count: requiredSkillPicks.value })
  }
  return t('characterCreation.training.skillsHint', { count: requiredSkillPicks.value })
})

function abilState(id: AbilityId): { selected: boolean; auto: boolean; disabled: boolean } {
  const auto = autoAbilities.value.includes(id)
  const selected = props.draft.abilityIds.includes(id)
  const inPool = abilityPool.value.includes(id) || auto
  const disabled = !auto && (!inPool || (!selected && abilitySlotsFull.value))
  return { selected, auto, disabled }
}

function abilDescription(id: AbilityId): string {
  return ABILITIES.find(a => a.id === id)?.description ?? ''
}
function abilName(id: AbilityId): string {
  return ABILITIES.find(a => a.id === id)?.name ?? id
}
function skillIsLocked(id: SkillId): boolean {
  return autoSkills.value.includes(id)
}

onMounted(() => {
  syncAutos()
  const cantrips = startingCantrips.value
  if (showMagic.value && !props.draft.magic) {
    const magic = ensureMagic()
    emit('patch', { magic: cantrips.length ? { ...magic, cantrips } : magic })
  } else if (showMagic.value && props.draft.magic && cantrips.length && !props.draft.magic.cantrips?.length) {
    emit('patch', { magic: { ...props.draft.magic, cantrips } })
  }
})
</script>

<template>
  <section class="cc-section">
    <div class="cc-section-head">
      <span class="cc-section-label">{{ t('characterCreation.training.skillsLabel') }}</span>
      <span class="cc-section-hint">{{ skillsHint }}</span>
      <span class="cc-section-action cc-counter">{{ skillsCounterText }}</span>
    </div>
    <div class="cc-skill-grid">
      <button
        v-for="sk in SKILLS"
        :key="sk.id"
        type="button"
        :class="[
          'cc-skill',
          {
            'is-selected': draft.skillIds.includes(sk.id) && !skillIsLocked(sk.id),
            'is-locked': skillIsLocked(sk.id),
          },
        ]"
        :disabled="skillIsLocked(sk.id) || (!draft.skillIds.includes(sk.id) && skillSlotsFull)"
        @click="toggleSkill(sk.id)"
      >
        <span v-if="skillIsLocked(sk.id)" class="lock-glyph">
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="2" y="4.5" width="6" height="4" rx="0.5"/><path d="M3.5 4.5 L3.5 3 C3.5 1.8 4.2 1.2 5 1.2 C5.8 1.2 6.5 1.8 6.5 3 L6.5 4.5"/></svg>
        </span>
        {{ sk.name }}
      </button>
    </div>
  </section>

  <section class="cc-section">
    <div class="cc-section-head">
      <span class="cc-section-label">{{ t('characterCreation.training.abilitiesLabel') }}</span>
      <span class="cc-section-hint">{{ abilitiesHint }}</span>
      <span class="cc-section-action cc-counter">{{ abilitiesCounterText }}</span>
    </div>
    <div class="cc-abil-list">
      <div
        v-for="ab in visibleAbilities"
        :key="ab.id"
        :class="[
          'cc-abil',
          {
            'is-selected': abilState(ab.id).selected && !abilState(ab.id).auto,
            'is-locked': abilState(ab.id).auto,
            'is-disabled': abilState(ab.id).disabled,
          },
        ]"
        role="checkbox"
        :aria-checked="abilState(ab.id).selected"
        :tabindex="abilState(ab.id).disabled || abilState(ab.id).auto ? -1 : 0"
        @click="!abilState(ab.id).disabled && !abilState(ab.id).auto && toggleAbility(ab.id)"
        @keydown.space.prevent="!abilState(ab.id).disabled && !abilState(ab.id).auto && toggleAbility(ab.id)"
      >
        <span class="cc-check">
          <svg v-if="abilState(ab.id).selected" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5 L5 8.5 L9 4"/></svg>
        </span>
        <div class="cc-abil-body">
          <span class="cc-abil-name">{{ abilName(ab.id) }}</span>
          <span class="cc-abil-desc">{{ abilDescription(ab.id) }}</span>
        </div>
        <span v-if="abilState(ab.id).auto" class="cc-abil-flag">{{ t('characterCreation.training.abilFlagAuto') }}</span>
        <span
          v-else-if="!abilState(ab.id).selected && abilState(ab.id).disabled"
          class="cc-abil-flag"
        >{{ t('characterCreation.training.abilFlagNoSlots') }}</span>
        <span v-else-if="abilState(ab.id).selected" class="cc-abil-flag">{{ t('characterCreation.training.abilFlagSelected') }}</span>
      </div>
    </div>
  </section>

  <section v-if="showMagic" class="cc-section">
    <div class="cc-section-head">
      <span class="cc-section-label">{{ t('characterCreation.training.magicLabel') }}</span>
      <span class="cc-section-hint">
        {{ draft.classId === 'wizard' ? t('characterCreation.training.magicHintWizard') : t('characterCreation.training.magicHintOther') }}
      </span>
    </div>

    <div class="cc-magic-group">
      <span class="cc-magic-sub">{{ t('characterCreation.training.spiritsSection') }}</span>
      <div class="cc-magic-stack">
        <SpiritCard
          v-for="(sp, idx) in (draft.magic?.spirits ?? [])"
          :key="sp.id"
          :spirit="sp"
          @update="p => updateSpirit(idx, p)"
          @remove="removeSpirit(idx)"
        />
      </div>
    </div>

    <div v-if="hasRitualAbility" class="cc-magic-group">
      <span class="cc-magic-sub">{{ t('characterCreation.training.ritualsHint') }}</span>
      <div class="cc-magic-stack">
        <RitualCard
          v-for="i in 2"
          :key="i"
          :ritual="(draft.magic?.rituals ?? [])[i - 1] ?? { name: '', description: '' }"
          @update="p => updateRitual(i - 1, p)"
          @remove="removeRitual(i - 1)"
        />
      </div>
    </div>

    <div v-if="startingCantrips.length" class="cc-magic-group">
      <span class="cc-magic-sub">{{ t('characterCreation.training.cantripsSection') }}</span>
      <div class="cc-cantrips-row">
        <CantripChip v-for="c in startingCantrips" :key="c" :name="c" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.cc-section { display: flex; flex-direction: column; gap: var(--s-3); }
.cc-section-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.cc-section-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.cc-section-hint {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
}
.cc-section-action { margin-left: auto; }
.cc-counter {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-accent-soft);
  letter-spacing: 0.06em;
}

.cc-abil-list { display: flex; flex-direction: column; }
.cc-abil {
  display: grid;
  grid-template-columns: 22px 1fr auto;
  align-items: center;
  column-gap: 14px;
  padding: 12px 8px;
  cursor: pointer;
  transition: background var(--t-fast) var(--ease);
  border-radius: var(--r-sm);
}
.cc-abil + .cc-abil { border-top: 1px solid rgba(140, 106, 58, 0.1); }
.cc-abil:hover:not(.is-disabled):not(.is-locked) { background: rgba(228, 201, 160, 0.03); }
.cc-abil.is-selected { background: rgba(140, 106, 58, 0.12); }
.cc-abil.is-locked { opacity: 0.75; cursor: default; }
.cc-abil.is-disabled { opacity: 0.35; cursor: not-allowed; }

.cc-check {
  width: 22px;
  height: 22px;
  border-radius: var(--r-pill);
  background: transparent;
  border: 1px solid rgba(140, 106, 58, 0.35);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  transition: all var(--t-fast) var(--ease);
}
.cc-check svg { width: 12px; height: 12px; }
.cc-abil.is-selected .cc-check {
  background: var(--vtt-accent);
  border-color: var(--vtt-accent);
  color: var(--vtt-bg-base);
}
.cc-abil.is-locked .cc-check {
  background: rgba(140, 106, 58, 0.45);
  border-color: rgba(140, 106, 58, 0.55);
  color: var(--vtt-accent-soft);
}
.cc-abil-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cc-abil-name {
  font-family: var(--font-serif);
  font-size: 16px;
  color: var(--vtt-text-primary);
  line-height: 1.2;
}
.cc-abil-desc {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
  line-height: 1.35;
}
.cc-abil-flag {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  flex-shrink: 0;
}

.cc-skill-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.cc-skill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  background: rgba(36, 28, 21, 0.5);
  border: 1px solid transparent;
  border-radius: var(--r-pill);
  color: var(--vtt-text-secondary);
  font-family: var(--font-serif);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
.cc-skill:hover:not(:disabled):not(.is-locked) { background: rgba(36, 28, 21, 0.75); }
.cc-skill:disabled { opacity: 0.35; cursor: not-allowed; }
.cc-skill.is-selected {
  background: rgba(140, 106, 58, 0.2);
  border-color: rgba(140, 106, 58, 0.55);
  color: var(--vtt-accent-soft);
}
.cc-skill.is-locked {
  background: rgba(140, 106, 58, 0.1);
  color: var(--vtt-accent-deep);
  cursor: default;
  opacity: 1;
}
.cc-skill .lock-glyph { width: 10px; height: 10px; color: var(--vtt-accent-deep); }
.cc-skill .lock-glyph svg { width: 100%; height: 100%; }

.cc-magic-group { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
.cc-magic-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.cc-magic-stack { display: flex; flex-direction: column; gap: 10px; }
.cc-cantrips-row { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
