import { watch } from 'vue'
import { defineStore } from 'pinia'
import type { Character } from '@/types/character'
import { isReadyToLevelUp } from '@/utils/derived'
import { applyCommand } from '@/domain/reducer'
import type { CharacterCommand } from '@/domain/commands'
import type { ChangeEntry } from '@/types/changeLog'
import { createLogger } from '@/utils/logger'
import { backend } from '@/transport/backend'
import { ClientResponseError } from 'pocketbase'
import { mode, modeSession } from '@/transport/mode'
import { reportWriteFailure } from '@/transport/writeFailure'
import { currentUser } from '@/transport/auth'
import { useToastsStore } from '@/stores/toasts'
import { useGamesStore } from '@/stores/games'
import { canEdit } from '@/utils/permissions'
import { charactersInScope, freeIfGameUnknown } from '@/utils/scope'
import { scope } from '@/transport/scope'
import type { CharacterMeta } from '@/types/game'
import { t } from '@/locales'

const log = createLogger('store:characters')

const lastUpdatedById = new Map<string, string>()

export interface CharacterRowMeta { id: string; updated: string; owner: string; game: string }

export function refuseReadOnly(where: string, id: string): void {
  log.error(`${where}: read-only character`, { id })
  useToastsStore().push(t('errors.readOnly'), 'error')
}

