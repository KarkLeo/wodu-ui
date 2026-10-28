import { createMemoryHistory, createRouter } from 'vue-router'

const Empty = { render: () => null }

// Same names and paths as app/pages, without middleware or lazy views: stories render the view
// themselves and only need useRoute()/useRouter() to resolve.
export const storyRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'landing', component: Empty },
    { path: '/games', name: 'games', component: Empty },
    { path: '/characters', name: 'characters', component: Empty },
    { path: '/profile', name: 'profile', component: Empty },
    { path: '/character/new', name: 'character-new', component: Empty },
    { path: '/character/:id', name: 'in-game', component: Empty },
    { path: '/party/:ids', name: 'party', component: Empty },
    { path: '/character/:id/levelup', name: 'level-up', component: Empty },
    { path: '/games/:gameId', name: 'game', component: Empty },
    { path: '/games/:gameId/party/:ids', name: 'game-party', component: Empty },
    { path: '/games/:gameId/new', name: 'game-character-new', component: Empty },
    { path: '/games/:gameId/settings', name: 'game-settings', component: Empty },
    { path: '/games/:gameId/monsters', name: 'game-monsters', component: Empty },
    { path: '/join/:code', name: 'join', component: Empty },
    { path: '/offline', name: 'offline', component: Empty },
    { path: '/offline/party/:ids', name: 'offline-party', component: Empty },
    { path: '/offline/new', name: 'offline-character-new', component: Empty },
    { path: '/offline/character/:id/levelup', name: 'offline-level-up', component: Empty },
  ],
})
