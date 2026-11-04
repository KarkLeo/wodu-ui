<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import { t } from '@/locales'
import ScreenColumn from '@/components/layout/ScreenColumn.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ListRow from '@/components/ui/ListRow.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import StateNote from '@/components/ui/StateNote.vue'
import IconDice from '@/components/ui/icons/IconDice.vue'
import { usePwaInstall } from '@/pwa/useInstall'
import { onlineDataReady } from '@/transport/bootstrap'
import { currentUser } from '@/transport/auth'
import { mode } from '@/transport/mode'
import { scope } from '@/transport/scope'
import { charactersInScope, newCharacterLocation } from '@/utils/scope'

const router = useRouter()
const characters = useCharactersStore()
const creation = useCreationStore()
const install = usePwaInstall()

// Online, this view is a game's table with no sheet open: only that game's characters, and only my drafts.
const visible = computed(() => {
  if (mode.value !== 'online') return characters.list
  const me = currentUser.value?.id ?? null
  return charactersInScope(characters.list, characters.metaView, scope.value, me)
    .filter(c => c.status === 'active' || characters.metaOf(c.id)?.owner === me)
})
const activeChars = computed(() => visible.value.filter(c => c.status === 'active'))
const draftChars = computed(() => visible.value.filter(c => c.status === 'draft'))

function resumeCreation(id: string) {
  creation.setDraft(id)
  const gameId = mode.value === 'online' ? characters.metaOf(id)?.game : ''
  router.push(newCharacterLocation(gameId ? { kind: 'game', gameId } : { kind: 'home' }, mode.value === 'offline'))
}
</script>

<template>
  <ScreenColumn>
    <section v-if="draftChars.length > 0" class="cl-drafts">
      <SectionLabel tone="neutral" class="cl-drafts__label">{{ t('characterList.drafts') }}</SectionLabel>
      <ListRow
        v-for="char in draftChars"
        :key="char.id"
        as="button"
        variant="dashed"
        :title="char.name || t('characterList.draftUnnamed')"
        :subtitle="`${t('characterList.resume')} →`"
        subtitle-tone="accent"
        @click="resumeCreation(char.id)"
      />
    </section>

    <StateNote v-if="!onlineDataReady" role="status">
      {{ t('characterList.loading') }}
    </StateNote>

    <EmptyState
      v-else-if="activeChars.length === 0 && draftChars.length === 0"
      variant="plain"
      :title="t('characterList.empty.title')"
      :hint="t('characterList.empty.hint')"
    >
      <template #icon><IconDice /></template>
    </EmptyState>

    <StateNote v-else-if="activeChars.length > 0">
      {{ t('characterList.pickFromSidebar') }}
    </StateNote>

    <button
      v-if="install.canInstall.value"
      type="button"
      class="cl-install"
      @click="install.promptInstall()"
    >
      {{ t('pwa.installCta') }}
    </button>
  </ScreenColumn>
</template>

<style scoped>
.cl-drafts { display: flex; flex-direction: column; gap: 10px; }
.cl-drafts__label { padding-left: 4px; }

.cl-install {
  align-self: center;
  margin-top: 8px;
  padding: 10px 18px;
  background: transparent;
  border: 1px solid var(--vtt-accent-deep);
  border-radius: var(--r-sm);
  color: var(--vtt-accent);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}
.cl-install:hover {
  background: var(--vtt-gold-a18);
  border-color: var(--vtt-accent);
}
</style>
