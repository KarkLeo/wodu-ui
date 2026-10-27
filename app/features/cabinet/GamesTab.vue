<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import CreateGameSheet from './CreateGameSheet.vue'
import JoinByCodeSheet from './JoinByCodeSheet.vue'
import { useGamesStore } from '@/stores/games'
import { useCharactersStore } from '@/stores/characters'
import { currentUser } from '@/transport/auth'
import { isMaster } from '@/utils/permissions'
import type { Game } from '@/types/game'
import { t } from '@/locales'
import './cabinet.css'

const router = useRouter()
const games = useGamesStore()
const characters = useCharactersStore()

const createOpen = ref(false)
const joinOpen = ref(false)

const me = computed(() => currentUser.value?.id ?? null)

const cards = computed(() => games.games.map((game) => {
  const members = games.membersOf(game.id)
  const master = isMaster(game, me.value)
  const mine = master
    ? []
    : characters.list
      .filter(c => c.status === 'active')
      .filter((c) => {
        const m = characters.metaOf(c.id)
        return m?.owner === me.value && m.game === game.id
      })
      .map(c => c.name)
  return {
    game,
    master,
    players: members.filter(m => m.user !== game.master).length,
    masterName: members.find(m => m.user === game.master)?.name || '—',
    mine,
  }
}))

function openGame(game: Game) {
  void router.push({ name: 'game', params: { gameId: game.id } })
}

function joinWith(code: string) {
  void router.push({ name: 'join', params: { code } })
}
</script>

<template>
  <section class="hm-list" :aria-label="t('nav.games')">
    <button
      v-for="card in cards"
      :key="card.game.id"
      type="button"
      class="hm-card"
      @click="openGame(card.game)"
    >
      <span class="hm-card__head">
        <span class="hm-card__name">{{ card.game.name }}</span>
        <span :class="['hm-pill', { 'hm-pill--accent': card.master }]">
          {{ card.master ? t('games.list.roleMaster') : t('games.list.rolePlayer') }}
        </span>
      </span>
      <span class="hm-card__meta">
        {{ t('games.list.players', { count: card.players }) }}
        <template v-if="!card.master">
          · {{ card.game.master ? t('games.list.master', { name: card.masterName }) : t('games.list.noMaster') }}
        </template>
      </span>
      <span v-if="!card.master" class="hm-card__note">
        {{ card.mine.length ? t('games.list.yourCharacters', { names: card.mine.join(', ') }) : t('games.list.noCharacter') }}
      </span>
    </button>

    <div v-if="cards.length === 0" class="hm-empty">
      <div class="hm-empty__title">{{ t('games.list.emptyTitle') }}</div>
      <div class="hm-empty__hint">{{ t('games.list.emptyHint') }}</div>
    </div>

    <div class="hm-actions">
      <Button variant="hero" size="lg" @click="createOpen = true">{{ t('games.list.create') }}</Button>
      <Button variant="ghost" size="lg" @click="joinOpen = true">{{ t('games.list.joinByCode') }}</Button>
    </div>
  </section>

  <CreateGameSheet v-model:open="createOpen" @created="openGame" />
  <JoinByCodeSheet v-model:open="joinOpen" @submit="joinWith" />
</template>
