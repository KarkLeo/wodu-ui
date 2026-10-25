import { createRouter, createWebHistory } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { createLogger } from '@/utils/logger'

const log = createLogger('router')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'character-list',
      component: () => import('@/features/character-list/CharacterListView.vue'),
    },
    {
      path: '/character/new',
      name: 'character-new',
      component: () => import('@/features/character-creation/CharacterCreationView.vue'),
    },
    {
      path: '/character/:id',
      name: 'in-game',
      redirect: (to) => ({ name: 'party', params: { ids: to.params.id } }),
    },
    {
      path: '/party/:ids',
      name: 'party',
      component: () => import('@/features/in-game/PartyView.vue'),
      beforeEnter: (to) => {
        const store = useCharactersStore()
        const raw = (to.params.ids as string) ?? ''
        const ids = raw.split(',').map(s => s.trim()).filter(Boolean)
        const valid = ids.filter(id => {
          const c = store.getById(id)
          return c && c.status !== 'draft'
        })
        if (valid.length === 0) {
          log.warn('guard:party → redirect', { ids: raw, reason: 'no valid characters' })
          return { name: 'character-list' }
        }
        if (valid.length !== ids.length) {
          return { name: 'party', params: { ids: valid.join(',') } }
        }
      },
    },
    {
      path: '/character/:id/levelup',
      name: 'level-up',
      component: () => import('@/features/level-up/LevelUpView.vue'),
      beforeEnter: (to) => {
        const store = useCharactersStore()
        const char = store.getById(to.params.id as string)
        if (!char || char.status !== 'active') {
          log.warn('guard:level-up → redirect', { id: to.params.id, reason: !char ? 'not found' : 'not active' })
          return { name: 'character-list' }
        }
      },
    },
  ],
})

router.beforeEach((to, from) => {
  log.debug('navigate', { from: from.fullPath, to: to.fullPath, name: String(to.name) })
})

export default router
