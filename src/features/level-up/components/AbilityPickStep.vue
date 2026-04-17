<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, AbilityId } from '@/types/character'
import { ABILITIES } from '@/types/character'
import { CLASSES } from '@/data/classes'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ done: [id: AbilityId] }>()

const picked = ref<AbilityId | null>(null)

const available = computed(() => {
  const cls = CLASSES[props.char.classId]
  return ABILITIES.filter(a =>
    cls.abilityPool.includes(a.id) && !props.char.abilityIds.includes(a.id),
  )
})
</script>

<template>
  <section class="step">
    <div class="label">Выбери новую способность</div>
    <div class="list">
      <label v-for="a in available" :key="a.id" class="row" :class="{ 'row--picked': picked === a.id }">
        <input type="radio" :value="a.id" v-model="picked" />
        <div>
          <div class="name">{{ a.name }}</div>
          <div class="desc">{{ a.description }}</div>
        </div>
      </label>
      <div v-if="!available.length" class="empty">Весь класс-пул уже освоен.</div>
    </div>
    <button class="btn-primary" :disabled="!picked" @click="picked && emit('done', picked)">Принять</button>
  </section>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.list { display: flex; flex-direction: column; gap: 4px; }
.row { padding: 10px 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 3px; display: flex; align-items: flex-start; gap: 8px; cursor: pointer; }
.row--picked { border-color: var(--color-accent); }
.name { font-weight: 600; }
.desc { font-size: 12px; color: var(--color-text-muted); }
.empty { color: var(--color-text-muted); font-size: 13px; }
</style>
