import { describe, it, expect } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { useLevelUp } from './useLevelUp'
import { makeCharacter } from '@/test/fixtures'
import type { CharacterCommand } from '@/domain/commands'

describe('useLevelUp', () => {
  it('starts over when the target level changes while the wizard is open', async () => {
    const char = ref(makeCharacter({ level: 2, xp: 3000, skillIds: ['athletics'] }))
    const dispatched: CharacterCommand[] = []
    const lv = useLevelUp(computed(() => char.value), (cmd) => dispatched.push(cmd))

    lv.init()
    lv.pickSkill('lore')
    expect(lv.phase.value).toBe('ability')

    char.value = { ...char.value, level: 5 }
    await nextTick()

    expect(lv.targetLevel.value).toBe(6)
    expect(lv.phase.value).toBe('skill')
    expect(lv.done.value.skill).toBe(false)
    expect(lv.pending.value.skillIds).toBeUndefined()
  })

  it('does not lose progress when unrelated character fields change', async () => {
    const char = ref(makeCharacter({ level: 2, xp: 3000, skillIds: ['athletics'] }))
    const lv = useLevelUp(computed(() => char.value), () => {})

    lv.init()
    lv.pickSkill('lore')
    char.value = { ...char.value, currentHp: 3 }
    await nextTick()

    expect(lv.phase.value).toBe('ability')
    expect(lv.pending.value.skillIds).toContain('lore')
  })
})
