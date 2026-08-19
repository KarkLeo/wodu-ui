<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCharacterCreation } from '@/composables/useCharacterCreation'
import { useCreationStore } from '@/stores/creation'
import { useCharactersStore } from '@/stores/characters'
import { t } from '@/locales'
import { className as classNameOf } from '@/locales/content'
import StepIdentity from './steps/StepIdentity.vue'
import StepTraining from './steps/StepTraining.vue'
import StepGear from './steps/StepGear.vue'
import { useIsMobile } from '@/composables/useIsMobile'

const isMobile = useIsMobile()

const router = useRouter()
const creation = useCreationStore()
const characters = useCharactersStore()
const { draft, step, isStepValid, allRolled, next, back, finish } = useCharacterCreation()

const stepComponents = [StepIdentity, StepTraining, StepGear]
const currentStepComponent = computed(() => stepComponents[step.value - 1])

const stepTitle = computed(() => {
  if (step.value === 1) return t('characterCreation.steps.s1Title')
  if (step.value === 2) return t('characterCreation.steps.s2Title')
  return t('characterCreation.steps.s3Title')
})

const className = computed(() => {
  if (!draft.value) return ''
  if (draft.value.classId === 'custom') return draft.value.customClassName?.trim() || classNameOf('custom')
  return classNameOf(draft.value.classId)
})

const footerHint = computed(() => {
  if (!draft.value) return ''
  const d = draft.value
  if (step.value === 1) {
    if (!d.name.trim()) return t('characterCreation.footerHint.needName')
    if (d.classId === 'custom' && !d.customClassName?.trim()) return t('characterCreation.footerHint.needCustomClass')
    if (!allRolled.value) return t('characterCreation.footerHint.needStats')
    return t('characterCreation.footerHint.s1Ready', { name: d.name.split(' ')[0] || d.name, className: className.value })
  }
  if (step.value === 2) {
    return t('characterCreation.footerHint.s2Ready', { className: className.value })
  }
  if (d.maxHp === 0) return t('characterCreation.footerHint.s3NeedHp')
  return t('characterCreation.footerHint.s3Ready')
})

const dotState = (n: number) => {
  if (n < step.value) return 'is-done'
  if (n === step.value) return 'is-active'
  return ''
}

function onDotClick(n: number) {
  if (n >= step.value) return
  while (creation.step > n) creation.prevStep()
}

async function onClose() {
  if (creation.draftId) {
    try { await characters.remove(creation.draftId) } catch { /* logged in store */ }
  }
  creation.reset()
  router.push('/')
}

function onNextOrFinish() {
  if (step.value === 3) finish()
  else next()
}

onMounted(() => {
  if (!creation.draftId) router.push('/')
})
</script>

<template>
  <Teleport to="body" :disabled="!isMobile">
  <div v-if="draft" class="cc-shell">
    <div class="cc-topbar">
      <div class="cc-title">{{ stepTitle }}</div>
      <div class="cc-topbar-hint">{{ footerHint }}</div>
      <button class="cc-close" :aria-label="t('characterCreation.shell.close')" @click="onClose">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M3 3 L11 11 M11 3 L3 11"/></svg>
      </button>
    </div>

    <div class="cc-stepper">
      <span class="cc-stepper-line" />
      <div class="cc-stepper-dots">
        <button
          v-for="n in 3"
          :key="n"
          type="button"
          :class="['cc-dot', dotState(n)]"
          :disabled="n > step"
          :aria-current="n === step ? 'step' : undefined"
          @click="onDotClick(n)"
        >
          <svg v-if="n < step" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5 L5 8.5 L9 4"/></svg>
          <span v-else>{{ n }}</span>
        </button>
      </div>
      <span class="cc-stepper-line" />
    </div>

    <div class="cc-content">
      <component :is="currentStepComponent" />
    </div>

    <div class="cc-footer">
      <button
        type="button"
        class="cc-foot-ghost"
        @click="back"
      >
        ← {{ t('characterCreation.shell.back') }}
      </button>
      <div class="cc-footer-spacer" />
      <button
        type="button"
        class="cc-foot-hero"
        :disabled="!isStepValid"
        @click="onNextOrFinish"
      >
        <template v-if="step === 3">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 2 L9 6 L13 6.5 L10 9.5 L11 13 L7 11 L3 13 L4 9.5 L1 6.5 L5 6 Z"/></svg>
          {{ t('characterCreation.shell.create') }}
        </template>
        <template v-else>{{ t('characterCreation.shell.next') }} →</template>
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
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--s-3);
  padding: 0 var(--s-4);
}
.cc-title {
  justify-self: start;
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
  padding: 0;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
.cc-dot:disabled { cursor: default; }
.cc-dot.is-done {
  color: var(--vtt-accent-soft);
  background: rgba(140, 106, 58, 0.25);
  border-color: rgba(140, 106, 58, 0.5);
  cursor: pointer;
}
.cc-dot.is-done:hover {
  background: rgba(140, 106, 58, 0.4);
  border-color: var(--vtt-border-gold);
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
  transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}
.cc-foot-ghost:hover:not(:disabled) { color: var(--vtt-accent-soft); border-color: var(--vtt-border-strong); }
.cc-foot-ghost:disabled { opacity: 0.3; cursor: not-allowed; }

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
  transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease), filter var(--t-fast) var(--ease);
}
.cc-foot-hero:hover:not(:disabled) {
  background: #BF9A4C;
  border-color: #A6833E;
  filter: drop-shadow(0 0 14px rgba(140, 106, 58, 0.5));
}
.cc-foot-hero:disabled { opacity: 0.4; cursor: not-allowed; filter: none; }
.cc-foot-hero svg { width: 14px; height: 14px; }
</style>
