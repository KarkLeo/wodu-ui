<script setup lang="ts">
import { computed, ref } from 'vue'
import WizardSection from '@/components/layout/WizardSection.vue'
import TextField from '@/components/ui/TextField.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import SelectableTile from '@/components/ui/SelectableTile.vue'
import Button from '@/components/ui/Button.vue'
import IconButton from '@/components/ui/IconButton.vue'
import IconDiceFace from '@/components/ui/icons/IconDiceFace.vue'
import IconReroll from '@/components/ui/icons/IconReroll.vue'
import type { ClassId, SkillId, StatKey } from '@/types/character'
import { CLASS_LIST } from '@/data/classes'
import { STAT_KEYS } from '@/data/xpTable'
import { statBonusFrom2d6 } from '@/utils/derived'
import { useDiceRoller, isRolling } from '@/composables/useDiceRoller'
import { useCharacterCreation } from '@/composables/useCharacterCreation'
import { useDebouncedField } from '@/composables/useDebouncedField'
import { useRovingSelection } from '@/composables/useRovingSelection'
import { t } from '@/locales'
import { skillName, statShort, className } from '@/locales/content'

const { draft, setName, setTrueName, pickClass, setCustomClassName, setStatRoll, setStatRollsBatch } = useCharacterCreation()

const nameField = useDebouncedField(() => draft.value?.name ?? '', setName)
const trueNameField = useDebouncedField(() => draft.value?.trueName ?? '', setTrueName)
const customClassField = useDebouncedField(() => draft.value?.customClassName ?? '', setCustomClassName)

const { roll, rollBatch } = useDiceRoller()
const freshKey = ref<StatKey | null>(null)
const diceTraces = ref<Partial<Record<StatKey, [number, number]>>>({})
let freshTimer: number | null = null
let staggerTimers: number[] = []

function markFresh(key: StatKey) {
  freshKey.value = key
  if (freshTimer) window.clearTimeout(freshTimer)
  freshTimer = window.setTimeout(() => { freshKey.value = null }, 1400)
}

function applyStatResult(key: StatKey, dice: number[], total: number) {
  if (dice.length === 2) diceTraces.value[key] = [dice[0], dice[1]]
  setStatRoll(key, total, statBonusFrom2d6(total))
}

async function rollAll() {
  const d = draft.value
  if (!d) return
  staggerTimers.forEach(window.clearTimeout)
  staggerTimers = []
  // Pass undefined rather than a locale-baked fallback: DiceDrawer's authorFor()
  // resolves a missing name from the live character list, in the roller's own locale.
  const characterName = d.name || undefined
  const records = await rollBatch(
    STAT_KEYS.map(key => ({
      notation: '2d6',
      label: `${statShort(key)} (2d6)`,
      purpose: { kind: 'stat', statKey: key, statBonus: 0 } as const,
    })),
    { characterId: d.id, characterName },
  )
  if (records.length === 0) return
  const rolls = records.map((record, idx) => {
    const key = STAT_KEYS[idx]
    if (record.dice.length === 2) diceTraces.value[key] = [record.dice[0].value, record.dice[1].value]
    return { key, roll: record.diceTotal, bonus: statBonusFrom2d6(record.diceTotal) }
  })
  setStatRollsBatch(rolls)
  records.forEach((_record, idx) => {
    const key = STAT_KEYS[idx]
    const timer = window.setTimeout(() => markFresh(key), idx * 180)
    staggerTimers.push(timer)
  })
}

async function rerollOne(key: StatKey) {
  const d = draft.value
  if (!d) return
  const record = await roll({
    notation: '2d6',
    label: `${statShort(key)} (2d6)`,
    purpose: { kind: 'stat', statKey: key, statBonus: 0 },
    characterId: d.id,
    characterName: d.name || undefined,
  })
  if (!record) return
  applyStatResult(key, record.dice.map(dv => dv.value), record.diceTotal)
  markFresh(key)
}

function selectClass(id: ClassId) {
  if (!draft.value || id === draft.value.classId) return
  pickClass(id)
}

