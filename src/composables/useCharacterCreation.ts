import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import type { Character } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'

export function useCharacterCreation() {
  const router = useRouter()
  const characters = useCharactersStore()
  const creation = useCreationStore()

  const draft = computed(() => (creation.draftId ? characters.getById(creation.draftId) : undefined))

  function createDraft() {
    if (creation.draftId && characters.getById(creation.draftId)) {
      return characters.getById(creation.draftId)!
    }
    // Создаём черновик ЯВНО (не в onMounted)
    const char = characters.add({
      status: 'draft',
      classId: 'fighter',
      name: '',
      level: 1,
      xp: 0,
      stats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      statRolls: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      hitDice: 1,
      currentHp: 0,
      maxHp: 0,
      skillIds: [],
      abilityIds: [],
      inventory: [],
      coins: 60,
      damageBonusDice: 0,
      notes: '',
    })
    creation.setDraft(char.id)
    return char
  }

  function patch(data: Partial<Character>) {
    if (creation.draftId) characters.update(creation.draftId, data)
  }

  function next() {
    creation.nextStep()
  }

  function back() {
    if (creation.step === 1) {
      if (creation.draftId) characters.remove(creation.draftId)
      creation.reset()
      router.push('/')
    } else {
      creation.prevStep()
    }
  }

  function finish() {
    if (!creation.draftId) return
    characters.update(creation.draftId, { status: 'active' })
    characters.setActive(creation.draftId)
    const id = creation.draftId
    creation.reset()
    router.push(`/character/${id}`)
  }

  function dispatch(cmd: CharacterCommand) {
    if (creation.draftId) characters.dispatch(creation.draftId, cmd)
  }

  return { draft, step: computed(() => creation.step), createDraft, patch, dispatch, next, back, finish }
}