export const useCharactersStore = defineStore('characters', {
  state: () => ({
    list: [] as Character[],
    activeId: null as string | null,
    // Online only: who owns each character and which game it is in, from its record.
    meta: {} as Record<string, CharacterMeta>,
  }),
  getters: {
    active(state): Character | undefined {
      return state.activeId ? state.list.find(c => c.id === state.activeId) : undefined
    },
    getById: (state) => (id: string) => state.list.find(c => c.id === id),
    isReadyToLevelUp: () => (char: Character) => isReadyToLevelUp(char),
    /** Owner and game as the UI should see them: a game this player no longer knows counts as none. */
    metaOf: (state) => (id: string): CharacterMeta | undefined => {
      const games = useGamesStore()
      return freeIfGameUnknown(state.meta[id], g => !!games.byId(g))
    },
    /** `metaOf` for every character, for helpers that take the whole map. */
    metaView(state): Record<string, CharacterMeta> {
      const games = useGamesStore()
      const out: Record<string, CharacterMeta> = {}
      for (const [id, m] of Object.entries(state.meta)) out[id] = freeIfGameUnknown(m, g => !!games.byId(g))!
      return out
    },
    /** Whether the character sits at the open table (offline has no tables: always). */
    inScope(state): (id: string) => boolean {
      return (id: string) => {
        if (mode.value === 'offline') return true
        const c = state.list.find(x => x.id === id)
        return !!c && charactersInScope([c], this.metaView, scope.value, currentUser.value?.id ?? null).length > 0
      }
    },
    canEditCharacter: (state) => (id: string): boolean => {
      if (mode.value === 'offline') return true
      const meta = state.meta[id]
      const games = useGamesStore()
      const game = meta?.game ? games.byId(meta.game) : undefined
      return canEdit(meta, currentUser.value?.id ?? null, game, game ? games.membersOf(game.id) : [])
    },
  },
  actions: {
    async add(data: Omit<Character, 'id' | 'createdAt'>, opts: { game?: string } = {}): Promise<Character | null> {
      const character: Character = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      }
      log.debug('add', { id: character.id, status: character.status, name: character.name, classId: character.classId })
      const session = modeSession()
      const be = backend()
      const game = opts.game ?? ''
      const owner = currentUser.value?.id
      this.upsertLocal(character, undefined, mode.value === 'online' && owner ? { owner, game } : undefined)
      try {
        await be.createCharacter(character, game)
      } catch (err) {
        log.error('add: write failed', { id: character.id, err })
        if (modeSession() !== session) return null
        this.removeLocal(character.id)
        reportWriteFailure(err, t('errors.addFailed'), session)
        return null
      }
      // The mode changed while the write was in flight: the stores now hold the other mode's data.
      if (modeSession() !== session) return null
      return character
    },
    async dispatch(id: string, cmd: CharacterCommand): Promise<void> {
      const prev = this.list.find(c => c.id === id)
      if (!prev) {
        log.warn('dispatch: not found', { id, cmd: cmd.type })
        return
      }
      if (!this.canEditCharacter(id)) {
        refuseReadOnly('dispatch', id)
        return
      }
      log.debug('dispatch', { id, cmd: cmd.type })
      const { character: next, changes } = applyCommand(prev, cmd)
      if (next === prev && changes.length === 0) return

      const session = modeSession()
      const be = backend()
      this.upsertLocal(next)

      try {
        await be.updateCharacter(next)
      } catch (err) {
        if (modeSession() !== session) {
          log.error('dispatch: write failed after a mode switch', { id, cmd: cmd.type, err })
          throw err
        }
        // Someone else's character that left this table (taken out, its owner gone): the server no
        // longer lets this player read it, so it leaves the table instead of rolling back.
        if (err instanceof ClientResponseError && err.status === 404 && this.metaOf(id)?.owner !== currentUser.value?.id) {
          log.error('dispatch: character is no longer at this table', { id, cmd: cmd.type, err })
          this.removeLocal(id)
          useToastsStore().push(t('errors.characterGone'), 'error')
          throw err
        }
        log.error('dispatch: write failed, rolling back', { id, cmd: cmd.type, err })
        this.upsertLocal(prev)
        reportWriteFailure(err, t('errors.dispatchFailed'), session)
        throw err
      }

      if (modeSession() !== session) return
      if (next.status === 'active' && changes.length) {
        const now = Date.now()
        const entries: ChangeEntry[] = changes.map((c, i) => ({
          ...c,
          id: crypto.randomUUID(),
          timestamp: now + i,
          characterId: next.id,
          characterName: next.name,
        }))
        try {
          await be.addChanges(entries)
        } catch (err) {
          log.error('dispatch: change_events write failed', { id, err })
        }
      }
    },
    async remove(id: string): Promise<void> {
      log.debug('remove', { id })
      const prev = this.list.find(c => c.id === id)
      const session = modeSession()
      const be = backend()
      this.removeLocal(id)
      try {
        await be.deleteCharacter(id)
      } catch (err) {
        log.error('remove: write failed', { id, err })
        if (modeSession() !== session) throw err
        if (prev) this.upsertLocal(prev)
        reportWriteFailure(err, t('errors.removeFailed'), session)
        throw err
      }
    },
    setActive(id: string | null) {
      if (id && !this.list.some(c => c.id === id)) {
        log.warn('setActive: unknown id', { id })
        this.activeId = null
        return
      }
      log.debug('setActive', { prev: this.activeId, next: id })
      this.activeId = id
    },
    clearAll() {
      log.info('clearAll', { count: this.list.length })
      this.list = []
      this.activeId = null
      this.meta = {}
      lastUpdatedById.clear()
    },
    setAll(chars: Character[], rows?: CharacterRowMeta[]) {
      log.debug('setAll', { count: chars.length })
      this.list = chars
      lastUpdatedById.clear()
      const meta: Record<string, CharacterMeta> = {}
      if (rows) {
        for (const r of rows) {
          lastUpdatedById.set(r.id, r.updated)
          meta[r.id] = { owner: r.owner, game: r.game }
        }
      }
      this.meta = meta
    },
    upsertLocal(char: Character, updated?: string, meta?: CharacterMeta) {
      if (updated) {
        const last = lastUpdatedById.get(char.id)
        if (last && last >= updated) {
          log.debug('upsertLocal: stale, ignoring', { id: char.id, last, incoming: updated })
          return
        }
        lastUpdatedById.set(char.id, updated)
      }
      if (meta) this.meta[char.id] = meta
      const idx = this.list.findIndex(c => c.id === char.id)
      if (idx === -1) this.list.push(char)
      else this.list[idx] = char
    },
    removeLocal(id: string) {
      this.list = this.list.filter(c => c.id !== id)
      lastUpdatedById.delete(id)
      delete this.meta[id]
      if (this.activeId === id) this.activeId = null
    },
    setMeta(id: string, meta: CharacterMeta) {
      if (this.list.some(c => c.id === id)) this.meta[id] = meta
    },
    // The server's unset of `game` may never arrive (a deleted game sends nothing), so losing a game frees them here.
    freeGame(gameId: string, owner: string | null) {
      for (const [id, m] of Object.entries(this.meta)) {
        if (m.game === gameId && m.owner === owner) this.meta[id] = { ...m, game: '' }
      }
    },
    // The server sends nothing for records a player can no longer read, so losing a game drops them here.
    removeGameOthers(gameId: string, me: string | null, owner?: string) {
      const gone = this.list.filter((c) => {
        const m = this.meta[c.id]
        if (!m || m.game !== gameId || m.owner === me) return false
        return owner === undefined || m.owner === owner
      })
      for (const c of gone) this.removeLocal(c.id)
    },
  },
})

// Only PartyView keeps activeId in step with the open sheets, so a character left active on another
// table would otherwise keep rolling, into this table's log, under its own game.
watch(scope, () => {
  const store = useCharactersStore()
  if (store.activeId && !store.inScope(store.activeId)) store.setActive(null)
}, { flush: 'sync' })
