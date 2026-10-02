/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Orden importa: las reglas que aparecen después pisan a las anteriores.
    screens: {
      // Menú lateral: tablet parada, compu o cualquier pantalla acostada (celular o tablet apaisados)
      lateral: { raw: '(min-width: 768px), (orientation: landscape) and (min-width: 640px)' },
      // Facturar en dos columnas (teclado a la derecha): pantallas anchas o acostadas
      dos: { raw: '(min-width: 1024px), (orientation: landscape) and (min-width: 640px)' },
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      // Pantallas bajitas (celular acostado): todo más compacto
      bajo: { raw: '(orientation: landscape) and (max-height: 540px)' },
    },
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
