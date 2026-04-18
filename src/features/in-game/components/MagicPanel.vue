<script setup lang="ts">
import type { Character, Ritual, Spirit, Magic } from '@/types/character'
import type { AbilityId } from '@/types/character'
import { SPHERE_PRESETS } from '@/data/spheres'

const props = defineProps<{ char: Character; abilityIds: AbilityId[] }>()
const emit = defineEmits<{ patch: [Partial<Character>] }>()

function ensureMagic(): Magic {
  const m = props.char.magic ?? { spirits: [], rituals: [], cantrips: [] }
  // migrate legacy string[] rituals
  const rituals = m.rituals.map(r =>
    typeof r === 'string' ? { name: r as string, description: '' } : r,
  ) as Ritual[]
  return { ...m, rituals }
}

function updateSpirit(idx: number, patch: Partial<Spirit>) {
  const magic = ensureMagic()
  const spirits = magic.spirits.map((s, i) => (i === idx ? { ...s, ...patch } : s))
  emit('patch', { magic: { ...magic, spirits } })
}

function addSpirit() {
  const magic = ensureMagic()
  emit('patch', {
    magic: {
      ...magic,
      spirits: [...magic.spirits, { id: crypto.randomUUID(), name: '', appearance: '', sphere1: '', sphere2: '' }],
    },
  })
}

function removeSpirit(id: string) {
  const magic = ensureMagic()
  emit('patch', { magic: { ...magic, spirits: magic.spirits.filter(s => s.id !== id) } })
}

function updateRitual(idx: number, patch: Partial<Ritual>) {
  const magic = ensureMagic()
  const rituals = magic.rituals.map((r, i) => (i === idx ? { ...r, ...patch } : r))
  emit('patch', { magic: { ...magic, rituals } })
}

function addRitual() {
  const magic = ensureMagic()
  emit('patch', { magic: { ...magic, rituals: [...magic.rituals, { name: '', description: '' }] } })
}

function removeRitual(idx: number) {
  const magic = ensureMagic()
  emit('patch', { magic: { ...magic, rituals: magic.rituals.filter((_, i) => i !== idx) } })
}
</script>

<template>
  <section class="panel">
    <div v-if="abilityIds.includes('summoning')" class="group">
      <div class="label-row">
        <span class="label">Духи</span>
        <button class="btn-ghost" @click="addSpirit">+ Дух</button>
      </div>
      <div v-for="(sp, idx) in (char.magic?.spirits ?? [])" :key="sp.id" class="spirit">
        <input class="input" placeholder="Имя" :value="sp.name" @input="updateSpirit(idx, { name: ($event.target as HTMLInputElement).value })" />
        <input class="input" placeholder="Облик" :value="sp.appearance" @input="updateSpirit(idx, { appearance: ($event.target as HTMLInputElement).value })" />
        <div class="spheres">
          <input class="input" list="sphere-presets" placeholder="Сфера 1" :value="sp.sphere1" @input="updateSpirit(idx, { sphere1: ($event.target as HTMLInputElement).value })" />
          <input class="input" list="sphere-presets" placeholder="Сфера 2" :value="sp.sphere2" @input="updateSpirit(idx, { sphere2: ($event.target as HTMLInputElement).value })" />
        </div>
        <button class="btn-mini" @click="removeSpirit(sp.id)">Удалить</button>
      </div>
      <datalist id="sphere-presets">
        <option v-for="s in SPHERE_PRESETS" :key="s" :value="s" />
      </datalist>
    </div>

    <div v-if="abilityIds.includes('ritual')" class="group">
      <div class="label-row">
        <span class="label">Ритуалы</span>
        <button class="btn-ghost" @click="addRitual">+ Ритуал</button>
      </div>
      <div v-for="(r, idx) in (char.magic?.rituals ?? [])" :key="idx" class="ritual">
        <div class="ritual-header">
          <input
            class="input"
            placeholder="Название"
            :value="r.name"
            @input="updateRitual(idx, { name: ($event.target as HTMLInputElement).value })"
          />
          <button class="btn-mini" @click="removeRitual(idx)">×</button>
        </div>
        <textarea
          class="input textarea"
          placeholder="Описание"
          rows="3"
          :value="r.description"
          @input="updateRitual(idx, { description: ($event.target as HTMLTextAreaElement).value })"
        />
      </div>
    </div>

    <div v-if="abilityIds.includes('incantations') && (char.magic?.cantrips?.length ?? 0) > 0" class="group">
      <div class="label">Заклички</div>
      <ul class="cantrips">
        <li v-for="c in char.magic?.cantrips" :key="c">{{ c }}</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; display: flex; flex-direction: column; gap: 18px; }
.group { display: flex; flex-direction: column; gap: 6px; }
.label-row { display: flex; justify-content: space-between; align-items: center; }
.spirit { display: flex; flex-direction: column; gap: 4px; padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; margin-bottom: 6px; }
.ritual { display: flex; flex-direction: column; gap: 4px; padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; margin-bottom: 6px; }
.ritual-header { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; }
.spheres { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.input { padding: 6px 10px; background: var(--color-bg-dark); border: 1px solid var(--color-border); color: var(--color-text); border-radius: 3px; font-family: inherit; font-size: 13px; }
.textarea { resize: vertical; width: 100%; box-sizing: border-box; }
.btn-mini { background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 12px; }
.cantrips { list-style: disc; padding-left: 18px; color: var(--color-text-muted); font-size: 13px; }
</style>