const pickedClass = computed<ClassId | undefined>({
  get: () => draft.value?.classId,
  set: (id) => { if (id) selectClass(id) },
})
const { tabIndexFor: classTabIndex, onKeydown: onClassKeydown } = useRovingSelection(
  () => CLASS_LIST.map(cls => ({ value: cls.id })),
  pickedClass,
)

function classTagText(classId: ClassId, grantedSkillIds: readonly SkillId[]): string {
  if (classId === 'custom') return t('characterCreation.identity.classTags.custom')
  const skill = grantedSkillIds[0] ? skillName(grantedSkillIds[0]) : ''
  return t(`characterCreation.identity.classTags.${classId}`, { skill })
}

function rollTrace(key: StatKey): { a: number; b: number } | null {
  const trace = diceTraces.value[key]
  if (!trace) return null
  return { a: trace[0], b: trace[1] }
}
function rollTotal(key: StatKey): number {
  return draft.value?.statRolls[key] ?? 0
}
function statValue(key: StatKey): string {
  if (!rollTotal(key)) return '—'
  const bonus = draft.value?.stats[key] ?? 0
  return bonus > 0 ? `+${bonus}` : '0'
}
function statTone(key: StatKey): 'neutral' | 'muted' | 'accent' {
  if (!rollTotal(key)) return 'muted'
  return rollTotal(key) === 12 ? 'accent' : 'neutral'
}

const CLASS_GLYPHS: Record<ClassId, string> = {
  fighter: 'M14 3 L19 8 L14 25 L9 8 Z M9 8 L19 8',
  thief:   'M5 19 C9 13 15 12 21 16 L24 13 M5 19 L8 22',
  cleric:  'M14 4 L14 24 M9 9 L19 9 M11 18 L17 18',
  wizard:  'M14 3 L16 11 L23 11 L17.5 15.5 L19.5 23 L14 18.5 L8.5 23 L10.5 15.5 L5 11 L12 11 Z',
  ranger:  'M4 21 C7 15 13 8 22 6 M22 6 L20 11 M22 6 L17 8',
  custom:  '',
}
</script>

