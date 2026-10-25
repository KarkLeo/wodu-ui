import type { RouteLocationRaw } from 'vue-router'
import type { Character } from '@/types/character'
import { createLogger } from '@/utils/logger'

const log = createLogger('router')

type GetById = (id: string) => Character | undefined

export function partyGuard(ids: string, getById: GetById): RouteLocationRaw | undefined {
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

export function levelUpGuard(id: string, getById: GetById): RouteLocationRaw | undefined {
  const char = getById(id)
  if (!char || char.status !== 'active') {
    log.warn('guard:level-up → redirect', { id, reason: !char ? 'not found' : 'not active' })
    return { name: 'character-list' }
  }
}
