import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
}

const colors = {
  brand: {
    paper: '#FAF9F6', // Pure high-quality technical paper
    ink: '#121212',   // Deep black ink
    mutedInk: '#666666',
    turquoise: '#1A6B74',
    softGreen: '#EDF5F0',
    mutedGreen: '#417D59',
    softRed: '#F5EDED',
    mutedRed: '#A64D4D',
    border: '#EBEBEB', 
  },
}

const theme = extendTheme({ 
  config,
  fonts: {
    heading: '"Inter", sans-serif',
    body: '"Inter", sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
  colors,
  styles: {
    global: {
      '@keyframes pulseGlow': {
        '0%': { opacity: 0.01 },
        '100%': { opacity: 0.05 },
      },
      body: {
        bg: 'brand.paper',
        color: 'brand.ink',
        fontSize: '13px',
      },
      '*': {
        borderColor: 'brand.border !important',
      }
    },
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: '0',
        fontWeight: '500',
        fontSize: '11px',
      },
      variants: {
        outline: {
          borderColor: 'brand.border',
          bg: 'transparent',
          _hover: {
            bg: 'rgba(0,0,0,0.02)',
          }
        },
        ghost: {
          _hover: {
            bg: 'rgba(0,0,0,0.02)',
          }
        }
      }
    },
    Badge: {
      variants: {
        premium: {
          bg: 'transparent',
          color: 'brand.ink',
          border: '1px solid',
          borderColor: 'brand.border',
          borderRadius: '0',
          px: 1,
          py: 0,
          textTransform: 'uppercase',
          fontSize: '9px',
          fontWeight: '700',
          fontFamily: 'mono',
        }
      }
    },
    Tag: {
      variants: {
        premium: {
          container: {
            bg: 'transparent',
            color: 'brand.mutedInk',
            border: '1px solid',
            borderColor: 'brand.border',
            borderRadius: '0',
            fontSize: '9px',
            fontWeight: '700',
            fontFamily: 'mono',
          }
        }
      }
    },
    Card: {
      variants: {
        outline: {
          container: {
            borderColor: 'brand.border',
            bg: 'brand.paper',
            boxShadow: 'none',
            borderRadius: '0',
          }
        }
      }
    }
  }
})

export { theme } 