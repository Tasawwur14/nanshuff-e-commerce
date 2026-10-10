/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './views/**/*.{html,js,ejs}',
    './public/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#F5F5F5',
        'bg-secondary': '#E8E8E8',
        'bg-card': '#FFFFFF',
        'text-primary': '#2D2D2D',
        'text-secondary': '#71717A',
        'accent-brown': '#8C6A5D',
        'accent-brown-light': '#D4B896',
        'accent-brown-dark': '#5D4037',
      }
    },
  },
  plugins: [],
}