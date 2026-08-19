<script setup lang="ts">
import { computed } from 'vue'
import type { Character, SkillId } from '@/types/character'
import { SKILL_IDS } from '@/types/character'
import { t } from '@/locales'
import { skillName } from '@/locales/content'

const props = defineProps<{ char: Character; currentSkillIds: readonly SkillId[]; selected: SkillId | null }>()
const emit = defineEmits<{ 'update:selected': [id: SkillId] }>()

const available = computed(() => SKILL_IDS.filter(id => !props.currentSkillIds.includes(id)))
</script>

<template>
  <div class="cc-section">
    <div class="cc-section-head">
      <span class="cc-section-label">{{ t('levelUp.steps.skill.label') }}</span>
      <span class="cc-section-hint">{{ t('levelUp.steps.skill.hint') }}</span>
    </div>
    <div v-if="available.length" class="cc-abil-list">
      <button
        v-for="id in available"
        :key="id"
        type="button"
        class="cc-abil"
        :class="{ 'is-selected': selected === id }"
        @click="emit('update:selected', id)"
      >
        <span class="cc-check" aria-hidden="true">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5 L5 8.5 L9 4"/></svg>
        </span>
        <span class="cc-abil-body-text">
          <span class="cc-abil-name">{{ skillName(id) }}</span>
        </span>
      </button>
    </div>
    <div v-else class="lu-empty">{{ t('levelUp.steps.skill.empty') }}</div>
  </div>
</template>
