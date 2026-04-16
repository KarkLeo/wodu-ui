<script setup lang="ts">
import { ref, computed } from 'vue'
import fighter from '@/data/classes/fighter'
import type { Character } from '@/types/character'

const props = defineProps<{ draft: Character }>()
const emit = defineEmits<{
  patch: [data: Partial<Character>]
  next: []
}>()

const name = ref(props.draft.name)
const selectedLooks = ref<Record<string, string>>(
  Object.fromEntries(fighter.looks.map(l => [l.category, '']))
)
const race = ref(props.draft.race)
const alignment = ref(props.draft.alignment)

const lookString = computed(() =>
  Object.values(selectedLooks.value).filter(Boolean).join(', ')
)

const canProceed = computed(() =>
  name.value.trim().length > 0 && race.value && alignment.value
)

function proceed() {
  emit('patch', {
    name: name.value.trim(),
    look: lookString.value,
    race: race.value,
    alignment: alignment.value,
  })
  emit('next')
}
</script>

<template>
  <div class="step-wrap">
    <h2 class="step-title">Личность</h2>

    <!-- Имя -->
    <div class="field">
      <label class="label">Имя</label>
      <input class="text-input" v-model="name" placeholder="Имя персонажа" maxlength="40" />
    </div>

    <!-- Внешность -->
    <div class="field">
      <div class="label" style="margin-bottom: 8px">Внешность</div>
      <div v-for="look in fighter.looks" :key="look.category" class="look-group">
        <div class="label" style="margin-bottom: 6px; opacity: 0.6">{{ look.category }}</div>
        <div class="option-row">
          <button
            v-for="opt in look.options"
            :key="opt"
            class="option-chip"
            :class="{ 'option-chip--selected': selectedLooks[look.category] === opt }"
            @click="selectedLooks[look.category] = opt"
          >{{ opt }}</button>
        </div>
      </div>
    </div>

    <!-- Раса -->
    <div class="field">
      <div class="label" style="margin-bottom: 8px">Раса</div>
      <div class="choice-list">
        <button
          v-for="r in fighter.races"
          :key="r.id"
          class="choice-item"
          :class="{ 'choice-item--selected': race === r.id }"
          @click="race = r.id"
        >
          <span class="choice-item__name">{{ r.name }}</span>
          <span class="choice-item__hint">+ход: {{ fighter.moves.find(m => m.id === r.moveId)?.name }}</span>
        </button>
      </div>
    </div>

    <!-- Мировоззрение -->
    <div class="field">
      <div class="label" style="margin-bottom: 8px">Мировоззрение</div>
      <div class="choice-list">
        <button
          v-for="a in fighter.alignments"
          :key="a.id"
          class="choice-item"
          :class="{ 'choice-item--selected': alignment === a.id }"
          @click="alignment = a.id"
        >
          <span class="choice-item__name">{{ a.name }}</span>
          <span class="choice-item__hint">XP: {{ a.trigger }}</span>
        </button>
      </div>
    </div>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!canProceed" @click="proceed">Далее →</button>
    </div>
  </div>
</template>

<style scoped>
.step-wrap { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
.step-title { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.field { display: flex; flex-direction: column; gap: 8px; }
.text-input {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: inherit;
  font-size: 16px;
  padding: 10px 12px;
  border-radius: var(--border-radius);
  width: 100%;
}
.text-input::placeholder { color: var(--color-text-muted); opacity: 0.5; }
.text-input:focus { outline: none; border-color: var(--color-accent); }
.look-group { margin-bottom: 10px; }
.option-row { display: flex; flex-wrap: wrap; gap: 6px; }
.option-chip {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  padding: 5px 10px;
  border-radius: 20px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}
.option-chip--selected { border-color: var(--color-accent); color: var(--color-accent); }
.choice-list { display: flex; flex-direction: column; gap: 6px; }
.choice-item {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 10px 12px;
  text-align: left;
  border-radius: var(--border-radius);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.choice-item--selected { border-color: var(--color-accent); background: var(--color-bg-elevated); }
.choice-item__name { font-size: 14px; font-weight: 600; }
.choice-item__hint { font-size: 11px; color: var(--color-text-muted); }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
