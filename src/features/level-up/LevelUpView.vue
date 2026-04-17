<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import type { Character, SkillId, AbilityId, StatKey } from '@/types/character'
import { getReward } from '@/data/xpTable'
import RewardsSummary from './components/RewardsSummary.vue'
import HitDiceRollStep from './components/HitDiceRollStep.vue'
import SkillPickStep from './components/SkillPickStep.vue'
import AbilityPickStep from './components/AbilityPickStep.vue'
import StatBumpStep from './components/StatBumpStep.vue'

type Phase = 'hitDice' | 'skill' | 'ability' | 'stat' | 'confirm'

const route = useRoute()
const router = useRouter()
const characters = useCharactersStore()

const id = computed(() => route.params.id as string)
const char = computed(() => characters.getById(id.value))
const targetLevel = computed(() => (char.value ? char.value.level + 1 : 1))
const reward = computed(() => getReward(targetLevel.value))

const pendingPatch = ref<Partial<Character>>({})
const phase = ref<Phase>('hitDice')
const done = ref({ hitDice: false, skill: false, ability: false, stat: false })

onMounted(() => {
  if (!char.value || !reward.value) {
    router.push('/')
    return
  }
  // автобонус к урону
  if (reward.value.damageDice) {
    pendingPatch.value.damageBonusDice = (char.value.damageBonusDice ?? 0) + reward.value.damageDice
  }
  advance()
})

function advance() {
  const r = reward.value
  if (!r) return
  if (r.hitDice && !done.value.hitDice) { phase.value = 'hitDice'; return }
  if (r.skills && !done.value.skill) { phase.value = 'skill'; return }
  if (r.abilities && !done.value.ability) { phase.value = 'ability'; return }
  if (r.statBonus && !done.value.stat) { phase.value = 'stat'; return }
  phase.value = 'confirm'
}

function onHitDice(delta: number) {
  if (!char.value) return
  pendingPatch.value.maxHp = (pendingPatch.value.maxHp ?? char.value.maxHp) + delta
  pendingPatch.value.currentHp = (pendingPatch.value.currentHp ?? char.value.currentHp) + delta
  pendingPatch.value.hitDice = (pendingPatch.value.hitDice ?? char.value.hitDice) + 1
  done.value.hitDice = true
  advance()
}

function onSkill(sid: SkillId) {
  if (!char.value) return
  const current = pendingPatch.value.skillIds ?? char.value.skillIds
  pendingPatch.value.skillIds = [...current, sid]
  done.value.skill = true
  advance()
}

function onAbility(aid: AbilityId) {
  if (!char.value) return
  const current = pendingPatch.value.abilityIds ?? char.value.abilityIds
  pendingPatch.value.abilityIds = [...current, aid]
  done.value.ability = true
  advance()
}

function onStat(key: StatKey) {
  if (!char.value) return
  const base = pendingPatch.value.stats ?? char.value.stats
  pendingPatch.value.stats = { ...base, [key]: Math.min(3, base[key] + 1) }
  done.value.stat = true
  advance()
}

function apply() {
  if (!char.value) return
  characters.applyLevelUp(id.value, {
    ...pendingPatch.value,
    level: targetLevel.value,
  })
  router.push(`/character/${id.value}`)
}
</script>

<template>
  <div v-if="char && reward" class="content-wrap">
    <header class="hdr">
      <button class="btn-ghost" @click="router.push(`/character/${id}`)">← Назад</button>
      <div>
        <div class="label">Повышение уровня</div>
        <div class="hdr__level">Уровень {{ char.level }} → {{ targetLevel }}</div>
      </div>
      <div></div>
    </header>

    <RewardsSummary :reward="reward" :target-level="targetLevel" />

    <HitDiceRollStep v-if="phase === 'hitDice'" @done="onHitDice" />
    <SkillPickStep v-else-if="phase === 'skill'" :char="char" @done="onSkill" />
    <AbilityPickStep v-else-if="phase === 'ability'" :char="char" @done="onAbility" />
    <StatBumpStep v-else-if="phase === 'stat'" :char="char" @done="onStat" />
    <section v-else-if="phase === 'confirm'" class="confirm">
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
