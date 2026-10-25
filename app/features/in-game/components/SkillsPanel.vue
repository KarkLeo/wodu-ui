<script setup lang="ts">
import { computed } from 'vue'
import type { Character, SkillId } from '@/types/character'
import { SKILL_IDS } from '@/types/character'
import { CLASSES } from '@/data/classes'
import SkillChip from '@/components/ui/SkillChip.vue'
import IconLock from '@/components/ui/icons/IconLock.vue'
import { t } from '@/locales'
import { skillName } from '@/locales/content'

const props = defineProps<{ char: Character }>()

const autoSkillIds = computed(() => CLASSES[props.char.classId].grantedSkillIds as readonly string[])

type Row = { id: SkillId; name: string; state: 'auto' | 'default' }

const rows = computed<Row[]>(() =>
  SKILL_IDS
    .filter(id => props.char.skillIds.includes(id))
    .map(id => ({
      id,
      name: skillName(id),
      state: autoSkillIds.value.includes(id) ? 'auto' : 'default',
    })),
)
</script>

<template>
  <section class="skills-section">
    <div class="skills-section-head">
      <span class="skills-section-title">{{ t('inGame.skills.title') }}</span>
      <span v-if="rows.length" class="skills-section-hint">
        {{ t('inGame.skills.hintCount', { count: rows.length }) }}
      </span>
    </div>
    <div v-if="rows.length" class="skills-row">
      <SkillChip
        v-for="row in rows"
        :key="row.id"
        :label="row.name"
        :state="row.state"
        :icon="row.state === 'auto' ? IconLock : undefined"
        :title="row.state === 'auto' ? t('inGame.skills.auto') : undefined"
      />
    </div>
    <div v-else class="skills-empty">{{ t('inGame.skills.empty') }}</div>
  </section>
</template>

<style scoped>
.skills-section {
  padding: 14px 16px;
}
.skills-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}
.skills-section-title {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.skills-section-hint {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--vtt-text-muted);
}
.skills-row {
  display: flex;
  gap: var(--s-2);
  flex-wrap: wrap;
  align-items: center;
}
.skills-empty {
  font-size: 13px;
  color: var(--vtt-text-muted);
  font-style: italic;
}
</style>
