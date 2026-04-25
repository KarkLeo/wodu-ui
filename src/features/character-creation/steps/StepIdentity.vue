<script setup lang="ts">
import { ref } from 'vue'
import type { Character, ClassId, StatKey } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { CLASS_LIST } from '@/data/classes'
import { STAT_KEYS, STAT_LABELS } from '@/data/xpTable'
import { SKILLS } from '@/types/character'
import { statBonusFrom2d6 } from '@/utils/derived'
import { useDiceRoller, isRolling } from '@/composables/useDiceRoller'
import { t } from '@/locales'

const props = defineProps<{ draft: Character; dispatch: (cmd: CharacterCommand) => void }>()
const emit = defineEmits<{ patch: [Partial<Character>] }>()

const { roll } = useDiceRoller()
const freshKey = ref<StatKey | null>(null)
const diceTraces = ref<Partial<Record<StatKey, [number, number]>>>({})
let freshTimer: number | null = null

function markFresh(key: StatKey) {
  freshKey.value = key
  if (freshTimer) window.clearTimeout(freshTimer)
  freshTimer = window.setTimeout(() => { freshKey.value = null }, 1400)
}

async function rollAll() {
  for (const key of STAT_KEYS) {
    await rerollOne(key)
  }
}

async function rerollOne(key: StatKey) {
  const result = await roll({
    notation: '2d6',
    label: `${STAT_LABELS[key]} (2d6)`,
    purpose: { kind: 'stat', statKey: key, statBonus: 0 },
    characterId: props.draft.id,
    characterName: props.draft.name || 'Новый персонаж',
  })
  if (!result) return
  const r = result.diceTotal
  const values = result.dice.map(d => d.value)
  if (values.length === 2) diceTraces.value[key] = [values[0], values[1]]
  emit('patch', { statRolls: { ...props.draft.statRolls, [key]: r } })
  props.dispatch({ type: 'UPDATE_STATS', stats: { ...props.draft.stats, [key]: statBonusFrom2d6(r) } })
  markFresh(key)
}

function selectClass(id: ClassId) {
  if (id === props.draft.classId) return
  const patch: Partial<Character> = { classId: id, skillIds: [], abilityIds: [], magic: undefined }
  if (id !== 'custom') patch.customClassName = undefined
  emit('patch', patch)
}

function skillName(id: string): string {
  return SKILLS.find(s => s.id === id)?.name ?? id
}

