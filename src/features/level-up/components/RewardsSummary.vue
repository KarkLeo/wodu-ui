<script setup lang="ts">
import type { LevelReward } from '@/data/xpTable'

defineProps<{ reward: LevelReward; targetLevel: number }>()
</script>

<template>
  <section class="summary">
    <div class="label">Уровень {{ targetLevel }}: награды</div>
    <ul>
      <li v-if="reward.hitDice">+1 hit die (бросок d6 → добавляется к max HP)</li>
      <li v-if="reward.skills">+1 навык (на выбор)</li>
      <li v-if="reward.abilities">+1 способность (на выбор)</li>
      <li v-if="reward.statBonus">+1 к одной характеристике (макс +3)</li>
      <li v-if="reward.damageDice">+1d6 к урону</li>
    </ul>
  </section>
</template>

<style scoped>
.summary { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
ul { margin: 6px 0 0; padding-left: 18px; }
li { font-size: 14px; }
</style>
