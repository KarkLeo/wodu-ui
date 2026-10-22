import type { Preview } from '@storybook/vue3-vite'
import { setup } from '@storybook/vue3-vite'
import { themes } from 'storybook/theming'
import { createPinia } from 'pinia'
import { LOCALES, setLocale, type Locale } from '@/locales/locale'

import '@/assets/fonts'
import '@/assets/main.css'

setup((app) => {
  app.use(createPinia())
})

const preview: Preview = {
  tags: ['autodocs'],
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
      // Widths match the breakpoints in src/assets/main.css.
      options: {
        phone: { name: 'Phone 375', styles: { width: '375px', height: '812px' }, type: 'mobile' },
        phoneMax: { name: 'Phone max 719', styles: { width: '719px', height: '900px' }, type: 'mobile' },
        tablet: { name: 'Tablet 960', styles: { width: '960px', height: '1024px' }, type: 'tablet' },
      },
    },
  },
}

export default preview
