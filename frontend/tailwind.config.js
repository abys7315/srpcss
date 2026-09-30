/** @type {import('tailwindcss').Config} */
// Every colour resolves to a CSS variable defined in src/index.css (light "paper" / dark "night shift").
// Legacy palette names used across pages (slate, blue, emerald, ...) are remapped onto the same
// semantic tokens so the whole UI follows the theme without per-component dark: variants.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const neutral = {
  50: v('bg'), 100: v('sunk'), 200: v('rule'), 300: v('rule'),
  400: v('muted'), 500: v('muted'), 600: v('muted'),
  700: v('ink'), 800: v('ink'), 900: v('ink'), 950: v('ink'),
};
const semantic = (n) => ({
  50: v(`${n}-t`), 100: v(`${n}-t`), 200: v(`${n}-b`), 300: v(`${n}-b`),
  400: v(n), 500: v(n), 600: v(n), 700: v(n), 800: v(n), 900: v(n), 950: v(n),
});

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Theme switching is done with CSS variables on html.dark; dark: utilities are intentionally inert.
  darkMode: ['selector', '.__dark-variants-disabled'],
  corePlugins: { textTransform: false },
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      white: v('panel'),
      black: v('ink'),
      bg: v('bg'), panel: v('panel'), sunk: v('sunk'), ink: v('ink'), muted: v('muted'), rule: v('rule'),
      accent: v('accent'), ok: v('ok'), warn: v('warn'), alarm: v('alarm'), steam: v('steam'), highlight: v('highlight'),
      'accent-t': v('accent-t'), 'ok-t': v('ok-t'), 'warn-t': v('warn-t'), 'alarm-t': v('alarm-t'), 'steam-t': v('steam-t'),
      'accent-b': v('accent-b'), 'ok-b': v('ok-b'), 'warn-b': v('warn-b'), 'alarm-b': v('alarm-b'), 'steam-b': v('steam-b'),
      slate: neutral, gray: neutral, zinc: neutral, neutral, stone: neutral,
      blue: semantic('accent'), indigo: semantic('accent'), violet: semantic('accent'),
      purple: semantic('accent'), fuchsia: semantic('accent'), pink: semantic('accent'),
      cyan: semantic('steam'), sky: semantic('steam'), teal: semantic('steam'),
      emerald: semantic('ok'), green: semantic('ok'), lime: semantic('ok'),
      amber: semantic('warn'), yellow: semantic('warn'), orange: semantic('warn'),
      red: semantic('alarm'), rose: semantic('alarm'),
      industrial: {
        950: v('bg'), 900: v('panel'), 850: v('sunk'), 800: v('rule'), 700: v('rule'), 600: v('muted'),
        accent: v('accent'), accentHover: v('accent'), petroleum: v('ok'), steel: v('steam'),
        steelHover: v('steam'), warning: v('warn'), danger: v('alarm'), success: v('ok'), steam: v('steam'),
      },
    },
    fontFamily: {
      sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      cond: ['"IBM Plex Sans Condensed"', '"IBM Plex Sans"', 'sans-serif'],
      mono: ['"IBM Plex Mono"', 'ui-monospace', 'Consolas', 'monospace'],
    },
    borderRadius: {
      none: '0', sm: '2px', DEFAULT: '2px', md: '2px', lg: '2px', xl: '2px', '2xl': '2px', '3xl': '2px', full: '2px',
    },
    boxShadow: { none: 'none', DEFAULT: 'none', xs: 'none', '2xs': 'none', sm: 'none', md: 'none', lg: 'none', xl: 'none', '2xl': 'none', inner: 'none' },
    dropShadow: { none: 'none', DEFAULT: 'none', sm: 'none', md: 'none', lg: 'none', xl: 'none', '2xl': 'none' },
    backgroundImage: {},
    letterSpacing: { tighter: '0', tight: '0', normal: '0', wide: '0', wider: '0', widest: '0' },
    extend: {
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '18px' }],
      },
      transitionDuration: { DEFAULT: '120ms', 75: '75ms', 100: '100ms', 150: '120ms', 200: '120ms', 250: '120ms', 300: '120ms', 500: '120ms', 700: '120ms', 1000: '120ms' },
      transitionProperty: {
        all: 'color, background-color, border-color, fill, stroke, opacity',
        DEFAULT: 'color, background-color, border-color, fill, stroke, opacity',
        transform: 'color, background-color, border-color',
      },
      animation: {
        none: 'none', spin: 'spin 1s linear infinite', ping: 'none', pulse: 'none', bounce: 'none',
        'pulse-subtle': 'none', 'steam-flow': 'none',
        enter: 'enter 140ms ease-out both',
        draw: 'draw 700ms ease-out both',
      },
      keyframes: {
        enter: { from: { opacity: '0', transform: 'translateY(2px)' }, to: { opacity: '1', transform: 'none' } },
        draw: { from: { strokeDashoffset: '1' }, to: { strokeDashoffset: '0' } },
      },
    },
  },
  plugins: [],
};
