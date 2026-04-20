<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Character } from '@/types/character'
import { ABILITIES } from '@/types/character'
import AllAbilitiesDialog from '@/components/ui/AllAbilitiesDialog.vue'

const props = defineProps<{ char: Character }>()

const items = computed(() => ABILITIES.filter(a => props.char.abilityIds.includes(a.id)))
const expanded = ref<string | null>(null)
</script>

<template>
  <section class="panel">
    <div class="label-row">
      <div class="label">Способности</div>
      <AllAbilitiesDialog>
        <button class="all-btn" type="button">все</button>
      </AllAbilitiesDialog>
    </div>
    <ul class="list">
      <li v-for="ab in items" :key="ab.id" class="row">
        <button class="row__head" @click="expanded = expanded === ab.id ? null : ab.id">
          <span>{{ ab.name }}</span>
          <span>{{ expanded === ab.id ? '▾' : '▸' }}</span>
        </button>
        <div v-if="expanded === ab.id" class="row__desc">{{ ab.description }}</div>
      </li>
      <li v-if="!items.length" class="empty">—</li>
    </ul>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
.label-row { display: flex; align-items: center; justify-content: space-between; }
.all-btn { background: none; border: none; color: var(--color-text-muted); font-family: inherit; font-size: 12px; cursor: pointer; padding: 2px 4px; }
.all-btn:hover { color: var(--color-text); }
.list { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 4px; }
.row { border: 1px solid var(--color-border); border-radius: 4px; overflow: hidden; }
.row__head { width: 100%; display: flex; justify-content: space-between; padding: 8px 12px; background: var(--color-bg-elevated); border: none; color: var(--color-text); font-family: inherit; cursor: pointer; }
.row__desc { padding: 8px 12px; font-size: 13px; color: var(--color-text-muted); border-top: 1px solid var(--color-border); }
.empty { color: var(--color-text-muted); font-size: 13px; }
</style>
