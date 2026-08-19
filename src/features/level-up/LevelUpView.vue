<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useActiveCharacter } from '@/composables/useActiveCharacter'
import { useLevelUp } from '@/composables/useLevelUp'
import type { SkillId, AbilityId, StatKey } from '@/types/character'
import { t } from '@/locales'
import { skillName as skillNameOf, abilityName as abilityNameOf, statShort } from '@/locales/content'
import StepSkill from './components/StepSkill.vue'
import StepAbility from './components/StepAbility.vue'
import StepStat from './components/StepStat.vue'
import StepHitDice from './components/StepHitDice.vue'
import StepSummary from './components/StepSummary.vue'
import { useIsMobile } from '@/composables/useIsMobile'

const isMobile = useIsMobile()

const router = useRouter()
const { id, char, dispatch } = useActiveCharacter()
const lv = useLevelUp(char, dispatch)

const skillSel = ref<SkillId | null>(null)
const abilitySel = ref<AbilityId | null>(null)
const statSel = ref<StatKey | null>(null)
const hitDiceTotal = ref<number | null>(null)

watch(() => lv.phase.value, () => {
  skillSel.value = null
  abilitySel.value = null
  statSel.value = null
  hitDiceTotal.value = null
})

const totalDots = computed(() => lv.activeSteps.value.length + 1)

const previousMaxHp = computed(() => lv.pending.value.maxHp ?? char.value?.maxHp ?? 0)

const canAdvance = computed(() => {
  switch (lv.phase.value) {
    case 'skill': return skillSel.value !== null
    case 'ability': return abilitySel.value !== null
    case 'stat': return statSel.value !== null
    case 'hitDice': return hitDiceTotal.value !== null && hitDiceTotal.value > 0
    case 'confirm': return true
  }
  return false
})

const footerHint = computed(() => {
  switch (lv.phase.value) {
    case 'skill': {
      if (!skillSel.value) return t('levelUp.footer.needPick')
      const name = skillNameOf(skillSel.value)
      return t('levelUp.footer.pickSkill', { name })
    }
    case 'ability': {
      if (!abilitySel.value) return t('levelUp.footer.needPick')
      const name = abilityNameOf(abilitySel.value)
      return t('levelUp.footer.pickAbility', { name })
    }
    case 'stat': {
      if (!statSel.value || !char.value) return t('levelUp.footer.needPick')
      const from = lv.currentStats.value?.[statSel.value] ?? 0
      return t('levelUp.footer.pickStat', { label: statShort(statSel.value), from, to: from + 1 })
    }
    case 'hitDice': {
      if (!hitDiceTotal.value) return t('levelUp.footer.rollToContinue')
      return t('levelUp.footer.hpInfo', { new: Math.max(previousMaxHp.value, hitDiceTotal.value), old: previousMaxHp.value })
    }
    case 'confirm': return t('levelUp.footer.allReady')
  }
  return ''
})

const stepTitle = computed(() => {
  switch (lv.phase.value) {
    case 'skill': return t('levelUp.steps.skill.label')
    case 'ability': return t('levelUp.steps.ability.label')
    case 'stat': return t('levelUp.steps.stat.label')
    case 'hitDice': return t('levelUp.steps.hitDice.label')
    case 'confirm': return t('levelUp.summaryTitle')
  }
  return ''
})

const currentIndex = computed(() => lv.currentStepIndex.value)

function dotState(i: number) {
  if (i < currentIndex.value) return 'is-done'
  if (i === currentIndex.value) return 'is-active'
  return ''
}

function onPrimary() {
  switch (lv.phase.value) {
    case 'skill':
      if (skillSel.value) lv.pickSkill(skillSel.value)
      return
    case 'ability':
      if (abilitySel.value) lv.pickAbility(abilitySel.value)
      return
    case 'stat':
      if (statSel.value) lv.bumpStat(statSel.value)
      return
    case 'hitDice':
      if (hitDiceTotal.value !== null) lv.onHitDice(hitDiceTotal.value)
      return
    case 'confirm':
      lv.confirm()
      router.push(`/character/${id.value}`)
      return
  }
}

