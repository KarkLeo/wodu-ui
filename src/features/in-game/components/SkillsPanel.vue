<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '@/types/character'
import { SKILLS } from '@/types/character'

const props = defineProps<{ char: Character }>()

const items = computed(() =>
  SKILLS.filter(s => props.char.skillIds.includes(s.id))
)
</script>

<template>
  <section class="panel">
    <div class="label">Навыки</div>
    <ul class="list">
      <li v-for="sk in items" :key="sk.id" class="row">{{ sk.name }}</li>
      <li v-if="!items.length" class="empty">—</li>
    </ul>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
.list { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-wrap: wrap; gap: 6px; }
.row { padding: 4px 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 3px; font-size: 13px; }
.empty { color: var(--color-text-muted); font-size: 13px; }
</style>
