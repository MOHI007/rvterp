/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Anek Bangla"', 'sans-serif'],
      },
      colors: {
        brand: {
          orange: '#FF6B00',
          amber: '#FF9900',
        },
        surface: '#F9FAFB',
        accent: {
          lavender: '#E0E7FF',
          peach: '#FFEDD5',
        }
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        }
      },
      animation: {
        shake: 'shake 0.2s ease-in-out 0s 2',
      }
    },
  },
  plugins: [],
}
