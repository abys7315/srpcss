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
          950: '#f8fafc',
          900: '#ffffff',
          850: '#f1f5f9',
          800: '#e2e8f0',
          700: '#cbd5e1',
          600: '#94a3b8',
          accent: '#2563eb',
          accentHover: '#1d4ed8',
          petroleum: '#059669',
          steel: '#0284c7',
          steelHover: '#0369a1',
          warning: '#f59e0b',
          danger: '#ef4444',
          success: '#10b981',
          steam: '#ea580c'
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
