import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'

/**
 * Falla el BUILD (no el runtime) si faltan las variables de Supabase.
 * Sin esto, un deploy sin env vars compila verde y entrega pantalla en
 * blanco al cliente. Mejor romper acá.
 */
function validarEnv(env: Record<string, string>, esBuild: boolean) {
  const requeridas = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
  const faltantes = requeridas.filter((k) => !env[k])

  if (faltantes.length > 0) {
    const msg =
      `\n[Nexus Booking] Faltan variables de entorno:\n` +
      faltantes.map((k) => `   ✗ ${k}`).join('\n') +
      `\n\n   Local: cp .env.example .env y rellénalo.\n` +
      `   Prod:  Cloudflare Pages → Settings → Environment variables (Production Y Preview).\n`
    // En build abortamos; en dev solo avisamos para no bloquear el arranque.
    if (esBuild) throw new Error(msg)
    console.warn(msg)
    return
  }

  const url = env.VITE_SUPABASE_URL
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
    throw new Error(`\n[Nexus Booking] VITE_SUPABASE_URL con formato inesperado: ${url}\n`)
  }

  const key = env.VITE_SUPABASE_ANON_KEY
  // Bloquea el error caro: mandar una key secreta al bundle del navegador.
  if (key.startsWith('sb_secret_') || key.includes('service_role')) {
    throw new Error(
      `\n[Nexus Booking] 🛑 VITE_SUPABASE_ANON_KEY contiene una key SECRETA.\n` +
        `   Las variables VITE_* se empaquetan en el bundle público.\n` +
        `   Usa la publishable key (sb_publishable_...).\n`
    )
  }
  if (!key.startsWith('sb_publishable_')) {
    console.warn(
      `\n[Nexus Booking] ⚠️  Usando la anon key legacy (JWT). Sigue funcionando,\n` +
        `   pero Supabase la deprecia a fin de 2026. Migra a sb_publishable_...\n`
    )
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  validarEnv(env, command === 'build')

  return {
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
  }
})
