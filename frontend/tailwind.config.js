/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sinal: o âmbar do controle remoto/da luz de foco — destaque, seleção e foco.
        brand: { DEFAULT: '#F2B705', dark: '#D9A200', light: '#FFD25C' },
        // Noite: azul-tinta de tela de TV desligada (não preto neutro).
        ink: { 950: '#0F1724', 900: '#141E2E', 850: '#172133', 800: '#1E2A3F', 700: '#26324A', 600: '#34415C' },
        // Textos: papel quente (guia de programação impresso) e névoa para o secundário.
        slate: { 100: '#ECE7DC', 200: '#DCD6C9', 300: '#C2C6CC', 400: '#8C96A8', 500: '#6B7588', 600: '#4A5468' },
        // No ar: o vermelho da luz de estúdio, só para "ao vivo".
        tally: '#E0412F',
      },
      fontFamily: { sans: ['Archivo Variable', 'Archivo', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
