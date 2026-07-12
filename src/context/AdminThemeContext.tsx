/**
 * AdminThemeContext
 * Carga config_ui_admin desde la BD y aplica las variables --adm-* al DOM.
 * Completamente separado de TenantContext (que maneja el tema público --rx-*).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../services/supabaseClient'
import { useUserRole } from '../hooks/useUserRole'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AdminConfigUI {
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
}

export const ADMIN_CONFIG_DEFAULTS: AdminConfigUI = {
  color_primario:       '#6B7A5E',
  color_primario_suave: '#6B7A5E20',
  color_fondo:          '#F4F6F3',
  color_superficie:     '#FFFFFF',
  color_superficie2:    '#EDEEE9',
  color_borde:          '#D8DDD2',
  color_texto:          '#1E2419',
  color_texto_suave:    '#6B7265',
  color_acento:         '#C8A46A',
  color_exito:          '#4A7C59',
  color_peligro:        '#C0453E',
}

interface AdminThemeCtx {
  configAdmin: AdminConfigUI
  loading:     boolean
}

const AdminThemeContext = createContext<AdminThemeCtx>({
  configAdmin: ADMIN_CONFIG_DEFAULTS,
  loading:     true,
})

// ── Aplicar variables CSS --adm-* ─────────────────────────────────────────────

function aplicarTemaAdmin(cfg: AdminConfigUI) {
  const r = document.documentElement.style
  r.setProperty('--adm-primary',      cfg.color_primario)
  r.setProperty('--adm-psft',         cfg.color_primario_suave)
  r.setProperty('--adm-pglow',        cfg.color_primario + '33')
  r.setProperty('--adm-bg',           cfg.color_fondo)
  r.setProperty('--adm-surf',         cfg.color_superficie)
  r.setProperty('--adm-surf2',        cfg.color_superficie2)
  r.setProperty('--adm-bdr',          cfg.color_borde)
  r.setProperty('--adm-ink',          cfg.color_texto)
  r.setProperty('--adm-muted',        cfg.color_texto_suave)
  r.setProperty('--adm-acc',          cfg.color_acento)
  r.setProperty('--adm-ok',           cfg.color_exito)
  r.setProperty('--adm-err',          cfg.color_peligro)
  // También actualizar --color-* para que los componentes admin existentes reciban el tema
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
  r.setProperty('--color-primary-hover', cfg.color_primario + 'CC')
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const { idEmpresa, loading: roleLoading } = useUserRole()
  const [configAdmin, setConfigAdmin] = useState<AdminConfigUI>(ADMIN_CONFIG_DEFAULTS)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (roleLoading) return
    if (!idEmpresa) {
      aplicarTemaAdmin(ADMIN_CONFIG_DEFAULTS)
      setLoading(false)
      return
    }

    async function cargar() {
      try {
        const { data } = await supabase
          .from('empresas')
          .select('config_ui_admin')
          .eq('id_empresa', idEmpresa)
          .single()
        const cfg: AdminConfigUI = {
          ...ADMIN_CONFIG_DEFAULTS,
          ...(data?.config_ui_admin ?? {}),
        }
        setConfigAdmin(cfg)
        aplicarTemaAdmin(cfg)
      } catch {
        aplicarTemaAdmin(ADMIN_CONFIG_DEFAULTS)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [idEmpresa, roleLoading])

  return (
    <AdminThemeContext.Provider value={{ configAdmin, loading }}>
      {children}
    </AdminThemeContext.Provider>
  )
}

export function useAdminTheme(): AdminThemeCtx {
  return useContext(AdminThemeContext)
}