function onBack() {
  if (!lv.goBack()) router.push(`/character/${id.value}`)
}

function onClose() {
  router.push(`/character/${id.value}`)
}

onMounted(() => {
  if (!char.value || !lv.reward.value) {
    router.push('/')
    return
  }
  lv.init()
})
</script>

<template>
  <Teleport to="body" :disabled="!isMobile">
  <div v-if="char && lv.reward.value" class="cc-shell lu-shell">
    <div class="cc-topbar">
      <div class="cc-title">
        {{ stepTitle }}
        <span class="cc-title-sub">
          {{ t('levelUp.title') }} · {{ char.level }}<span class="arrow"> → </span>{{ lv.targetLevel.value }}
        </span>
      </div>
      <div class="cc-topbar-hint">{{ footerHint }}</div>
      <button type="button" class="cc-close" :aria-label="t('levelUp.close')" @click="onClose">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M3 3 L11 11 M11 3 L3 11"/></svg>
      </button>
    </div>

    <div class="cc-stepper">
      <span class="cc-stepper-line" />
      <div class="cc-stepper-dots">
        <span
          v-for="i in totalDots"
          :key="i"
          :class="['cc-dot', dotState(i - 1)]"
          :aria-current="(i - 1) === currentIndex ? 'step' : undefined"
        >
          <svg v-if="(i - 1) < currentIndex" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5 L5 8.5 L9 4"/></svg>
          <span v-else>{{ i }}</span>
        </span>
      </div>
      <span class="cc-stepper-line" />
    </div>

    <div class="cc-content">
      <StepSkill
        v-if="lv.phase.value === 'skill'"
        :char="char"
        :current-skill-ids="lv.currentSkillIds.value"
        :selected="skillSel"
        @update:selected="skillSel = $event"
      />
      <StepAbility
        v-else-if="lv.phase.value === 'ability'"
        :char="char"
        :current-ability-ids="lv.currentAbilityIds.value"
        :selected="abilitySel"
        @update:selected="abilitySel = $event"
      />
      <StepStat
        v-else-if="lv.phase.value === 'stat' && lv.currentStats.value"
        :char="char"
        :current-stats="lv.currentStats.value"
        :selected="statSel"
        @update:selected="statSel = $event"
      />
      <StepHitDice
        v-else-if="lv.phase.value === 'hitDice'"
        :num-dice="(char.hitDice ?? 1) + 1"
        :target-level="lv.targetLevel.value"
        :character-id="id"
        :character-name="char.name"
        :previous-max-hp="previousMaxHp"
        @update:result="hitDiceTotal = $event"
      />
      <StepSummary
        v-else-if="lv.phase.value === 'confirm'"
        :char="char"
        :pending="lv.pending.value"
        :target-level="lv.targetLevel.value"
      />
    </div>

    <div class="cc-footer">
      <button type="button" class="cc-foot-ghost" @click="onBack">
        ← {{ t('levelUp.back') }}
      </button>
      <div class="cc-footer-spacer" />
      <button
        type="button"
        class="cc-foot-hero"
        :disabled="!canAdvance"
        @click="onPrimary"
      >
        <template v-if="lv.phase.value === 'confirm'">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5 L6 10.5 L11.5 4"/></svg>
          {{ t('levelUp.confirm') }}
        </template>
        <template v-else>{{ t('levelUp.next') }} →</template>
      </button>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.cc-shell {
  display: grid;
  grid-template-rows: 52px auto minmax(0, 1fr) auto;
  height: 100%;
  max-width: 720px;
  margin: 0 auto;
  overflow: hidden;
  background:
    linear-gradient(to bottom, rgba(26, 21, 16, 0.62), rgba(14, 11, 8, 0.7)),
    rgba(7, 5, 10, 0.35);
  backdrop-filter: blur(22px) saturate(1.1);
  -webkit-backdrop-filter: blur(22px) saturate(1.1);
  position: relative;
  color: var(--vtt-text-primary);
}
@media (max-width: 719px) {
  .cc-shell {
    position: fixed;
    inset: 0;
    height: 100dvh;
    max-width: none;
    margin: 0;
    z-index: 50;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
@media (min-width: 720px) {
  .cc-shell {
    height: calc(100% - 80px);
    max-height: 880px;
    margin: 40px auto;
    border-radius: var(--r-lg);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(140, 106, 58, 0.18);
  }
}

.cc-topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--s-3);
  padding: 0 var(--s-4);
}
.cc-title {
  justify-self: start;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-title-sub {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  font-weight: normal;
  text-shadow: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-title-sub .arrow { color: var(--vtt-accent); margin: 0 3px; }
.cc-topbar-hint {
  justify-self: center;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.cc-close {
  justify-self: end;
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  color: var(--vtt-text-secondary);
  cursor: pointer;
  transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}
.cc-close:hover { border-color: var(--vtt-border-strong); color: var(--vtt-accent-soft); }
.cc-close svg { width: 14px; height: 14px; }

.cc-stepper {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-5);
}
.cc-stepper-line {
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(140, 106, 58, 0.4), transparent);
}
.cc-stepper-dots {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.cc-dot {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-pill);
  background: rgba(36, 28, 21, 0.55);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-text-muted);
  border: 1px solid rgba(140, 106, 58, 0.25);
  position: relative;
}
.cc-dot.is-done {
  color: var(--vtt-accent-soft);
  background: rgba(140, 106, 58, 0.25);
  border-color: rgba(140, 106, 58, 0.5);
}
.cc-dot.is-active {
  color: var(--vtt-bg-base);
  background: linear-gradient(to bottom, var(--vtt-accent), var(--vtt-accent-deep));
  border-color: var(--vtt-border-gold);
  box-shadow: 0 0 14px rgba(212, 168, 87, 0.35);
}
.cc-dot + .cc-dot::before {
  content: "";
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 1px;
  background: rgba(140, 106, 58, 0.35);
}
.cc-dot svg { width: 12px; height: 12px; }

