import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '../services/supabaseClient'

export interface TenantConfigUI {
  color_primario:       string
  color_primario_suave: string
  color_fondo:          string
  color_superficie:     string
  color_superficie2:    string
  color_borde:          string
  color_texto:          string
  color_texto_suave:    string
  color_acento:         string
  color_exito:          string
  color_peligro:        string
  font_display:         string
  font_body:            string
}

export const CONFIG_UI_DEFAULTS: TenantConfigUI = {
  color_primario:       '#6B7A5E',
  color_primario_suave: 'rgba(107,122,94,0.10)',
  color_fondo:          '#FAFAF5',
  color_superficie:     '#FFFFFF',
  color_superficie2:    '#F0EDE4',
  color_borde:          '#DDD9CE',
  color_texto:          '#2C2C28',
  color_texto_suave:    '#7A776E',
  color_acento:         '#C8A46A',
  color_exito:          '#4A8B62',
  color_peligro:        '#C0453E',
  font_display:         'Space Grotesk',
  font_body:            'Inter',
}

export interface SucursalOpcion {
  id_sucursal:     number
  nombre_sucursal: string
}

export interface Tenant {
  idEmpresa:  number
  idSucursal: number
  slug:       string
  nombre:     string
  sucursales: SucursalOpcion[]
  configUI:   TenantConfigUI
}

interface TenantCtx {
  tenant:      Tenant | null
  loading:     boolean
  error:       string | null
  setSucursal: (id: number) => void
}

const TenantContext = createContext<TenantCtx>({
  tenant: null, loading: true, error: null, setSucursal: () => {}
})

function aplicarTema(cfg: TenantConfigUI) {
  const r = document.documentElement.style
  r.setProperty('--color-bg',           cfg.color_fondo)
  r.setProperty('--color-surface',      cfg.color_superficie)
  r.setProperty('--color-surface-2',    cfg.color_superficie2)
  r.setProperty('--color-border',       cfg.color_borde)
  r.setProperty('--color-ink',          cfg.color_texto)
  r.setProperty('--color-ink-soft',     cfg.color_texto_suave)
  r.setProperty('--color-primary',      cfg.color_primario)
  r.setProperty('--color-primary-soft', cfg.color_primario_suave)
  r.setProperty('--color-primary-ink',  '#FFFFFF')
  r.setProperty('--color-accent',       cfg.color_acento)
  r.setProperty('--color-success',      cfg.color_exito)
  r.setProperty('--color-danger',       cfg.color_peligro)
  r.setProperty('--rx-primary',      cfg.color_primario)
  r.setProperty('--rx-psft',         cfg.color_primario_suave)
  r.setProperty('--rx-pglow',        cfg.color_primario + '33')
  r.setProperty('--rx-surf',         cfg.color_superficie)
  r.setProperty('--rx-surf2',        cfg.color_superficie2)
  r.setProperty('--rx-glass',        'rgba(255,255,255,.82)')
  r.setProperty('--rx-glass2',       cfg.color_superficie + 'EB')
  r.setProperty('--rx-bdr',          cfg.color_borde)
  r.setProperty('--rx-bdr2',         cfg.color_primario)
  r.setProperty('--rx-bdr-soft',     cfg.color_primario + '40')
  r.setProperty('--rx-ink',          cfg.color_texto)
  r.setProperty('--rx-muted',        cfg.color_texto_suave)
  r.setProperty('--rx-muted2',       cfg.color_texto_suave + '99')
  r.setProperty('--rx-acc',          cfg.color_acento)
  r.setProperty('--rx-ok',           cfg.color_exito)
  r.setProperty('--rx-err',          cfg.color_peligro)
  r.setProperty('--rx-grid-line',    cfg.color_primario + '10')
}

function limpiarTema() {
  const vars = [
    '--rx-primary','--rx-psft','--rx-pglow',
    '--rx-glass','--rx-glass2','--rx-surf','--rx-surf2',
    '--rx-bdr','--rx-bdr2','--rx-bdr-soft','--rx-ink','--rx-muted','--rx-muted2',
    '--rx-acc','--rx-ok','--rx-err','--rx-grid-line',
    '--color-primary','--color-primary-soft','--color-bg','--color-surface',
    '--color-surface-2','--color-border','--color-ink','--color-ink-soft',
    '--color-accent','--color-success','--color-danger','--color-primary-ink',
  ]
  vars.forEach(v => document.documentElement.style.removeProperty(v))
}

export function TenantProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [tenant,  setTenant]  = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    setLoading(true)
    setError(null)
    setTenant(null)

    async function resolver() {
      // Una sola RPC SECURITY DEFINER resuelve empresa + sucursales sin
      // depender del session setting app.current_empresa_id, que no
      // sobrevive entre transacciones del pool de PostgREST.
      const { data, error: errRpc } = await supabase
        .rpc('resolver_tenant_publico', { p_slug: slug })

      if (!activo) return

      if (errRpc) {
        setError('CONEXION'); setLoading(false); return
      }
      if (!data) {
        setError('NO_ENCONTRADO'); setLoading(false); return
      }

      const row = data as {
        id_empresa:     number
        nombre_empresa: string
        slug:           string
        config_ui:      Partial<TenantConfigUI> | null
        sucursales:     SucursalOpcion[]
      }

      const listaSucursales: SucursalOpcion[] = row.sucursales ?? []
      const primeraId = listaSucursales[0]?.id_sucursal ?? 1

      const configUI: TenantConfigUI = {
        ...CONFIG_UI_DEFAULTS,
        ...(row.config_ui ?? {}),
      }

      aplicarTema(configUI)

      setTenant({
        idEmpresa:  row.id_empresa,
        idSucursal: primeraId,
        slug:       row.slug,
        nombre:     row.nombre_empresa,
        sucursales: listaSucursales,
        configUI,
      })
      setLoading(false)
    }

    resolver().catch(() => {
      // Excepcion no controlada (tipicamente Failed to fetch en redes
      // moviles inestables) -> error de conexion, nunca no encontrado
      if (activo) { setError('CONEXION'); setLoading(false) }
    })

    return () => {
      activo = false
      limpiarTema()
    }
  }, [slug])

  const setSucursal = useCallback((id: number) => {
    setTenant(prev => prev ? { ...prev, idSucursal: id } : prev)
  }, [])

  return (
    <TenantContext.Provider value={{ tenant, loading, error, setSucursal }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant(): TenantCtx {
  return useContext(TenantContext)
}
