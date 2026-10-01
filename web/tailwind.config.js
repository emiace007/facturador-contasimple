/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Nunito Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Paleta ContaSimple: azul del logo (#345BB6) como primario y amarillo del ícono como acento
        brand: {
          50: '#f0f3fa',
          100: '#e0e7f5',
          200: '#c2ceeb',
          300: '#98acdd',
          400: '#6685cc',
          500: '#3963c6',
          600: '#345bb6',
          700: '#2a4993',
          800: '#223b77',
          900: '#1b305f',
          950: '#111e3b',
        },
        acento: {
          100: '#fef3d6',
          300: '#fcd77a',
          400: '#fac43e',
          600: '#c98f0a',
        },
      },
    },
  },
  plugins: [],
};
