<script setup lang="ts">
import type { Character } from '@/types/character'

defineProps<{ char: Character }>()
defineEmits<{ back: [] }>()
</script>

<template>
  <div class="header">
    <button class="btn-ghost" @click="$emit('back')">← Список</button>
    <div class="header__center">
      <div class="label">Воин · Уровень {{ char.level }}</div>
      <div class="header__name">{{ char.name }}</div>
    </div>
    <div class="header__right">
      <div class="label">{{ char.damageDice }}</div>
      <div class="label">броня {{ char.armor }}</div>
    </div>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
}
.header__center { text-align: center; }
.header__name { font-size: 18px; font-weight: 700; }
.header__right { text-align: right; }
</style>
