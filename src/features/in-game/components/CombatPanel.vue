<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '@/types/character'
import { damageFormula, totalArmor, armorLabel, isWeapon } from '@/utils/derived'

const props = defineProps<{ char: Character }>()

const weapons = computed(() => props.char.inventory.filter(isWeapon))
const armor = computed(() => totalArmor(props.char))
</script>

<template>
  <section class="panel">
    <div class="label">Бой</div>
    <div class="summary">
      <div>Броня: <b>{{ armor }}</b> ({{ armorLabel(char.armor) }})</div>
      <div v-if="char.damageBonusDice > 0">Бонус костей урона: <b>+{{ char.damageBonusDice }}d6</b></div>
    </div>
    <div v-if="weapons.length" class="weapons">
      <div v-for="w in weapons" :key="w.id" class="weapon">
        <div class="weapon__name">{{ w.name }}</div>
        <div class="weapon__dmg">{{ damageFormula(char, w) }}</div>
      </div>
    </div>
    <div v-else class="empty">Нет оружия в инвентаре.</div>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
.summary { display: flex; gap: 16px; margin-top: 6px; font-size: 13px; color: var(--color-text-muted); }
.weapons { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.weapon { display: flex; justify-content: space-between; padding: 8px 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; }
.weapon__name { font-weight: 600; }
.weapon__dmg { font-family: monospace; }
.empty { margin-top: 6px; color: var(--color-text-muted); font-size: 13px; }
</style>
