<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ListRow from '@/components/ui/ListRow.vue'
import Pill from '@/components/ui/Pill.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import { useGamesStore } from '@/stores/games'
import { useCharacterCreation } from '@/composables/useCharacterCreation'
import { currentUser } from '@/transport/auth'
import type { Character } from '@/types/character'
import { t } from '@/locales'
import { className } from '@/locales/content'
import './cabinet.css'

const router = useRouter()
const characters = useCharactersStore()
const creation = useCreationStore()
const games = useGamesStore()
const { createDraft } = useCharacterCreation()

const me = computed(() => currentUser.value?.id ?? null)

const mine = computed(() => characters.list.filter(c => me.value !== null && characters.metaOf(c.id)?.owner === me.value))
const active = computed(() => mine.value.filter(c => c.status === 'active'))
const drafts = computed(() => mine.value.filter(c => c.status === 'draft'))

function gameOf(c: Character): string {
  return characters.metaOf(c.id)?.game ?? ''
}

function classLine(c: Character): string {
  const name = c.classId === 'custom'
    ? (c.customClassName ?? t('characterList.customClassFallback'))
    : className(c.classId)
  return t('characterList.classLine', { className: name, level: c.level })
}

function whereLabel(c: Character): string {
  // metaOf already counts a game this player no longer knows as none.
  const game = games.byId(gameOf(c))
  return game ? t('games.characters.inGame', { game: game.name }) : t('games.characters.free')
}

function open(c: Character) {
  const gameId = gameOf(c)
  void router.push(gameId
    ? { name: 'game-party', params: { gameId, ids: c.id } }
    : { name: 'party', params: { ids: c.id } })
}

function resume(c: Character) {
  creation.setDraft(c.id)
  const gameId = gameOf(c)
  void router.push(gameId ? { name: 'game-character-new', params: { gameId } } : { name: 'character-new' })
}

// The cabinet has no game in scope, so the draft is a free character.
async function createCharacter() {
  creation.reset()
  const draft = await createDraft()
  if (!draft) return
  void router.push({ name: 'character-new' })
}
</script>

<template>
  <section v-if="drafts.length > 0" class="hm-list" :aria-label="t('characterList.drafts')">
    <SectionLabel tone="neutral" class="hm-label">{{ t('characterList.drafts') }}</SectionLabel>
    <ListRow
      v-for="c in drafts"
      :key="c.id"
      as="button"
      variant="dashed"
      :title="c.name || t('characterList.draftUnnamed')"
      :subtitle="`${t('characterList.resume')} →`"
      subtitle-tone="accent"
      @click="resume(c)"
    >
      <template #trailing><Pill>{{ whereLabel(c) }}</Pill></template>
    </ListRow>
  </section>

  <section class="hm-list" :aria-label="t('nav.characters')">
    <ListRow
      v-for="c in active"
      :key="c.id"
      as="button"
      variant="card"
      :title="c.name"
      :subtitle="classLine(c)"
      @click="open(c)"
    >
      <template #trailing><Pill :tone="gameOf(c) ? 'neutral' : 'accent'">{{ whereLabel(c) }}</Pill></template>
    </ListRow>

    <EmptyState
      v-if="active.length === 0 && drafts.length === 0"
      variant="plain"
      :title="t('games.characters.emptyTitle')"
      :hint="t('games.characters.emptyHint')"
    />

    <div class="hm-actions">
      <Button variant="hero" size="lg" @click="createCharacter">{{ t('games.characters.create') }}</Button>
    </div>
  </section>
</template>
