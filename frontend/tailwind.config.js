/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#f43f5e', dark: '#e11d48', light: '#fda4af' },
        ink: { 950: '#07090d', 900: '#0d1017', 850: '#121620', 800: '#181d29', 700: '#232a3a', 600: '#333d52' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