function classTagText(classId: ClassId, grantedSkillIds: readonly string[]): string {
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
  return props.draft.statRolls[key] ?? 0
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
  <section class="cc-section cc-section--names">
    <div class="cc-field">
      <label class="cc-field-label" for="cc-name-input">
        {{ t('characterCreation.identity.nameLabel') }}
      </label>
      <input
        id="cc-name-input"
        class="cc-input"
        type="text"
        :placeholder="t('characterCreation.identity.namePlaceholder')"
        :value="draft.name"
        @input="emit('patch', { name: ($event.target as HTMLInputElement).value })"
      />
    </div>
    <div class="cc-field">
      <label class="cc-field-label" for="cc-truename-input">
        {{ t('characterCreation.identity.trueNameLabel') }}
        <span class="opt">{{ t('characterCreation.identity.trueNameOpt') }}</span>
      </label>
      <input
        id="cc-truename-input"
        class="cc-input is-truename"
        type="text"
        :placeholder="t('characterCreation.identity.trueNamePlaceholder')"
        :value="draft.trueName ?? ''"
        @input="emit('patch', { trueName: ($event.target as HTMLInputElement).value })"
      />
      <span class="cc-field-hint">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M6 1.5 C3 1.5 1 4 1 6 C1 8 3 10.5 6 10.5 C9 10.5 11 8 11 6 C11 4 9 1.5 6 1.5 Z"/><circle cx="6" cy="6" r="1.6" fill="currentColor"/></svg>
        {{ t('characterCreation.identity.trueNameHint') }}
      </span>
    </div>
  </section>

  <section class="cc-section">
    <div class="cc-section-head">
      <span class="cc-section-label">{{ t('characterCreation.identity.attrsLabel') }}</span>
      <span class="cc-section-hint">{{ t('characterCreation.identity.attrsHint') }}</span>
      <span class="cc-section-action">
        <button type="button" class="cc-btn-roll" :disabled="isRolling" @click="rollAll">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1"/><circle cx="4.5" cy="4.5" r="0.6" fill="currentColor"/><circle cx="7.5" cy="4.5" r="0.6" fill="currentColor"/><circle cx="6" cy="6" r="0.6" fill="currentColor"/><circle cx="4.5" cy="7.5" r="0.6" fill="currentColor"/><circle cx="7.5" cy="7.5" r="0.6" fill="currentColor"/></svg>
          {{ t('characterCreation.shell.rollAll') }}
        </button>
      </span>
    </div>
    <div class="cc-attr-grid">
      <div
        v-for="key in STAT_KEYS"
        :key="key"
        :class="[
          'cc-attr',
          { 'cc-attr-empty': !draft.statRolls[key], 'is-max': draft.statRolls[key] === 12, 'is-fresh': freshKey === key },
        ]"
      >
        <span class="cc-attr-label">{{ STAT_LABELS[key] }}</span>
        <button
          type="button"
          class="cc-attr-roll"
          :disabled="isRolling"
          :title="t('characterCreation.identity.attrRollTitle')"
          @click="rerollOne(key)"
        >
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M3 7 C3 4 5 3 7 3 M11 7 C11 10 9 11 7 11 M11 7 L13 5 M11 7 L9 5"/></svg>
        </button>
        <div class="cc-attr-value">
          <span class="cc-attr-mod">
            {{ draft.statRolls[key] ? (draft.stats[key] > 0 ? `+${draft.stats[key]}` : '0') : '—' }}
          </span>
          <span v-if="rollTrace(key)" class="cc-attr-roll-trace">
            2d6: <em>{{ rollTrace(key)!.a }} + {{ rollTrace(key)!.b }}</em>
          </span>
          <span v-else-if="rollTotal(key)" class="cc-attr-roll-trace">
            2d6: <em>{{ rollTotal(key) }}</em>
          </span>
          <span v-else class="cc-attr-roll-trace">{{ t('characterCreation.identity.attrEmpty') }}</span>
        </div>
      </div>
    </div>
  </section>

  <section class="cc-section">
    <div class="cc-section-head">
      <span class="cc-section-label">{{ t('characterCreation.identity.classLabel') }}</span>
      <span class="cc-section-hint">{{ t('characterCreation.identity.classHint') }}</span>
    </div>
    <div class="cc-class-grid">
      <button
        v-for="cls in CLASS_LIST"
        :key="cls.id"
        type="button"
        :class="['cc-class', { 'is-selected': draft.classId === cls.id }]"
        @click="selectClass(cls.id)"
      >
        <span class="cc-class-glyph">
          <svg v-if="cls.id !== 'custom'" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="CLASS_GLYPHS[cls.id]"/>
          </svg>
          <svg v-else viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="6" y="6" width="16" height="16" rx="2"/><path d="M10 14 L14 14 M12 10 L12 18"/>
          </svg>
        </span>
        <span class="cc-class-name">{{ t(`characterCreation.classNames.${cls.id}`) }}</span>
        <span class="cc-class-tag">{{ classTagText(cls.id, cls.grantedSkillIds) }}</span>
      </button>
    </div>
    <input
      v-if="draft.classId === 'custom'"
      class="cc-input"
      type="text"
      :placeholder="t('characterCreation.identity.classCustomNamePlaceholder')"
      :value="draft.customClassName ?? ''"
      @input="emit('patch', { customClassName: ($event.target as HTMLInputElement).value })"
    />
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

