/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Google Sans', 'Roboto', 'Arial', 'sans-serif'],
      },
      colors: {
        gdocs: {
          blue: '#1a73e8',
          hover: '#e8f0fe',
          border: '#e0e0e0',
          bg: '#f8f9fa',
        },
      },
    },
  },
  plugins: [],
}