.cc-content {
  min-height: 0;
  overflow-y: auto;
  padding: var(--s-4) var(--s-5) var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-5);
}
.cc-content::-webkit-scrollbar { width: 4px; }
.cc-content::-webkit-scrollbar-thumb { background: rgba(140, 106, 58, 0.3); border-radius: var(--r-pill); }

.cc-footer {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
}
.cc-footer-spacer { min-width: 0; }
.cc-foot-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  color: var(--vtt-text-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.cc-foot-ghost:hover:not(:disabled) { color: var(--vtt-accent-soft); border-color: var(--vtt-border-strong); }
.cc-foot-hero {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #A6833E;
  border: 1px solid #8C6A3A;
  border-radius: var(--r-pill);
  color: #1a1205;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  filter: drop-shadow(0 0 10px rgba(140, 106, 58, 0.35));
}
.cc-foot-hero:hover:not(:disabled) {
  background: #BF9A4C;
  border-color: #A6833E;
  filter: drop-shadow(0 0 14px rgba(140, 106, 58, 0.5));
}
.cc-foot-hero:disabled { opacity: 0.4; cursor: not-allowed; filter: none; }
.cc-foot-hero svg { width: 14px; height: 14px; }
</style>

<style>
/* Styles for the child Step*.vue components — they use shared classes without <style scoped>,
   so we define them globally here, next to their only usage. */
.lu-shell .btn-roll {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 12px;
  background: rgba(36, 28, 21, 0.55);
  border: 1px solid rgba(140, 106, 58, 0.35);
  border-radius: var(--r-sm);
  color: var(--vtt-accent);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--t-fast) var(--ease);
}
.lu-shell .btn-roll:hover:not(:disabled) {
  background: rgba(140, 106, 58, 0.2);
  border-color: var(--vtt-border-gold);
}
.lu-shell .btn-roll:disabled { opacity: 0.45; cursor: not-allowed; }
.lu-shell .btn-roll svg { width: 12px; height: 12px; }

