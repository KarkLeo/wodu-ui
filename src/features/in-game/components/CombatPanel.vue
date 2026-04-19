<script setup lang="ts">
import { computed } from 'vue'
import type { Character, ArmorType } from '@/types/character'
import { damageFormula, isWeapon } from '@/utils/derived'
import DamageBreakdownPopover from '@/components/ui/DamageBreakdownPopover.vue'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [Partial<Character>] }>()

const weapons = computed(() => props.char.inventory.filter(isWeapon))
const anyEquipped = computed(() => weapons.value.some(w => w.equipped))

function setArmorType(type: ArmorType) {
  emit('patch', { armor: { ...props.char.armor, type } })
}
function toggleShield() {
  emit('patch', { armor: { ...props.char.armor, shield: !props.char.armor.shield } })
}
</script>

<template>
  <section class="panel">
    <div class="label">Доспех</div>
    <div class="armor-grid">
      <button :class="{ active: char.armor.type === 'none' }" @click="setArmorType('none')">Без</button>
      <button :class="{ active: char.armor.type === 'light' }" @click="setArmorType('light')">Лёгкий</button>
      <button :class="{ active: char.armor.type === 'full' }" @click="setArmorType('full')">Полный</button>
    </div>
    <label class="shield"><input type="checkbox" :checked="char.armor.shield" @change="toggleShield" /> Щит</label>

    <div class="label weapons-label">Оружие</div>
    <div v-if="char.damageBonusDice > 0" class="dmg-bonus">Бонус костей урона: <b>+{{ char.damageBonusDice }}d6</b></div>
    <div v-if="weapons.length" class="weapons" :class="{ 'weapons--has-equipped': anyEquipped }">
      <div
        v-for="w in weapons"
        :key="w.id"
        class="weapon"
        :class="{ 'weapon--equipped': w.equipped }"
      >
        <div class="weapon__name">{{ w.name }}</div>
        <div class="weapon__dmg-row">
          <span class="weapon__dmg">{{ damageFormula(char, w) }}</span>
          <DamageBreakdownPopover :char="char" :weapon="w" />
        </div>
      </div>
    </div>
    <div v-else class="empty">Нет оружия в инвентаре.</div>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; border-bottom: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 8px; }
.armor-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.armor-grid button { padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); cursor: pointer; border-radius: 3px; font-family: inherit; }
.armor-grid .active { border-color: var(--color-accent); color: var(--color-accent); }
.shield { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.weapons-label { margin-top: 4px; }
.dmg-bonus { font-size: 13px; color: var(--color-text-muted); }
.weapons { display: flex; flex-direction: column; gap: 6px; }
.weapon { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; }
.weapon--equipped { border-color: var(--color-accent); }
.weapons--has-equipped .weapon:not(.weapon--equipped) { opacity: 0.6; }
.weapon__name { font-weight: 600; }
.weapon__dmg-row { display: flex; align-items: center; gap: 4px; }
.weapon__dmg { font-family: monospace; }
.empty { margin-top: 6px; color: var(--color-text-muted); font-size: 13px; }
</style>
