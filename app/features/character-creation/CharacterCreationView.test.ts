import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import CharacterCreationView from './CharacterCreationView.vue'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import { draftTraining } from '@/stories/fixtures'
import { applyCommand } from '@/domain/reducer'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

async function mountTrainingStep() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const characters = useCharactersStore()
  characters.setAll([structuredClone(draftTraining)])
  const creation = useCreationStore()
  creation.setDraft(draftTraining.id)
  creation.setStep(2)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: () => null } },
      { path: '/character/new', component: CharacterCreationView },
    ],
  })
  await router.push('/character/new')
  wrapper = mount(CharacterCreationView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return characters
}

const hint = () => wrapper!.find('.cc-topbar-hint').text()

describe('CharacterCreationView step 2 hint', () => {
  it('asks for the missing abilities instead of claiming the step is done', async () => {
    await mountTrainingStep()
    expect(hint()).toBe('Choose abilities · 2 left')
  })

  it('says the path is set once the step is valid', async () => {
    const characters = await mountTrainingStep()
    const withHeal = applyCommand(draftTraining, { type: 'TOGGLE_ABILITY', id: 'heal' }).character
    characters.upsertLocal(applyCommand(withHeal, { type: 'TOGGLE_ABILITY', id: 'blessing' }).character)
    await flushPromises()
    expect(hint()).toBe('Cleric · path set')
  })
})
