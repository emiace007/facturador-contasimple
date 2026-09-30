/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta corporativa: verde agua como color primario del estudio
        brand: {
          50: '#f4f8f1',
          100: '#e3efdd',
          200: '#c8dcbc',
          300: '#a9c595',
          400: '#8fae7a',
          500: '#739660',
          600: '#5c7c4d',
          700: '#4d6746',
          800: '#3f5339',
          900: '#344530',
          950: '#1d281b',
        },
      },
    },
  },
  plugins: [],
};
