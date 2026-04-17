<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, SkillId } from '@/types/character'
import { SKILLS } from '@/types/character'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ done: [id: SkillId] }>()

const picked = ref<SkillId | null>(null)
const available = computed(() => SKILLS.filter(s => !props.char.skillIds.includes(s.id)))
</script>

<template>
  <section class="step">
    <div class="label">Выбери новый навык</div>
    <div class="list">
      <label v-for="s in available" :key="s.id" class="row" :class="{ 'row--picked': picked === s.id }">
        <input type="radio" :value="s.id" v-model="picked" />
        {{ s.name }}
      </label>
      <div v-if="!available.length" class="empty">Все навыки уже освоены.</div>
    </div>
    <button class="btn-primary" :disabled="!picked" @click="picked && emit('done', picked)">Принять</button>
  </section>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.list { display: flex; flex-direction: column; gap: 4px; }
.row { padding: 10px 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 3px; display: flex; align-items: center; gap: 8px; cursor: pointer; }
.row--picked { border-color: var(--color-accent); }
.empty { color: var(--color-text-muted); font-size: 13px; }
</style>
