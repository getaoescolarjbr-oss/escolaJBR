/** @type {import('tailwindcss').Config} */
export default {
  // As variantes dark: seguem o tema escolhido no portal (App.tsx põe .light-theme no
  // <html>), não o tema do sistema operacional. No padrão ("media"), quem usa Windows/
  // celular no modo escuro via os estilos escuros por cima do tema claro — botão cinza-
  // escuro com texto escuro, texto cinza-claro em fundo claro.
  darkMode: ['variant', 'html:not(.light-theme) &'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ms: {
          blue: '#002677',   // Azul da Bandeira MS (uso em fundo sólido / marca)
          // Cores que mudam com o tema: canais RGB em src/index.css (--*-rgb), para que a
          // transparência funcione (bg-ms-dark/60, border-ms-border/50...).
          blueText: 'rgb(var(--ms-blue-text-rgb) / <alpha-value>)', // Azul MS para texto/ícone/borda — adapta contraste por tema
          green: '#21732e',  // Verde da Bandeira MS
          gold: '#fcc201',   // Dourado da Bandeira MS
          gray: '#f1f5f9',
          dark: 'rgb(var(--bg-page-rgb) / <alpha-value>)',
          card: 'rgb(var(--bg-card-rgb) / <alpha-value>)',
          header: 'rgb(var(--header-bg-rgb) / <alpha-value>)',
          accent: 'rgb(var(--accent-ms-rgb) / <alpha-value>)',
          main: 'rgb(var(--text-main-rgb) / <alpha-value>)',
          muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
          border: 'rgb(var(--border-main-rgb) / <alpha-value>)',
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
