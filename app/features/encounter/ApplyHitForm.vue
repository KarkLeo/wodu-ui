<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import KeyValueRow from '@/components/ui/KeyValueRow.vue'
import StateNote from '@/components/ui/StateNote.vue'
import Stepper from '@/components/ui/Stepper.vue'
import NumberedName from './NumberedName.vue'
import { damageAfterArmor, previewHit } from '@/domain/encounter'
import { gearName } from '@/locales/content'
import type { ApplyTarget } from '@/composables/useApplyHit'
import type { RollRecord } from '@/types/dice'
import { t } from '@/locales'

const props = defineProps<{
  roll: RollRecord
  target: ApplyTarget
}>()
const emit = defineEmits<{
  (e: 'apply', amount: number): void
  (e: 'cancel'): void
}>()

const amount = ref(damageAfterArmor(props.roll.total, props.target.armor))
const sent = ref(false)

const preview = computed(() => previewHit(amount.value, props.target.hp, props.target.tempHp))
const dies = computed(() => props.target.kind === 'monster' && preview.value.hpAfter === 0)
const weapon = computed(() => {
  const p = props.roll.purpose
  return p.kind === 'damage' && p.weaponName ? gearName(p.weaponTemplateId, p.weaponName) : ''
})

function submit() {
  if (sent.value) return
  sent.value = true
  emit('apply', amount.value)
}
</script>

<template>
  <div class="apply-hit">
    <div class="apply-hit-source">
      <NumberedName :label="roll.characterName ?? '—'" />
      <span v-if="weapon" class="apply-hit-weapon">{{ weapon }}</span>
      <span class="apply-hit-total">{{ roll.total }}</span>
    </div>
    <KeyValueRow :label="t('encounter.apply.armor')" class="apply-hit-row">
      <span class="apply-hit-value">−{{ target.armor }}</span>
    </KeyValueRow>
    <KeyValueRow v-if="target.tempHp > 0" :label="t('encounter.apply.tempHp')" class="apply-hit-row">
      <span class="apply-hit-value">{{ t('encounter.apply.tempHpUsed', { used: preview.fromTemp, total: target.tempHp }) }}</span>
    </KeyValueRow>
    <KeyValueRow :label="t('encounter.apply.damage')" tone="accent" class="apply-hit-row">
      <Stepper
        v-model="amount"
        :min="0"
        size="sm"
        tone="danger"
        :aria-label="t('encounter.apply.damage')"
        :decrease-label="t('encounter.apply.lower')"
        :increase-label="t('encounter.apply.raise')"
      />
    </KeyValueRow>
    <StateNote inline align="start" size="sm" class="apply-hit-after">
      {{ t('encounter.apply.hp', { before: target.hp, after: preview.hpAfter }) }}<template v-if="dies"> · {{ t('encounter.apply.willDie') }}</template>
    </StateNote>
    <div class="apply-hit-actions">
      <Button variant="ghost" size="sm" @click="emit('cancel')">{{ t('encounter.apply.cancel') }}</Button>
      <Button variant="primary" size="sm" :disabled="sent" @click="submit">{{ t('encounter.apply.apply') }}</Button>
    </div>
  </div>
</template>

<style scoped>
.apply-hit { display: flex; flex-direction: column; gap: var(--s-2); }
.apply-hit-row { min-height: 0; padding: 2px 0; }
.apply-hit-row + .apply-hit-row { border-top: 0; }
.apply-hit-value { font-family: var(--font-mono); font-size: 12px; color: var(--vtt-text-secondary); }
.apply-hit-source {
  display: flex;
  align-items: baseline;
  gap: var(--s-2);
  min-width: 0;
  font-family: var(--font-serif);
  font-size: 15px;
  color: var(--vtt-text-primary);
}
.apply-hit-weapon {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--vtt-text-muted);
}
.apply-hit-total { margin-left: auto; font-size: 20px; color: var(--vtt-accent-soft); }
.apply-hit-after { margin: 0; }
.apply-hit-actions { display: flex; justify-content: flex-end; gap: var(--s-2); }
</style>
