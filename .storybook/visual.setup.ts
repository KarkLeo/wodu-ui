import { afterEach, beforeEach, expect } from 'vitest'
import { page } from 'vitest/browser'

const FREEZE_ID = 'visual-freeze'

beforeEach(() => {
  if (document.getElementById(FREEZE_ID)) return
  const style = document.createElement('style')
  style.id = FREEZE_ID
  style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }'
  document.head.appendChild(style)
})

// Runs after the story's play function has resolved; the story is still mounted at this point.
afterEach(async (ctx) => {
  if (ctx.task.result?.state === 'fail' || ctx.task.mode !== 'run') return
  await document.fonts.ready
  // Stories render in an iframe of fixed size, so content taller than the viewport is clipped unless the viewport grows to fit it.
  const { innerWidth: width, innerHeight: height } = window
  const fullHeight = Math.max(height, document.documentElement.scrollHeight)
  if (fullHeight > height) await page.viewport(width, fullHeight)
  try {
    await expect(page).toMatchScreenshot({
      screenshotOptions: { target: 'page', fullPage: true, mask: [page.elementLocator(document.body).locator('canvas')] },
    })
  } finally {
    if (fullHeight > height) await page.viewport(width, height)
  }
})
