/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ms: {
          blue: '#002677',   // Azul da Bandeira MS
          green: '#21732e',  // Verde da Bandeira MS
          gold: '#fcc201',   // Dourado da Bandeira MS
          gray: '#f1f5f9',
          dark: 'var(--bg-page)',   
          card: 'var(--bg-card)',   
          header: 'var(--header-bg)',
          accent: 'var(--accent-ms)',
          main: 'var(--text-main)', 
          border: 'var(--border-main)',
          yellow: '#f59e0b', 
          red: '#ef4444'     
        },
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#002677', // Azul da Bandeira MS
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#002677',
        }
      }
    },
  },
  plugins: [],
}
