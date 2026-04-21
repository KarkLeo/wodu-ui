<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useActiveCharacter } from '@/composables/useActiveCharacter'
import { useLevelUp } from '@/composables/useLevelUp'
import RewardsSummary from './components/RewardsSummary.vue'
import HitDiceRollStep from './components/HitDiceRollStep.vue'
import SkillPickStep from './components/SkillPickStep.vue'
import AbilityPickStep from './components/AbilityPickStep.vue'
import StatBumpStep from './components/StatBumpStep.vue'

const router = useRouter()
const { id, char, dispatch } = useActiveCharacter()
const lv = useLevelUp(char, dispatch)

onMounted(() => {
  if (!char.value || !lv.reward.value) {
    router.push('/')
    return
  }
  lv.init()
})

function apply() {
  lv.confirm()
  router.push(`/character/${id.value}`)
}
</script>

<template>
  <div v-if="char && lv.reward.value" class="content-wrap">
    <header class="hdr">
      <button class="btn-ghost" @click="router.push(`/character/${id}`)">← Назад</button>
      <div>
        <div class="label">Повышение уровня</div>
        <div class="hdr__level">Уровень {{ char.level }} → {{ lv.targetLevel.value }}</div>
      </div>
      <div></div>
    </header>

    <RewardsSummary :reward="lv.reward.value" :target-level="lv.targetLevel.value" />

    <HitDiceRollStep
      v-if="lv.phase.value === 'hitDice'"
      :num-dice="(char.hitDice ?? 1) + 1"
      :target-level="lv.targetLevel.value"
      :character-id="id"
      @done="lv.onHitDice"
    />
    <SkillPickStep v-else-if="lv.phase.value === 'skill'" :char="char" @done="lv.pickSkill" />
    <AbilityPickStep v-else-if="lv.phase.value === 'ability'" :char="char" @done="lv.pickAbility" />
    <StatBumpStep v-else-if="lv.phase.value === 'stat'" :char="char" @done="lv.bumpStat" />
    <section v-else-if="lv.phase.value === 'confirm'" class="confirm">
      <div class="label">Готово — применить изменения?</div>
      <button class="btn-primary" @click="apply">Применить</button>
    </section>
  </div>
</template>

<style scoped>
.hdr { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--color-border); }
.hdr__level { font-size: 16px; font-weight: 700; }
.confirm { padding: 24px 16px; display: flex; flex-direction: column; gap: 12px; align-items: center; }
</style>
