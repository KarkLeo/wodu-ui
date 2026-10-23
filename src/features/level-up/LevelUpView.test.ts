import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import LevelUpView from './LevelUpView.vue'
import StepSkill from './components/StepSkill.vue'
import { useCharactersStore } from '@/stores/characters'
import { makeCharacter } from '@/test/fixtures'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

async function mountAtLevel(level: number) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useCharactersStore()
  store.setAll([makeCharacter({ id: 'hero', level, xp: 45000, skillIds: ['athletics'] })])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: () => null } },
      { path: '/character/:id', component: { render: () => null } },
      { path: '/character/:id/levelup', component: LevelUpView },
    ],
  })
  await router.push('/character/hero/levelup')
  wrapper = mount(LevelUpView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return store
}

describe('LevelUpView', () => {
  it('clears the current selection when the target level changes under it', async () => {
    const store = await mountAtLevel(2)
    wrapper!.findComponent(StepSkill).vm.$emit('update:selected', 'lore')
    await flushPromises()
    expect(wrapper!.findComponent(StepSkill).props('selected')).toBe('lore')

    store.upsertLocal({ ...store.getById('hero')!, level: 5 })
    await flushPromises()

    expect(wrapper!.findComponent(StepSkill).props('selected')).toBeNull()
  })
})