<template>
  <template v-if="draft">
  <WizardSection gap="lg">
    <TextField
      :model-value="nameField.value.value"
      variant="underline"
      :label="t('characterCreation.identity.nameLabel')"
      :placeholder="t('characterCreation.identity.namePlaceholder')"
      @update:model-value="nameField.onInput"
      @blur="nameField.flush()"
    />
    <TextField
      :model-value="trueNameField.value.value"
      variant="underline"
      class="cc-truename"
      :label="t('characterCreation.identity.trueNameLabel')"
      :optional="t('characterCreation.identity.trueNameOpt')"
      :placeholder="t('characterCreation.identity.trueNamePlaceholder')"
      @update:model-value="trueNameField.onInput"
      @blur="trueNameField.flush()"
    >
      <template #hint>
        <svg class="cc-hint-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M6 1.5 C3 1.5 1 4 1 6 C1 8 3 10.5 6 10.5 C9 10.5 11 8 11 6 C11 4 9 1.5 6 1.5 Z"/><circle cx="6" cy="6" r="1.6" fill="currentColor"/></svg>
        {{ t('characterCreation.identity.trueNameHint') }}
      </template>
    </TextField>
  </WizardSection>

  <WizardSection>
    <SectionHeader :title="t('characterCreation.identity.attrsLabel')" :hint="t('characterCreation.identity.attrsHint')">
      <template #action>
        <Button variant="roll" :icon-left="IconDiceFace" :disabled="isRolling" @click="rollAll">
          {{ t('characterCreation.shell.rollAll') }}
        </Button>
      </template>
    </SectionHeader>
    <div class="cc-attr-grid">
      <SelectableTile
        v-for="key in STAT_KEYS"
        :key="key"
        static
        size="sm"
        :label="statShort(key)"
        :value="statValue(key)"
        :value-tone="statTone(key)"
        :class="{ 'is-fresh': freshKey === key }"
      >
        <template #action>
          <IconButton
            variant="bare"
            size="sm"
            :label="t('characterCreation.identity.attrRollTitle')"
            :title="t('characterCreation.identity.attrRollTitle')"
            :disabled="isRolling"
            @click="rerollOne(key)"
          >
            <IconReroll :size="16" :stroke-width="1" />
          </IconButton>
        </template>
        <span v-if="rollTrace(key)" class="cc-attr-roll-trace">
          2d6: <em>{{ rollTrace(key)!.a }} + {{ rollTrace(key)!.b }}</em>
        </span>
        <span v-else-if="rollTotal(key)" class="cc-attr-roll-trace">
          2d6: <em>{{ rollTotal(key) }}</em>
        </span>
        <span v-else class="cc-attr-roll-trace">{{ t('characterCreation.identity.attrEmpty') }}</span>
      </SelectableTile>
    </div>
  </WizardSection>

  <WizardSection>
    <SectionHeader :title="t('characterCreation.identity.classLabel')" :hint="t('characterCreation.identity.classHint')" />
    <div class="cc-class-grid" role="radiogroup" :aria-label="t('characterCreation.identity.classLabel')">
      <SelectableTile
        v-for="cls in CLASS_LIST"
        :key="cls.id"
        class="cc-class"
        :selected="draft.classId === cls.id"
        :tabindex="classTabIndex(cls.id)"
        @keydown="onClassKeydown"
        @select="selectClass(cls.id)"
      >
        <span class="cc-class-glyph">
          <svg v-if="cls.id !== 'custom'" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="CLASS_GLYPHS[cls.id]"/>
          </svg>
          <svg v-else viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="6" y="6" width="16" height="16" rx="2"/><path d="M10 14 L14 14 M12 10 L12 18"/>
          </svg>
        </span>
        <span class="cc-class-name">{{ className(cls.id) }}</span>
        <span class="cc-class-tag">{{ classTagText(cls.id, cls.grantedSkillIds) }}</span>
      </SelectableTile>
    </div>
    <TextField
      v-if="draft.classId === 'custom'"
      :model-value="customClassField.value.value"
      variant="underline"
      hide-label
      :label="t('characterCreation.identity.classCustomNamePlaceholder')"
      :placeholder="t('characterCreation.identity.classCustomNamePlaceholder')"
      @update:model-value="customClassField.onInput"
      @blur="customClassField.flush()"
    />
  </WizardSection>
  </template>
</template>

<style scoped>
/* The true name reads as a name of power: italic gold. */
.cc-truename :deep(.form-field-control) { font-style: italic; color: var(--vtt-accent-soft); }
.cc-hint-icon { width: 11px; height: 11px; color: var(--vtt-accent-deep); flex-shrink: 0; }

.cc-attr-grid,
.cc-class-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s-2);
}
@container (max-width: 479px) {
  .cc-attr-grid,
  .cc-class-grid { grid-template-columns: repeat(2, 1fr); }
}
.cc-attr-roll-trace {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--vtt-text-muted);
  letter-spacing: 0.06em;
}
.cc-attr-roll-trace em {
  color: var(--vtt-text-secondary);
  font-style: normal;
}
.is-fresh { animation: cc-fresh 1400ms var(--ease); }
@keyframes cc-fresh {
  0%   { box-shadow: 0 0 0 2px var(--vtt-accent-a30); }
  100% { box-shadow: 0 0 0 2px var(--vtt-accent-a00); }
}
@media (prefers-reduced-motion: reduce) {
  .is-fresh { animation: none; }
}

.cc-class { gap: 6px; }
.cc-class-glyph {
  width: 28px;
  height: 28px;
  color: var(--vtt-accent-deep);
  margin-bottom: 2px;
}
[aria-checked='true'] .cc-class-glyph { color: var(--vtt-accent); }
.cc-class-glyph svg { width: 100%; height: 100%; }
.cc-class-name {
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1.1;
}
.cc-class-tag {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
</style>
