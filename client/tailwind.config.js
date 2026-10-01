/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#070B14',
        neon: {
          cyan: '#00F0FF',
          green: '#00FF66',
          red: '#FF3366',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'neon-cyan': '0 0 18px rgba(0,240,255,0.28), 0 0 60px rgba(0,240,255,0.12)',
        'neon-green': '0 0 18px rgba(0,255,102,0.28), 0 0 60px rgba(0,255,102,0.10)',
        'neon-red': '0 0 18px rgba(255,51,102,0.30), 0 0 60px rgba(255,51,102,0.12)',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.8)' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
