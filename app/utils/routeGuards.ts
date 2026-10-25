import type { RouteLocationRaw } from 'vue-router'
import type { Character } from '@/types/character'
import { createLogger } from '@/utils/logger'

const log = createLogger('router')

type GetById = (id: string) => Character | undefined

// dataReady is false while the online load has failed: a deep link must not be thrown away
// before the data it points at could be loaded.
export function partyGuard(
  ids: string | undefined,
  getById: GetById,
  dataReady = true,
): RouteLocationRaw | undefined {
  if (!dataReady) return undefined
  const raw = ids ?? ''
  const list = raw.split(',').map(s => s.trim()).filter(Boolean)
  const valid = list.filter(id => {
    const c = getById(id)
    return c && c.status !== 'draft'
  })
  if (valid.length === 0) {
    log.warn('guard:party → redirect', { ids: raw, reason: 'no valid characters' })
    return { name: 'character-list' }
  }
  if (valid.length !== list.length) {
    return { name: 'party', params: { ids: valid.join(',') } }
  }
}

export function levelUpGuard(id: string, getById: GetById, dataReady = true): RouteLocationRaw | undefined {
  if (!dataReady) return undefined
  const char = getById(id)
  if (!char || char.status !== 'active') {
    log.warn('guard:level-up → redirect', { id, reason: !char ? 'not found' : 'not active' })
    return { name: 'character-list' }
  }
}
