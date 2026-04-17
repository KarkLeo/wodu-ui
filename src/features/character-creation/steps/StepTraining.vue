<script setup lang="ts">
import { computed } from 'vue'
import type { Character, SkillId, AbilityId, Spirit, Magic } from '@/types/character'
import { SKILLS, ABILITIES } from '@/types/character'
import { CLASSES } from '@/data/classes'
import { SPHERE_PRESETS } from '@/data/spheres'

const props = defineProps<{ draft: Character }>()
const emit = defineEmits<{ patch: [Partial<Character>]; next: [] }>()

const classData = computed(() => CLASSES[props.draft.classId])

const autoSkills = computed<SkillId[]>(() => classData.value.grantedSkillIds)
const autoAbilities = computed<AbilityId[]>(() => classData.value.autoAbilityIds ?? [])
const requiredAbilityPicks = computed(() => 2 - autoAbilities.value.length)
const abilityPool = computed<AbilityId[]>(() => classData.value.abilityPool)

const pickedSkills = computed(() =>
  props.draft.skillIds.filter(id => !autoSkills.value.includes(id)),
)
const pickedAbilities = computed(() =>
  props.draft.abilityIds.filter(id => !autoAbilities.value.includes(id)),
)

function toggleSkill(id: SkillId) {
  if (autoSkills.value.includes(id)) return
  const has = props.draft.skillIds.includes(id)
  let next: SkillId[]
  if (has) {
    next = props.draft.skillIds.filter(x => x !== id)
  } else {
    next = [...autoSkills.value, id]
  }
  emit('patch', { skillIds: next })
}

function toggleAbility(id: AbilityId) {
  if (autoAbilities.value.includes(id)) return
  if (!abilityPool.value.includes(id)) return
  const has = props.draft.abilityIds.includes(id)
  let nextPicked: AbilityId[]
  if (has) {
    nextPicked = pickedAbilities.value.filter(x => x !== id)
  } else {
    nextPicked = [...pickedAbilities.value, id]
    if (nextPicked.length > requiredAbilityPicks.value) {
      nextPicked = nextPicked.slice(nextPicked.length - requiredAbilityPicks.value)
    }
  }
  emit('patch', { abilityIds: [...autoAbilities.value, ...nextPicked] })
}

function syncAutos() {
  const skills = Array.from(new Set([...autoSkills.value, ...pickedSkills.value]))
  const abilities = Array.from(new Set([...autoAbilities.value, ...pickedAbilities.value.filter(a => abilityPool.value.includes(a))]))
  emit('patch', { skillIds: skills, abilityIds: abilities })
}

function ensureMagic(): Magic {
  if (props.draft.magic) return props.draft.magic
  const spirits: Spirit[] = [
    { id: crypto.randomUUID(), name: '', appearance: '', sphere1: '', sphere2: '' },
    { id: crypto.randomUUID(), name: '', appearance: '', sphere1: '', sphere2: '' },
  ]
  return { spirits, rituals: [], cantrips: [] }
}

function updateSpirit(idx: number, patchSp: Partial<Spirit>) {
  const magic = ensureMagic()
  const spirits = magic.spirits.map((s, i) => (i === idx ? { ...s, ...patchSp } : s))
  emit('patch', { magic: { ...magic, spirits } })
}

function updateRitual(idx: number, value: string) {
  const magic = ensureMagic()
  const rituals = [...(magic.rituals ?? [])]
  while (rituals.length < 2) rituals.push('')
  rituals[idx] = value
  emit('patch', { magic: { ...magic, rituals } })
}

const showMagic = computed(() => props.draft.classId === 'wizard')
const hasIncantations = computed(() => pickedAbilities.value.includes('incantations'))
const hasRitual = computed(() => pickedAbilities.value.includes('ritual'))

const canContinue = computed(() => {
  if (pickedSkills.value.length !== 1) return false
  if (pickedAbilities.value.length !== requiredAbilityPicks.value) return false
  if (showMagic.value) {
    const magic = props.draft.magic
    if (!magic || magic.spirits.length < 2) return false
    for (const s of magic.spirits) {
      if (!s.name.trim() || !s.appearance.trim() || !s.sphere1.trim() || !s.sphere2.trim()) return false
    }
    if (hasRitual.value) {
      const rituals = magic.rituals ?? []
      if (rituals.filter(r => r.trim()).length < 2) return false
    }
  }
  return true
})

syncAutos()

if (hasIncantations.value) {
  const magic = ensureMagic()
  if (!magic.cantrips?.length) {
    emit('patch', { magic: { ...magic, cantrips: ['Свеча', 'Тень', 'Чревовещание'] } })
  }
}
</script>

