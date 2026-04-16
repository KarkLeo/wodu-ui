import { createRouter, createWebHistory } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/features/character-list/CharacterListView.vue'),
    },
    {
      path: '/character/new',
      component: () => import('@/features/character-creation/CharacterCreationView.vue'),
    },
    {
      path: '/character/:id',
      component: () => import('@/features/in-game/InGameView.vue'),
      beforeEnter: (to) => {
        // Защита: если персонаж не найден или draft → на главную
        const store = useCharactersStore()
        const char = store.getById(to.params.id as string)
        if (!char || char.status === 'draft') return '/'
      },
    },
    {
      path: '/character/:id/levelup',
      component: () => import('@/features/level-up/LevelUpView.vue'),
      beforeEnter: (to) => {
        const store = useCharactersStore()
        const char = store.getById(to.params.id as string)
        if (!char || char.status !== 'active') return '/'
      },
    },
  ],
})

export default router
