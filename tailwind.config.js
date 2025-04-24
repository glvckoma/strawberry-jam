/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        'primary-bg': '#121212',
        'primary-bg-purple': '#1E1A29',
        'primary-bg-blue': '#162029',
        'primary-bg-green': '#1A2420',
        'primary-bg-red': '#291A1A',
        'primary-bg-neutral': '#1E1E1E',
        'secondary-bg': '#121212',
        'tertiary-bg': '#3A3D4D',
        'text-primary': '#C3C3C3',
        'highlight-yellow': '#f0b429',
        'highlight-green': '#38b000',
        'sidebar-bg': '#121212',
        'sidebar-border': '#3A3D4D',
        'custom-pink': '#F10048',
        'sidebar-text': '#C3C3C3',
        'sidebar-hover': '#2C2E34',
        'error-red': '#FF4D4F',
        'custom-blue': '#7785cc',
        'peachy-beige': '#FCE8C7'
      }
    }
  },
  content: [
    './src/**/*.{html,js}',
    './plugins/*.js',
    './plugins/*/!(node_modules)/**/*.js'
  ]
}