.lu-shell .cc-section { display: flex; flex-direction: column; gap: var(--s-3); }
.lu-shell .cc-section-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.lu-shell .cc-section-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.lu-shell .cc-section-hint {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
}
.lu-shell .cc-section-action { margin-left: auto; }

.lu-shell .cc-abil-list { display: flex; flex-direction: column; }
.lu-shell .cc-abil {
  display: grid;
  grid-template-columns: 22px 1fr auto;
  align-items: center;
  column-gap: 14px;
  padding: 12px 8px;
  background: transparent;
  border: 0;
  text-align: left;
  color: inherit;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--t-fast) var(--ease);
  border-radius: var(--r-sm);
}
.lu-shell .cc-abil + .cc-abil { border-top: 1px solid rgba(140, 106, 58, 0.1); }
.lu-shell .cc-abil:hover { background: rgba(228, 201, 160, 0.03); }
.lu-shell .cc-abil.is-selected { background: rgba(140, 106, 58, 0.12); }
.lu-shell .cc-check {
  width: 22px;
  height: 22px;
  border-radius: var(--r-pill);
  background: transparent;
  border: 1px solid rgba(140, 106, 58, 0.35);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  transition: all var(--t-fast) var(--ease);
}
.lu-shell .cc-check svg { width: 12px; height: 12px; }
.lu-shell .cc-abil.is-selected .cc-check {
  background: var(--vtt-accent);
  border-color: var(--vtt-accent);
  color: var(--vtt-bg-base);
}
.lu-shell .cc-abil-body-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lu-shell .cc-abil-name {
  font-family: var(--font-serif);
  font-size: 16px;
  color: var(--vtt-text-primary);
  line-height: 1.2;
}
.lu-shell .cc-abil-desc {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
  line-height: 1.35;
}
.lu-shell .cc-abil-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  background: rgba(36, 28, 21, 0.6);
  border-radius: var(--r-pill);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vtt-text-secondary);
  flex-shrink: 0;
}
.lu-shell .cc-abil-chip.is-magic {
  color: var(--vtt-accent-soft);
  background: rgba(140, 106, 58, 0.18);
}
.lu-shell .cc-abil-chip.is-danger {
  color: var(--vtt-danger-bright);
  background: rgba(121, 43, 59, 0.16);
}

.lu-shell .cc-attr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-2); }
.lu-shell .cc-attr {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas: "label label" "value value";
  column-gap: 8px;
  padding: 10px 12px 12px;
  border-radius: var(--r-md);
  background: rgba(36, 28, 21, 0.4);
  border: 1px solid transparent;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: inherit;
  transition: all var(--t-fast) var(--ease);
}
.lu-shell .cc-attr:hover:not(:disabled) { background: rgba(36, 28, 21, 0.65); }
.lu-shell .cc-attr:disabled { opacity: 0.4; cursor: not-allowed; }
.lu-shell .cc-attr-label {
  grid-area: label;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  line-height: 1;
}
.lu-shell .cc-attr-value {
  grid-area: value;
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 2px;
}
.lu-shell .cc-attr-mod {
  font-family: var(--font-serif);
  font-size: 32px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
}
.lu-shell .cc-attr-next {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
}
.lu-shell .cc-attr-next em { color: var(--vtt-accent); font-style: normal; }
.lu-shell .cc-attr.is-selected {
  background: rgba(140, 106, 58, 0.2);
  border-color: rgba(140, 106, 58, 0.55);
}
.lu-shell .cc-attr.is-selected .cc-attr-mod {
  color: var(--vtt-accent);
  text-shadow: 0 0 12px rgba(212, 168, 87, 0.4);
}
.lu-shell .cc-attr:disabled .cc-attr-next { color: var(--vtt-danger-bright); opacity: 0.7; }

