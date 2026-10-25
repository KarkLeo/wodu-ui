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
  await expect(page).toMatchScreenshot({
    screenshotOptions: { mask: Array.from(document.querySelectorAll('canvas')) },
  })
})
