import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
}

const theme = extendTheme({ 
  config,
  styles: {
    global: (props: any) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'gray.900' : 'white',
      },
    }),
  },
  colors: {
    customBg: {
      light: 'white',
      dark: 'gray.800',
    },
    customText: {
      light: 'gray.800',
      dark: 'whiteAlpha.900',
    }
  }
})

export { theme } 