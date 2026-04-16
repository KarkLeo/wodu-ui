import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharactersStore } from './characters'
import type { Character } from '@/types/character'

const makeChar = (overrides: Partial<Character> = {}): Omit<Character, 'id' | 'createdAt'> => ({
  status: 'active',
  classId: 'fighter',
  name: 'Test Hero',
  look: '',
  alignment: 'good',
  race: 'human',
  bonds: [],
  startingMoveIds: [],
  stats: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 13 },
  currentHp: 16,
  maxHp: 16,
  armor: 1,
  xp: 0,
  level: 1,
  damageDice: 'd10',
  debilities: { weak: false, shaky: false, sick: false, stunned: false, confused: false, scarred: false },
  moveIds: ['fighter_bend_bars'],
  inventory: [],
  coins: 10,
  maxLoad: 14,
  ...overrides,
})

beforeEach(() => { setActivePinia(createPinia()) })

describe('useCharactersStore', () => {
  it('starts empty', () => {
    const store = useCharactersStore()
    expect(store.list).toHaveLength(0)
  })

  it('add() creates a character with id and createdAt', () => {
    const store = useCharactersStore()
    const char = store.add(makeChar())
    expect(store.list).toHaveLength(1)
    expect(char.id).toBeTruthy()
    expect(char.createdAt).toBeGreaterThan(0)
  })

  it('update() patches an existing character', () => {
    const store = useCharactersStore()
    const char = store.add(makeChar())
    store.update(char.id, { currentHp: 5 })
    expect(store.list[0].currentHp).toBe(5)
  })

  it('remove() deletes a character', () => {
    const store = useCharactersStore()
    const char = store.add(makeChar())
    store.remove(char.id)
    expect(store.list).toHaveLength(0)
  })

  it('getById() finds a character', () => {
    const store = useCharactersStore()
    const char = store.add(makeChar({ name: 'Bilbo' }))
    expect(store.getById(char.id)?.name).toBe('Bilbo')
  })
})
