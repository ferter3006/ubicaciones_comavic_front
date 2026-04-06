/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './src/routes/**/*.{svelte,ts,js}',
    './src/lib/**/*.{svelte,ts,js}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2A6A4F',
        secondary: '#C1A259'
      }
    },
  },
  plugins: [],
};
