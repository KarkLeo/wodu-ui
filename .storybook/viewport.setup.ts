import { page } from 'vitest/browser'

// Lets a story resize the test browser (stories cannot import vitest/browser: Storybook itself has no such module).
;(globalThis as { __setStoryViewport?: (width: number, height: number) => Promise<void> }).__setStoryViewport =
  (width, height) => page.viewport(width, height)
