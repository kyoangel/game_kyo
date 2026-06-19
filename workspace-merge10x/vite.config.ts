import { defineConfig } from 'vite'

export default defineConfig({
  base: '/game_kyo/merge10x/',
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
