import type { Preview } from '@storybook/vue3-vite'
import { setup } from '@storybook/vue3-vite'
import { themes } from 'storybook/theming'
import { createPinia } from 'pinia'
import { LOCALES, setLocale, type Locale } from '@/locales/locale'
import { storyRouter } from '@/stories/router'
import { withNavigationNotice } from '@/stories/state'
import { STORY_NOW } from '@/stories/fixtures'

const RealDate = Date

// Clock frozen at the fixtures' time, so clocks and timestamps in stories render the same on every run.
class FixedDate extends RealDate {
  constructor(...args: ConstructorParameters<DateConstructor> | []) {
    if (args.length === 0) super(STORY_NOW)
    else super(...(args as ConstructorParameters<DateConstructor>))
  }
  static now() {
    return STORY_NOW
  }
}

import '@/assets/fonts'
import '@/assets/main.css'

setup((app) => {
  app.use(createPinia())
  app.use(storyRouter)
})

const preview: Preview = {
  tags: ['autodocs'],
  beforeEach() {
    globalThis.Date = FixedDate as DateConstructor
    return () => {
      globalThis.Date = RealDate
    }
  },
  globalTypes: {
    locale: {
      description: 'Interface language',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: LOCALES.map((value) => ({ value, title: value.toUpperCase() })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    locale: 'en',
  },
  decorators: [
    withNavigationNotice,
    (story, context) => {
      setLocale(context.globals.locale as Locale)
      return story()
    },
  ],
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    docs: { theme: themes.dark },
    viewport: {
      // Widths match the breakpoints in app/assets/main.css.
      options: {
        phone: { name: 'Phone 375', styles: { width: '375px', height: '812px' }, type: 'mobile' },
        phoneMax: { name: 'Phone max 719', styles: { width: '719px', height: '900px' }, type: 'mobile' },
        tablet: { name: 'Tablet 960', styles: { width: '960px', height: '1024px' }, type: 'tablet' },
        desktop: { name: 'Desktop 1280', styles: { width: '1280px', height: '800px' }, type: 'desktop' },
      },
    },
  },
}

export default preview
