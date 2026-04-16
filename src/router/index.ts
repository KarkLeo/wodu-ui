import { createRouter, createWebHistory } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'

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
        // Защита: если персонаж не найден или draft → на главную
        const store = useCharactersStore()
        const char = store.getById(to.params.id as string)
        if (!char || char.status === 'draft') return { name: 'character-list' }
      },
    },
    {
      path: '/character/:id/levelup',
      name: 'level-up',
      component: () => import('@/features/level-up/LevelUpView.vue'),
      beforeEnter: (to) => {
        const store = useCharactersStore()
        const char = store.getById(to.params.id as string)
        if (!char || char.status !== 'active') return { name: 'character-list' }
      },
    },
  ],
})

export default router
