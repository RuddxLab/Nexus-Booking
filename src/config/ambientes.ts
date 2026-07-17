/**
 * ── FUENTE ÚNICA DE VERDAD DEL AMBIENTE (datos puros) ─────────────────
 *
 * Este archivo se versiona y es IDÉNTICO en el repo QA y en el repo PROD.
 * Sin secretos: los project-ref de Supabase son públicos (viajan en cada
 * request desde el browser). Lo secreto son las keys, y esas siguen en
 * .env / Cloudflare env vars.
 *
 * Sin `import.meta.env` acá a propósito: vite.config.ts importa este archivo
 * en tiempo de build, donde `import.meta.env` no existe.
 */

export type Ambiente = 'local' | 'qa' | 'prod'

export interface DefinicionAmbiente {
  id: Ambiente
  etiqueta: string
  /** project-ref de Supabase esperado. null = cualquiera (local). */
  projectRef: string | null
  /** Color del badge. null = sin badge (prod). */
  color: string | null
  /** Prefijo del <title> del documento. */
  prefijoTitulo: string
}

export const AMBIENTES: Record<Ambiente, DefinicionAmbiente> = {
  local: {
    id: 'local',
    etiqueta: 'LOCAL',
    projectRef: null,
    color: '#8b5cf6', // violeta
    prefijoTitulo: '[LOCAL] ',
  },
  qa: {
    id: 'qa',
    etiqueta: 'QA — Base Polish',
    projectRef: 'axgxsmovzfmaasyzmnqn',
    color: '#f59e0b', // ámbar
    prefijoTitulo: '[QA] ',
  },
  prod: {
    id: 'prod',
    etiqueta: 'PRODUCCIÓN',
    projectRef: 'mkbsfmoknsbhbskayrgg',
    color: null, // sin badge: la ausencia de color ES la señal
    prefijoTitulo: '',
  },
}

export const ES_AMBIENTE = (v: unknown): v is Ambiente =>
  typeof v === 'string' && v in AMBIENTES

/** Extrae el project-ref de una URL de Supabase. */
export function extraerProjectRef(url: string): string | null {
  const m = url?.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/)
  return m ? m[1] : null
}
