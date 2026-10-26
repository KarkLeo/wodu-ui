import { defineStore } from 'pinia'
import type { Game, GameMember } from '@/types/game'
import { scope } from '@/transport/scope'
import { createLogger } from '@/utils/logger'

const log = createLogger('store:games')

export const useGamesStore = defineStore('games', {
  state: () => ({
    games: [] as Game[],
    members: [] as GameMember[],
  }),
  getters: {
    byId: (state) => (id: string) => state.games.find(g => g.id === id),
    membersOf: (state) => (gameId: string) => state.members.filter(m => m.game === gameId),
    active(state): Game | undefined {
      const s = scope.value
      return s.kind === 'game' ? state.games.find(g => g.id === s.gameId) : undefined
    },
  },
  actions: {
    setAll(games: Game[], members: GameMember[]) {
      log.debug('setAll', { games: games.length, members: members.length })
      this.games = games
      this.members = members
    },
    upsertGame(game: Game) {
      const idx = this.games.findIndex(g => g.id === game.id)
      if (idx === -1) this.games.push(game)
      else this.games[idx] = game
    },
    removeGame(id: string) {
      this.games = this.games.filter(g => g.id !== id)
      this.members = this.members.filter(m => m.game !== id)
    },
    upsertMember(member: GameMember) {
      const idx = this.members.findIndex(m => m.id === member.id)
      if (idx === -1) this.members.push(member)
      // A realtime row may come without the expanded name the local copy already has.
      else this.members[idx] = { ...member, name: member.name || this.members[idx]!.name }
    },
    removeMember(id: string) {
      this.members = this.members.filter(m => m.id !== id)
    },
    clearAll() {
      this.games = []
      this.members = []
    },
  },
})
