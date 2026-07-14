import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fallar ruidosamente en build/arranque en vez de degradar en silencio a un
// valor hardcodeado. Si Cloudflare Pages no tiene las env vars configuradas,
// queremos enterarnos aquí y no con un 401 críptico tres pantallas después.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Nexus Booking] Faltan variables de entorno de Supabase.\n' +
      `  VITE_SUPABASE_URL:      ${supabaseUrl ? 'OK' : 'FALTA'}\n` +
      `  VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'OK' : 'FALTA'}\n` +
      'Local: copia .env.example a .env y rellénalo.\n' +
      'Prod:  Cloudflare Pages → Settings → Environment variables (¡y re-deploy!).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
