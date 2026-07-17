/**
 * Resolución del ambiente en runtime. Los datos viven en ./ambientes.ts
 * (compartido con vite.config.ts, que no puede leer import.meta.env).
 */
import { AMBIENTES, ES_AMBIENTE, type Ambiente } from './ambientes'

const raw = import.meta.env.VITE_APP_ENV

if (!ES_AMBIENTE(raw)) {
  throw new Error(
    `[Nexus Booking] VITE_APP_ENV inválido o ausente: "${raw}".\n` +
      `  Válidos: local | qa | prod\n` +
      `  Local:  agrégalo a tu .env\n` +
      `  Cloudflare Pages: Settings → Environment variables (Production Y Preview)`
  )
}

export const AMBIENTE = AMBIENTES[raw as Ambiente]
export const esProd = AMBIENTE.id === 'prod'
export const esQA = AMBIENTE.id === 'qa'
export const esLocal = AMBIENTE.id === 'local'

export type { Ambiente }
