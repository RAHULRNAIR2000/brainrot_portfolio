/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: { 950: '#05070f', 900: '#0a1020', 800: '#111a30', 700: '#1a2642' },
        neon: { pink: '#ff3dac', cyan: '#3df2ff', amber: '#ffb347' },
        cream: '#f6ead7',
        // Istanbul paper and brass
        paper: { DEFAULT: '#f4ead5', deep: '#ebdcbd' },
        ink: { DEFAULT: '#1e1b2e', soft: '#4d475c', muted: '#665e70' },
        cobalt: '#1d4e9e',
        turq: { DEFAULT: '#2a9d97', deep: '#1f7a75' },
        stamp: '#c63b32',
        brass: '#c9993f',
        plum: '#6b4fbf',
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        neon: ['Pacifico', 'cursive'], // loader title only
      },
    },
  },
  plugins: [],
}