.cc-section--names { gap: var(--s-4); }
.cc-field { display: flex; flex-direction: column; gap: 2px; }
.cc-field-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.cc-field-label .opt {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11px;
  letter-spacing: 0;
  text-transform: none;
  color: var(--vtt-text-muted);
}
.cc-input {
  font-family: var(--font-serif);
  font-size: 18px;
  padding: 8px 4px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(140, 106, 58, 0.3);
  color: var(--vtt-text-primary);
  outline: none;
  transition: border-color var(--t-fast) var(--ease);
}
.cc-input::placeholder { color: var(--vtt-text-muted); font-style: italic; }
.cc-input:focus { border-bottom-color: var(--vtt-accent); }
.cc-input.is-truename {
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--vtt-accent-soft);
}
.cc-field-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11px;
  color: var(--vtt-text-muted);
  margin-top: 6px;
}
.cc-field-hint svg { width: 11px; height: 11px; color: var(--vtt-accent-deep); flex-shrink: 0; }

.cc-btn-roll {
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
.cc-btn-roll:hover:not(:disabled) {
  background: rgba(140, 106, 58, 0.2);
  border-color: var(--vtt-border-gold);
}
.cc-btn-roll:disabled { opacity: 0.5; cursor: not-allowed; }
.cc-btn-roll svg { width: 12px; height: 12px; }

.cc-attr-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s-2);
}
@media (max-width: 479px) {
  .cc-attr-grid { grid-template-columns: repeat(2, 1fr); }
}
.cc-attr {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas:
    "label label roll"
    "value value value";
  column-gap: 8px;
  padding: 10px 12px 12px;
  border-radius: var(--r-md);
  background: rgba(36, 28, 21, 0.4);
  transition: background var(--t-fast) var(--ease);
}
.cc-attr:hover { background: rgba(36, 28, 21, 0.65); }
.cc-attr-label {
  grid-area: label;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  line-height: 1;
}
.cc-attr-roll {
  grid-area: roll;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 0;
  color: var(--vtt-text-muted);
  cursor: pointer;
  border-radius: var(--r-pill);
  transition: color var(--t-fast) var(--ease);
}
.cc-attr-roll:hover:not(:disabled) { color: var(--vtt-accent); }
.cc-attr-roll:disabled { cursor: not-allowed; opacity: 0.4; }
.cc-attr-roll svg { width: 14px; height: 14px; }
.cc-attr-value {
  grid-area: value;
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 2px;
}
.cc-attr-mod {
  font-family: var(--font-serif);
  font-size: 32px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
}
.cc-attr-empty .cc-attr-mod { color: var(--vtt-text-muted); }
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
.cc-attr.is-fresh { animation: cc-fresh 1400ms var(--ease); }
.cc-attr.is-max .cc-attr-mod {
  color: var(--vtt-accent);
  text-shadow: 0 0 12px rgba(212, 168, 87, 0.4);
}
@keyframes cc-fresh {
  0%   { box-shadow: 0 0 0 2px rgba(212, 168, 87, 0.3); }
  100% { box-shadow: 0 0 0 2px rgba(212, 168, 87, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .cc-attr.is-fresh { animation: none; }
}

.cc-class-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s-2);
}
@media (max-width: 479px) {
  .cc-class-grid { grid-template-columns: repeat(2, 1fr); }
}
.cc-class {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 14px 16px;
  background: rgba(36, 28, 21, 0.4);
  border: 1px solid transparent;
  border-radius: var(--r-md);
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
  text-align: left;
  font-family: inherit;
  color: inherit;
}
.cc-class:hover { background: rgba(36, 28, 21, 0.7); }
.cc-class.is-selected {
  background: rgba(140, 106, 58, 0.18);
  border-color: rgba(140, 106, 58, 0.55);
}
.cc-class-glyph {
  width: 28px;
  height: 28px;
  color: var(--vtt-accent-deep);
  margin-bottom: 2px;
}
.cc-class.is-selected .cc-class-glyph { color: var(--vtt-accent); }
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
