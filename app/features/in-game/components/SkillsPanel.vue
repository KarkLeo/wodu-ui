<script setup lang="ts">
import { computed } from 'vue'
import type { Character, SkillId } from '@/types/character'
import { SKILL_IDS } from '@/types/character'
import { CLASSES } from '@/data/classes'
import SkillChip from '@/components/ui/SkillChip.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import StateNote from '@/components/ui/StateNote.vue'
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
    <SectionHeader
      class="skills-section-head"
      :title="t('inGame.skills.title')"
      :meta="rows.length ? t('inGame.skills.hintCount', { count: rows.length }) : undefined"
    />
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
    <StateNote v-else inline align="start" size="sm">{{ t('inGame.skills.empty') }}</StateNote>
  </section>
</template>

<style scoped>
.skills-section {
  padding: 14px 16px;
}
.skills-section-head { margin-bottom: 12px; }
.skills-row {
  display: flex;
  gap: var(--s-2);
  flex-wrap: wrap;
  align-items: center;
}
</style>
