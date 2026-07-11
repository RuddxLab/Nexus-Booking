import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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
  color_primario:       '#8A9278',
  color_primario_suave: '#8A927820',
  color_fondo:          '#F5EFE8',
  color_superficie:     '#FFFFFF',
  color_superficie2:    '#F0EAE2',
  color_borde:          '#E8E0D5',
  color_texto:          '#2C2416',
  color_texto_suave:    '#8A7E6E',
  color_acento:         '#C8A46A',
  color_exito:          '#4A7C59',
  color_peligro:        '#C0392B',
  font_display:         'Space Grotesk',
  font_body:            'Inter',
}

export interface Tenant {
  idEmpresa:  number
  idSucursal: number
  slug:       string
  nombre:     string
  configUI:   TenantConfigUI
}

interface TenantCtx {
  tenant:  Tenant | null
  loading: boolean
  error:   string | null
}

const TenantContext = createContext<TenantCtx>({ tenant: null, loading: true, error: null })

/**
 * Aplica el config_ui como variables --rx-* en modo CLARO solamente.
 * El modo oscuro lo maneja CSS puro via [data-theme="oscuro"] con valores
 * hardcodeados — sin interferencia de inline styles.
 * Las variables --color-* del admin NO se tocan aquí para no romper el panel.
 */
function aplicarTema(cfg: TenantConfigUI) {
  const r = document.documentElement.style

  // Variables --rx-* para la página pública (modo claro del tenant)
  r.setProperty('--rx-primary',   cfg.color_primario)
  r.setProperty('--rx-psft',      cfg.color_primario_suave)
  r.setProperty('--rx-pglow',     cfg.color_primario + '33')
  r.setProperty('--rx-bg',        cfg.color_fondo)
  r.setProperty('--rx-bg2',       cfg.color_superficie2)
  r.setProperty('--rx-glass',     'rgba(255,255,255,.72)')
  r.setProperty('--rx-glass2',    cfg.color_superficie + 'E6')
  r.setProperty('--rx-surf',      cfg.color_superficie)
  r.setProperty('--rx-surf2',     cfg.color_superficie2)
  r.setProperty('--rx-bdr',       cfg.color_borde)
  r.setProperty('--rx-bdr2',      cfg.color_primario)
  r.setProperty('--rx-bdr-soft',  cfg.color_primario + '40')
  r.setProperty('--rx-ink',       cfg.color_texto)
  r.setProperty('--rx-muted',     cfg.color_texto_suave)
  r.setProperty('--rx-muted2',    cfg.color_texto_suave + '99')
  r.setProperty('--rx-acc',       cfg.color_acento)
  r.setProperty('--rx-ok',        cfg.color_exito)
  r.setProperty('--rx-err',       cfg.color_peligro)
  r.setProperty('--rx-shadow',    '0 1px 4px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.06)')
  r.setProperty('--rx-shadow-hover', '0 6px 24px ' + cfg.color_primario + '30')

  // También actualizar las variables --color-* para consistencia en el admin
  r.setProperty('--color-primary',      cfg.color_primario)
  r.setProperty('--color-primary-soft', cfg.color_primario_suave)
  r.setProperty('--color-bg',           cfg.color_fondo)
  r.setProperty('--color-surface',      cfg.color_superficie)
  r.setProperty('--color-surface-2',    cfg.color_superficie2)
  r.setProperty('--color-border',       cfg.color_borde)
  r.setProperty('--color-ink',          cfg.color_texto)
  r.setProperty('--color-ink-soft',     cfg.color_texto_suave)
  r.setProperty('--color-accent',       cfg.color_acento)
  r.setProperty('--color-success',      cfg.color_exito)
  r.setProperty('--color-danger',       cfg.color_peligro)
  r.setProperty('--color-primary-ink',  '#FFFFFF')
}

function limpiarTema() {
  const vars = [
    // rx vars
    '--rx-primary','--rx-psft','--rx-pglow','--rx-bg','--rx-bg2',
    '--rx-glass','--rx-glass2','--rx-surf','--rx-surf2',
    '--rx-bdr','--rx-bdr2','--rx-bdr-soft','--rx-ink','--rx-muted','--rx-muted2',
    '--rx-acc','--rx-ok','--rx-err','--rx-shadow','--rx-shadow-hover',
    // color vars
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
      try { await supabase.rpc('set_app_empresa_slug', { p_slug: slug }) } catch { /* no-op */ }

      const { data: empresa, error: errEmp } = await supabase
        .from('empresas')
        .select('id_empresa, nombre_empresa, slug, config_ui')
        .eq('slug', slug)
        .maybeSingle()

      if (errEmp || !empresa) {
        if (activo) { setError('Negocio no encontrado.'); setLoading(false) }
        return
      }

      const { data: sucursal } = await supabase
        .from('sucursales')
        .select('id_sucursal')
        .eq('id_empresa', empresa.id_empresa)
        .eq('activo', true)
        .order('id_sucursal')
        .limit(1)
        .maybeSingle()

      if (!activo) return

      const configUI: TenantConfigUI = {
        ...CONFIG_UI_DEFAULTS,
        ...(empresa.config_ui ?? {}),
      }

      aplicarTema(configUI)

      setTenant({
        idEmpresa:  empresa.id_empresa,
        idSucursal: sucursal?.id_sucursal ?? 1,
        slug:       empresa.slug,
        nombre:     empresa.nombre_empresa,
        configUI,
      })
      setLoading(false)
    }

    resolver().catch(e => {
      if (activo) { setError(e?.message ?? 'Error al cargar el negocio.'); setLoading(false) }
    })

    return () => {
      activo = false
      limpiarTema()
    }
  }, [slug])

  return (
    <TenantContext.Provider value={{ tenant, loading, error }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant(): TenantCtx {
  return useContext(TenantContext)
}
