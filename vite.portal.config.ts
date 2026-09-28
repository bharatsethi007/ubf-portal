// Customer portal build: `npm run build:portal` -> dist-portal/
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

export default mergeConfig(
  base,
  defineConfig({
    build: {
      outDir: 'dist-portal',
      emptyOutDir: true,
      rollupOptions: { input: 'portal.html' },
    },
  }),
)