.lu-shell .lu-empty {
  padding: 24px;
  text-align: center;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--vtt-text-muted);
}

.lu-shell .lu-dice-scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-4);
  padding: var(--s-5) 0;
}
.lu-shell .lu-dice-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.lu-shell .lu-die {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  background: var(--vtt-bg-elevated);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  box-shadow: var(--shadow-inset);
  transition: all var(--t-med) var(--ease);
  position: relative;
}
.lu-shell .lu-die::after {
  content: "d6";
  position: absolute;
  top: 3px;
  right: 5px;
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--vtt-text-muted);
  opacity: 0.55;
  letter-spacing: 0.08em;
}
.lu-shell .lu-die.is-empty {
  color: var(--vtt-text-muted);
  border-style: dashed;
  border-color: rgba(140, 106, 58, 0.25);
  background: transparent;
  box-shadow: none;
}
.lu-shell .lu-die.is-kept {
  background: var(--vtt-accent);
  border-color: var(--vtt-accent);
  color: var(--vtt-bg-base);
  box-shadow: 0 0 16px rgba(212, 168, 87, 0.24);
}
.lu-shell .lu-die.is-kept::after { color: var(--vtt-bg-base); opacity: 0.6; }
.lu-shell .lu-die.is-discarded { opacity: 0.35; }
.lu-shell .lu-die.is-discarded::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 8%;
  right: 8%;
  height: 1px;
  background: var(--vtt-text-muted);
  transform: rotate(-12deg);
  opacity: 0.6;
}
.lu-shell .lu-die.is-rolling { animation: lu-die-roll 520ms var(--ease) infinite alternate; }

.lu-shell .lu-dice-caption {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  text-align: center;
}
.lu-shell .lu-dice-caption b { color: var(--vtt-accent-soft); font-weight: 500; }

.lu-shell .lu-hp-result {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  column-gap: var(--s-4);
  padding: 14px 18px;
  background: rgba(36, 28, 21, 0.45);
  border-radius: var(--r-md);
}
.lu-shell .lu-hp-result-value {
  font-family: var(--font-serif);
  font-size: 40px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
}
.lu-shell .lu-hp-result-body { display: flex; flex-direction: column; gap: 4px; }
.lu-shell .lu-hp-result-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.lu-shell .lu-hp-result-formula {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--vtt-text-muted);
}
.lu-shell .lu-hp-result-formula em { color: var(--vtt-text-secondary); font-style: normal; }

.lu-shell .lu-summary { display: flex; flex-direction: column; }
.lu-shell .lu-sum-row {
  display: grid;
  grid-template-columns: 22px 1fr auto;
  align-items: center;
  column-gap: 14px;
  padding: 12px 8px;
}
.lu-shell .lu-sum-row + .lu-sum-row { border-top: 1px solid rgba(140, 106, 58, 0.1); }
.lu-shell .lu-sum-glyph { width: 18px; height: 18px; color: var(--vtt-accent-deep); }
.lu-shell .lu-sum-glyph svg { width: 100%; height: 100%; }
.lu-shell .lu-sum-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lu-shell .lu-sum-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.lu-shell .lu-sum-name {
  font-family: var(--font-serif);
  font-size: 16px;
  color: var(--vtt-text-primary);
  line-height: 1.2;
}
.lu-shell .lu-sum-value {
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  text-align: right;
}
.lu-shell .lu-sum-value em {
  font-family: var(--font-mono);
  font-size: 10px;
  font-style: normal;
  color: var(--vtt-text-muted);
  margin-left: 6px;
  letter-spacing: 0.08em;
}
.lu-shell .lu-sum-value.is-hp { color: var(--vtt-accent); font-size: 22px; }
.lu-shell .lu-sum-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  margin-left: 6px;
  background: rgba(107, 142, 78, 0.15);
  border-radius: var(--r-pill);
  color: var(--vtt-success);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  vertical-align: middle;
}
</style>
