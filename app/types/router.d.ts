import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /**
     * Which frame app.vue puts the page in: `bare` renders it alone and never gates it (the landing),
     * `cabinet` puts it under the cabinet header behind sign-in, and none means the table layout.
     */
    shell?: 'bare' | 'cabinet'
  }
}

export {}
