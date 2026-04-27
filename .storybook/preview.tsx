import type { Preview } from '@storybook/react'
import { withThemeByClassName } from '@storybook/addon-themes'
import { fontVariableClassName } from '../src/styles/fonts'
import '../src/styles/globals.css'

if (typeof document !== 'undefined') {
  document.documentElement.classList.add(...fontVariableClassName.split(' '))
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'centered',
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
  ],
}

export default preview
