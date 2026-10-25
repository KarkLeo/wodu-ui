import { createMemoryHistory, createRouter } from 'vue-router'

const Empty = { render: () => null }

// Same names and paths as app/pages, without middleware or lazy views: stories render the view
// themselves and only need useRoute()/useRouter() to resolve.
export const storyRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'character-list', component: Empty },
    { path: '/character/new', name: 'character-new', component: Empty },
    { path: '/character/:id', name: 'in-game', component: Empty },
    { path: '/party/:ids', name: 'party', component: Empty },
    { path: '/character/:id/levelup', name: 'level-up', component: Empty },
  ],
})
