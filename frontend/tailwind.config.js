/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        industrial: {
          950: '#070b12',
          900: '#0c1322',
          850: '#111b2e',
          800: '#17233c',
          700: '#223254',
          600: '#344970',
          accent: '#06b6d4',
          accentHover: '#0891b2',
          warning: '#f59e0b',
          danger: '#ef4444',
          success: '#10b981',
          steam: '#f97316'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'steam-flow': 'steam 2s ease-in-out infinite alternate',
      },
      keyframes: {
        steam: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: 0.7 },
          '100%': { transform: 'translateY(-6px) scale(1.05)', opacity: 0.95 },
        }
      }
    },
  },
  plugins: [],
}
