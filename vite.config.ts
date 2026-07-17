import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { AMBIENTES, ES_AMBIENTE, extraerProjectRef } from './src/config/ambientes'

/**
 * Falla el BUILD (no el runtime) si faltan las variables de Supabase.
 * Sin esto, un deploy sin env vars compila verde y entrega pantalla en
 * blanco al cliente. Mejor romper acá.
 */
function validarEnv(env: Record<string, string>, esBuild: boolean) {
  const requeridas = ['VITE_APP_ENV', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
  const faltantes = requeridas.filter((k) => !env[k])

  if (faltantes.length > 0) {
    const msg =
      `\n[Nexus Booking] Faltan variables de entorno:\n` +
      faltantes.map((k) => `   ✗ ${k}`).join('\n') +
      `\n\n   Local: cp .env.example .env y rellénalo.\n` +
      `   Prod:  Cloudflare Pages → Settings → Environment variables (Production Y Preview).\n`
    if (esBuild) throw new Error(msg)
    console.warn(msg)
    return
  }

  const url = env.VITE_SUPABASE_URL
  const ref = extraerProjectRef(url)
  if (!ref) {
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

  // ── GUARD DE AMBIENTE ───────────────────────────────────────────────
  // El corazón del mecanismo: el ambiente DECLARADO tiene que calzar con
  // la base a la que realmente apunta. Un deploy cruzado muere acá.
  const declarado = env.VITE_APP_ENV
  if (!ES_AMBIENTE(declarado)) {
    throw new Error(
      `\n[Nexus Booking] 🛑 VITE_APP_ENV="${declarado}" no es válido.\n` +
        `   Válidos: ${Object.keys(AMBIENTES).join(' | ')}\n`
    )
  }

  const def = AMBIENTES[declarado]
  if (def.projectRef && def.projectRef !== ref) {
    const real =
      Object.values(AMBIENTES).find((a) => a.projectRef === ref)?.id ?? 'DESCONOCIDA'
    throw new Error(
      `\n[Nexus Booking] 🛑 AMBIENTE CRUZADO — build abortado.\n\n` +
        `   VITE_APP_ENV declara:  ${declarado.toUpperCase()}  (esperaba ${def.projectRef})\n` +
        `   VITE_SUPABASE_URL apunta a: ${ref}  → ${String(real).toUpperCase()}\n\n` +
        `   Estás por compilar ${declarado.toUpperCase()} contra la base de ${String(real).toUpperCase()}.\n` +
        `   Revisa tu .env local o las env vars de Cloudflare Pages.\n`
    )
  }

  console.log(
    `\n[Nexus Booking] Ambiente: ${def.etiqueta}  ·  Supabase: ${ref}  ✓ verificado\n`
  )
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  validarEnv(env, command === 'build')

  return {
    plugins: [
      react(),
      // Cloudflare Pages SPA fix: copia index.html como 404.html.
      // Redundante con public/_redirects, pero inofensivo y sirve de red.
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
