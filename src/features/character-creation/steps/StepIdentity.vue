<script setup lang="ts">
import { computed } from 'vue'
import type { Character, ClassId, StatKey } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { CLASS_LIST } from '@/data/classes'
import { STAT_KEYS, STAT_LABELS } from '@/data/xpTable'
import { statBonusFrom2d6 } from '@/utils/derived'
import { useDiceRoller, isRolling } from '@/composables/useDiceRoller'

const props = defineProps<{ draft: Character; dispatch: (cmd: CharacterCommand) => void }>()
const emit = defineEmits<{ patch: [Partial<Character>]; next: [] }>()

const { roll } = useDiceRoller()

const rolled = computed(() => STAT_KEYS.every(k => props.draft.statRolls[k] > 0))

async function rollAll() {
  const rolls: Record<StatKey, number> = { ...props.draft.statRolls }
  const stats: Record<StatKey, number> = { ...props.draft.stats }
  for (const key of STAT_KEYS) {
    const result = await roll({
      notation: '2d6',
      label: `${STAT_LABELS[key]} (2d6)`,
      purpose: { kind: 'stat', statKey: key, statBonus: 0 },
      characterId: props.draft.id,
      characterName: props.draft.name || 'Новый персонаж',
    })
    if (!result) return
    rolls[key] = result.diceTotal
    stats[key] = statBonusFrom2d6(result.diceTotal)
    emit('patch', { statRolls: { ...rolls } })
    props.dispatch({ type: 'UPDATE_STATS', stats: { ...stats } })
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
  emit('patch', { statRolls: { ...props.draft.statRolls, [key]: r } })
  props.dispatch({ type: 'UPDATE_STATS', stats: { ...props.draft.stats, [key]: statBonusFrom2d6(r) } })
}

function setStatManual(key: StatKey, value: number) {
  const v = Math.max(0, Math.min(3, value))
  props.dispatch({ type: 'UPDATE_STATS', stats: { ...props.draft.stats, [key]: v } })
}

function selectClass(id: ClassId) {
  if (id === props.draft.classId) return
  const patch: Partial<Character> = { classId: id, skillIds: [], abilityIds: [], magic: undefined }
  if (id !== 'custom') patch.customClassName = undefined
  emit('patch', patch)
}

const canContinue = computed(() => {
  if (!props.draft.name.trim() || !rolled.value) return false
  if (props.draft.classId === 'custom' && !props.draft.customClassName?.trim()) return false
  return true
})
</script>

<template>
  <div class="step">
    <section class="block">
      <label class="label">Имя</label>
      <input
        class="input"
        :value="draft.name"
        @input="emit('patch', { name: ($event.target as HTMLInputElement).value })"
        placeholder="Имя персонажа"
      />
      <label class="label">Истинное имя (опционально)</label>
      <input
        class="input"
        :value="draft.trueName ?? ''"
        @input="emit('patch', { trueName: ($event.target as HTMLInputElement).value })"
        placeholder="Имя, дающее силу"
      />
    </section>

    <section class="block">
      <div class="label">Класс</div>
      <div class="class-grid">
        <button
          v-for="cls in CLASS_LIST"
          :key="cls.id"
          class="class-card"
          :class="{ 'class-card--active': draft.classId === cls.id }"
          @click="selectClass(cls.id)"
        >
          {{ cls.name }}
        </button>
      </div>
      <input
        v-if="draft.classId === 'custom'"
        class="input"
        :value="draft.customClassName ?? ''"
        @input="emit('patch', { customClassName: ($event.target as HTMLInputElement).value })"
        placeholder="Название класса"
      />
    </section>

    <section class="block">
      <div class="block-header">
        <span class="label">Характеристики</span>
        <button class="btn-ghost" :disabled="isRolling" @click="rollAll">Бросить все 2d6</button>
      </div>
      <div class="stats">
        <div v-for="key in STAT_KEYS" :key="key" class="stat">
          <div class="stat__head">
            <span class="stat__name">{{ STAT_LABELS[key] }}</span>
            <button class="btn-mini" :disabled="isRolling" @click="rerollOne(key)" title="Перебросить">🎲</button>
          </div>
          <div class="stat__roll">Бросок: {{ draft.statRolls[key] || '—' }}</div>
          <input
            type="number"
            class="input stat__input"
            :value="draft.stats[key]"
            min="0"
            max="3"
            @input="setStatManual(key, Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>
    </section>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!canContinue" @click="emit('next')">Далее →</button>
    </div>
  </div>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
.block { display: flex; flex-direction: column; gap: 8px; }
.block-header { display: flex; justify-content: space-between; align-items: center; }
.input { width: 100%; padding: 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); font-family: inherit; font-size: 15px; border-radius: 4px; }
.class-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.class-card { padding: 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); font-family: inherit; cursor: pointer; border-radius: 4px; }
.class-card--active { border-color: var(--color-accent); color: var(--color-accent); }
.stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.stat { padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; }
.stat__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.stat__name { font-weight: 600; }
.stat__roll { font-size: 12px; color: var(--color-text-muted); margin-bottom: 6px; }
.stat__input { text-align: center; }
.btn-mini { background: none; border: none; cursor: pointer; font-size: 18px; padding: 0; color: inherit; }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
