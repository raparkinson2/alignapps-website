/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#080c14',
        'bg-2': '#0d1526',
        'bg-card': '#0f1a2e',
        'bg-card-hover': '#152236',
        'border-subtle': 'rgba(255,255,255,0.07)',
        'border-hover': 'rgba(103,232,249,0.25)',
        accent: {
          cyan: '#67e8f9',
          purple: '#a78bfa',
          green: '#22c55e',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'SF Pro Display', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