<template>
  <div class="step">
    <section class="block">
      <div class="label">Навыки</div>
      <p class="hint">Автоматические — от класса. Выбери ровно 1 дополнительный.</p>
      <div class="checklist">
        <label
          v-for="sk in SKILLS"
          :key="sk.id"
          class="check"
          :class="{ 'check--auto': autoSkills.includes(sk.id), 'check--picked': draft.skillIds.includes(sk.id) }"
        >
          <input
            type="checkbox"
            :checked="draft.skillIds.includes(sk.id)"
            :disabled="autoSkills.includes(sk.id)"
            @change="toggleSkill(sk.id)"
          />
          {{ sk.name }}
        </label>
      </div>
    </section>

    <section class="block">
      <div class="label">Способности</div>
      <p class="hint">
        Выбери {{ requiredAbilityPicks }} из {{ abilityPool.length }} доступных класса.
        <span v-if="autoAbilities.length">Автоматически: {{ autoAbilities.map(id => ABILITIES.find(a => a.id === id)?.name).join(', ') }}.</span>
      </p>
      <div class="checklist">
        <label
          v-for="ab in ABILITIES"
          :key="ab.id"
          class="check"
          :class="{
            'check--auto': autoAbilities.includes(ab.id),
            'check--disabled': !autoAbilities.includes(ab.id) && !abilityPool.includes(ab.id),
            'check--picked': draft.abilityIds.includes(ab.id),
          }"
          :title="ab.description"
        >
          <input
            type="checkbox"
            :checked="draft.abilityIds.includes(ab.id)"
            :disabled="autoAbilities.includes(ab.id) || !abilityPool.includes(ab.id)"
            @change="toggleAbility(ab.id)"
          />
          <span class="check__main">
            <span class="check__name">{{ ab.name }}</span>
            <span class="check__desc">{{ ab.description }}</span>
          </span>
        </label>
      </div>
    </section>

    <section v-if="showMagic" class="block">
      <div class="label">Магия</div>
      <p class="hint">Волшебник начинает с двумя известными духами.</p>
      <div v-for="(sp, idx) in (draft.magic?.spirits ?? [])" :key="sp.id" class="spirit">
        <div class="label">Дух {{ idx + 1 }}</div>
        <input class="input" placeholder="Имя" :value="sp.name" @input="updateSpirit(idx, { name: ($event.target as HTMLInputElement).value })" />
        <input class="input" placeholder="Облик" :value="sp.appearance" @input="updateSpirit(idx, { appearance: ($event.target as HTMLInputElement).value })" />
        <div class="spirit__spheres">
          <label class="sphere">
            <span>Сфера 1</span>
            <input class="input" list="sphere-presets" :value="sp.sphere1" @input="updateSpirit(idx, { sphere1: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="sphere">
            <span>Сфера 2</span>
            <input class="input" list="sphere-presets" :value="sp.sphere2" @input="updateSpirit(idx, { sphere2: ($event.target as HTMLInputElement).value })" />
          </label>
        </div>
      </div>
      <datalist id="sphere-presets">
        <option v-for="s in SPHERE_PRESETS" :key="s" :value="s" />
      </datalist>

      <div v-if="hasRitual" class="rituals">
        <div class="label">Стартовые ритуалы (2)</div>
        <input
          v-for="i in 2"
          :key="i"
          class="input"
          :placeholder="`Ритуал ${i}`"
          :value="(draft.magic?.rituals ?? [])[i - 1] ?? ''"
          @input="updateRitual(i - 1, ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div v-if="hasIncantations" class="cantrips">
        <div class="label">Заклички</div>
        <p class="hint">Свеча · Тень · Чревовещание</p>
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
.hint { font-size: 12px; color: var(--color-text-muted); margin: 0; }
.checklist { display: flex; flex-direction: column; gap: 4px; }
.check { display: flex; align-items: flex-start; gap: 8px; padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; }
.check--auto { opacity: 0.7; cursor: default; }
.check--disabled { opacity: 0.3; cursor: not-allowed; }
.check--picked { border-color: var(--color-accent); }
.check__main { display: flex; flex-direction: column; gap: 2px; }
.check__name { font-weight: 600; }
.check__desc { font-size: 12px; color: var(--color-text-muted); }
.spirit { display: flex; flex-direction: column; gap: 6px; padding: 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; margin-bottom: 10px; }
.spirit__spheres { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sphere { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--color-text-muted); }
.input { width: 100%; padding: 8px; background: var(--color-bg-dark); border: 1px solid var(--color-border); color: var(--color-text); font-family: inherit; font-size: 14px; border-radius: 4px; }
.rituals, .cantrips { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
