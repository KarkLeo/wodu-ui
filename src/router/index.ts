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
      component: () => import('@/features/in-game/InGameView.vue'),
      beforeEnter: (to) => {
        const store = useCharactersStore()
        const char = store.getById(to.params.id as string)
        if (!char || char.status === 'draft') {
          log.warn('guard:in-game → redirect', { id: to.params.id, reason: !char ? 'not found' : 'draft' })
          return { name: 'character-list' }
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
