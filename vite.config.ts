import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    // Cloudflare Pages SPA fix: copia index.html como 404.html
    // CF Pages sirve 404.html cuando no encuentra la ruta → React Router funciona
    {
      name: 'cloudflare-spa-404',
      closeBundle() {
        copyFileSync('dist/index.html', 'dist/404.html')
        console.log('✅ dist/404.html generado para Cloudflare Pages SPA routing')
      },
    },
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})
