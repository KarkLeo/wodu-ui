import { defineStore } from 'pinia'
import type { Character } from '@/types/character'
import { isReadyToLevelUp } from '@/utils/derived'
import { applyCommand } from '@/domain/reducer'
import type { CharacterCommand } from '@/domain/commands'
import type { ChangeEntry } from '@/types/changeLog'
import { createLogger } from '@/utils/logger'
import { backend } from '@/transport/backend'
import { isNetworkError } from '@/transport/connection'
import { useToastsStore } from '@/stores/toasts'
import { t } from '@/locales'

const log = createLogger('store:characters')

const lastUpdatedById = new Map<string, string>()

// A network failure is explained by the server-unavailable overlay; a toast on top would only repeat it.
function toastUnlessNetwork(err: unknown, message: string) {
  if (!isNetworkError(err)) useToastsStore().push(message, 'error')
}

interface CharacterMeta { id: string; updated: string }

export const useCharactersStore = defineStore('characters', {
  state: () => ({
    list: [] as Character[],
    activeId: null as string | null,
  }),
  getters: {
    active(state): Character | undefined {
      return state.activeId ? state.list.find(c => c.id === state.activeId) : undefined
    },
    getById: (state) => (id: string) => state.list.find(c => c.id === id),
    isReadyToLevelUp: () => (char: Character) => isReadyToLevelUp(char),
  },
  actions: {
    async add(data: Omit<Character, 'id' | 'createdAt'>): Promise<Character | null> {
      const character: Character = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      }
      log.debug('add', { id: character.id, status: character.status, name: character.name, classId: character.classId })
      this.upsertLocal(character)
      try {
        await backend().createCharacter(character)
        return character
      } catch (err) {
        log.error('add: write failed', { id: character.id, err })
        this.removeLocal(character.id)
        toastUnlessNetwork(err, t('errors.addFailed'))
        return null
      }
    },
    async dispatch(id: string, cmd: CharacterCommand): Promise<void> {
      const prev = this.list.find(c => c.id === id)
      if (!prev) {
        log.warn('dispatch: not found', { id, cmd: cmd.type })
        return
      }
      log.debug('dispatch', { id, cmd: cmd.type })
      const { character: next, changes } = applyCommand(prev, cmd)
      if (next === prev && changes.length === 0) return

      this.upsertLocal(next)

      try {
        await backend().updateCharacter(next)
      } catch (err) {
        log.error('dispatch: write failed, rolling back', { id, cmd: cmd.type, err })
        this.upsertLocal(prev)
        toastUnlessNetwork(err, t('errors.dispatchFailed'))
        throw err
      }

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
          await backend().addChanges(entries)
        } catch (err) {
          log.error('dispatch: change_events write failed', { id, err })
        }
      }
    },
    async remove(id: string): Promise<void> {
      log.debug('remove', { id })
      const prev = this.list.find(c => c.id === id)
      this.removeLocal(id)
      try {
        await backend().deleteCharacter(id)
      } catch (err) {
        log.error('remove: write failed', { id, err })
        if (prev) this.upsertLocal(prev)
        toastUnlessNetwork(err, t('errors.removeFailed'))
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
      lastUpdatedById.clear()
    },
    setAll(chars: Character[], meta?: CharacterMeta[]) {
      log.debug('setAll', { count: chars.length })
      this.list = chars
      lastUpdatedById.clear()
      if (meta) for (const m of meta) lastUpdatedById.set(m.id, m.updated)
    },
    upsertLocal(char: Character, updated?: string) {
      if (updated) {
        const last = lastUpdatedById.get(char.id)
        if (last && last >= updated) {
          log.debug('upsertLocal: stale, ignoring', { id: char.id, last, incoming: updated })
          return
        }
        lastUpdatedById.set(char.id, updated)
      }
      const idx = this.list.findIndex(c => c.id === char.id)
      if (idx === -1) this.list.push(char)
      else this.list[idx] = char
    },
    removeLocal(id: string) {
      this.list = this.list.filter(c => c.id !== id)
      lastUpdatedById.delete(id)
      if (this.activeId === id) this.activeId = null
    },
  },
})
