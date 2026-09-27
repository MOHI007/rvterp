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
      }
    },
  },
  plugins: [],
}
