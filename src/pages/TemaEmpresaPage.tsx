import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../services/supabaseClient'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import { PageHeader } from '../components/Common/PageHeader'
import { CONFIG_UI_DEFAULTS, type TenantConfigUI } from '../context/TenantContext'
import { ADMIN_CONFIG_DEFAULTS, type AdminConfigUI, useAdminTheme } from '../context/AdminThemeContext'

// ── Campos editables ──────────────────────────────────────────────────────────

interface CampoColor<T> {
  key: keyof T
  label: string
  descripcion: string
  grupo: string
}

const CAMPOS_PUBLICO: CampoColor<TenantConfigUI>[] = [
  { key: 'color_primario',       label: 'Color primario',        descripcion: 'Botones, pasos activos, links',        grupo: 'Marca' },
  { key: 'color_primario_suave', label: 'Primario suave',        descripcion: 'Hover y focus rings',                  grupo: 'Marca' },
  { key: 'color_acento',         label: 'Color de acento',       descripcion: 'Detalles decorativos y badges',        grupo: 'Marca' },
  { key: 'color_fondo',          label: 'Fondo de página',       descripcion: 'Color base de la página pública',      grupo: 'Superficies' },
  { key: 'color_superficie',     label: 'Tarjetas',              descripcion: 'Fondo de cards y modales',             grupo: 'Superficies' },
  { key: 'color_superficie2',    label: 'Superficie secundaria', descripcion: 'Panel lateral y fondos alternativos',  grupo: 'Superficies' },
  { key: 'color_borde',          label: 'Bordes',                descripcion: 'Líneas divisoras y contornos',         grupo: 'Superficies' },
  { key: 'color_texto',          label: 'Texto principal',       descripcion: 'Títulos y cuerpo de texto',            grupo: 'Tipografía' },
  { key: 'color_texto_suave',    label: 'Texto secundario',      descripcion: 'Labels, subtítulos, placeholders',     grupo: 'Tipografía' },
  { key: 'color_exito',          label: 'Color de éxito',        descripcion: 'Confirmaciones y estados OK',          grupo: 'Estados' },
  { key: 'color_peligro',        label: 'Color de error',        descripcion: 'Errores y cancelaciones',              grupo: 'Estados' },
]

const CAMPOS_ADMIN: CampoColor<AdminConfigUI>[] = [
  { key: 'color_primario',       label: 'Color primario',        descripcion: 'Sidebar activo, botones principales',  grupo: 'Marca' },
  { key: 'color_primario_suave', label: 'Primario suave',        descripcion: 'Hover y focus rings del admin',        grupo: 'Marca' },
  { key: 'color_acento',         label: 'Color de acento',       descripcion: 'Badges y detalles decorativos',        grupo: 'Marca' },
  { key: 'color_fondo',          label: 'Fondo del admin',       descripcion: 'Color de fondo del panel',             grupo: 'Superficies' },
  { key: 'color_superficie',     label: 'Cards / Modales',       descripcion: 'Fondo de tarjetas y modales',          grupo: 'Superficies' },
  { key: 'color_superficie2',    label: 'Superficie secundaria', descripcion: 'Filas hover, fondos alternos',         grupo: 'Superficies' },
  { key: 'color_borde',          label: 'Bordes',                descripcion: 'Líneas de tabla y separadores',        grupo: 'Superficies' },
  { key: 'color_texto',          label: 'Texto principal',       descripcion: 'Texto del panel admin',                grupo: 'Tipografía' },
  { key: 'color_texto_suave',    label: 'Texto secundario',      descripcion: 'Labels, headers de tabla',             grupo: 'Tipografía' },
  { key: 'color_exito',          label: 'Color de éxito',        descripcion: 'Badges activo / confirmado',           grupo: 'Estados' },
  { key: 'color_peligro',        label: 'Color de error',        descripcion: 'Badges cancelado / error',             grupo: 'Estados' },
]

const GRUPOS = ['Marca', 'Superficies', 'Tipografía', 'Estados']

// ── Paletas ───────────────────────────────────────────────────────────────────

interface Paleta<T> { nombre: string; emoji: string; config: Partial<T> }

const PALETAS_PUBLICO: Paleta<TenantConfigUI>[] = [
  { nombre: 'Sage & Cream', emoji: '🌿', config: { color_primario:'#8A9278', color_primario_suave:'#8A927820', color_fondo:'#F5EFE8', color_superficie:'#FFFFFF', color_superficie2:'#F0EAE2', color_borde:'#E8E0D5', color_texto:'#2C2416', color_texto_suave:'#8A7E6E', color_acento:'#C8A46A', color_exito:'#4A7C59', color_peligro:'#C0392B' }},
  { nombre: 'Océano',       emoji: '🌊', config: { color_primario:'#1A6B8A', color_primario_suave:'#1A6B8A20', color_fondo:'#F0F7FA', color_superficie:'#FFFFFF', color_superficie2:'#E8F4F8', color_borde:'#C8DFE8', color_texto:'#0D2B35', color_texto_suave:'#4A7080', color_acento:'#F0A500', color_exito:'#2E8B57', color_peligro:'#DC3545' }},
  { nombre: 'Lavanda',      emoji: '💜', config: { color_primario:'#7C6FA0', color_primario_suave:'#7C6FA020', color_fondo:'#FAF8FF', color_superficie:'#FFFFFF', color_superficie2:'#F3F0FA', color_borde:'#E4DFF5', color_texto:'#2D2040', color_texto_suave:'#7B6E94', color_acento:'#E8A0BF', color_exito:'#5B9E6F', color_peligro:'#C0392B' }},
  { nombre: 'Carbón',       emoji: '✂️', config: { color_primario:'#2C3E50', color_primario_suave:'#2C3E5020', color_fondo:'#F8F6F3', color_superficie:'#FFFFFF', color_superficie2:'#F0EDE8', color_borde:'#E2DDD8', color_texto:'#1A1A1A', color_texto_suave:'#6B6B6B', color_acento:'#E67E22', color_exito:'#27AE60', color_peligro:'#E74C3C' }},
  { nombre: 'Tierra',       emoji: '🏺', config: { color_primario:'#8B4513', color_primario_suave:'#8B451320', color_fondo:'#FDF6EE', color_superficie:'#FFFFFF', color_superficie2:'#F5EBE0', color_borde:'#E8D5C0', color_texto:'#3D1F0A', color_texto_suave:'#8C6045', color_acento:'#CD853F', color_exito:'#4A7C59', color_peligro:'#B22222' }},
  { nombre: 'Noche',        emoji: '🌙', config: { color_primario:'#6C63FF', color_primario_suave:'#6C63FF20', color_fondo:'#0F0F14', color_superficie:'#1A1A24', color_superficie2:'#24243A', color_borde:'#2E2E45', color_texto:'#E8E6F0', color_texto_suave:'#8880A8', color_acento:'#FF6B9D', color_exito:'#4ECDC4', color_peligro:'#FF6B6B' }},
]

const PALETAS_ADMIN: Paleta<AdminConfigUI>[] = [
  { nombre: 'Forest',   emoji: '🌲', config: { color_primario:'#6B7A5E', color_primario_suave:'#6B7A5E20', color_fondo:'#F4F6F3', color_superficie:'#FFFFFF', color_superficie2:'#EDEEE9', color_borde:'#D8DDD2', color_texto:'#1E2419', color_texto_suave:'#6B7265', color_acento:'#C8A46A', color_exito:'#4A7C59', color_peligro:'#C0453E' }},
  { nombre: 'Slate',    emoji: '🪨', config: { color_primario:'#475569', color_primario_suave:'#47556920', color_fondo:'#F8FAFC', color_superficie:'#FFFFFF', color_superficie2:'#F1F5F9', color_borde:'#E2E8F0', color_texto:'#0F172A', color_texto_suave:'#64748B', color_acento:'#F59E0B', color_exito:'#10B981', color_peligro:'#EF4444' }},
  { nombre: 'Índigo',   emoji: '💙', config: { color_primario:'#4F46E5', color_primario_suave:'#4F46E520', color_fondo:'#F5F3FF', color_superficie:'#FFFFFF', color_superficie2:'#EDE9FE', color_borde:'#DDD6FE', color_texto:'#1E1B4B', color_texto_suave:'#6D28D9', color_acento:'#EC4899', color_exito:'#059669', color_peligro:'#DC2626' }},
  { nombre: 'Obsidian', emoji: '🖤', config: { color_primario:'#8B5CF6', color_primario_suave:'#8B5CF620', color_fondo:'#09090B', color_superficie:'#18181B', color_superficie2:'#27272A', color_borde:'#3F3F46', color_texto:'#FAFAFA', color_texto_suave:'#A1A1AA', color_acento:'#F59E0B', color_exito:'#22C55E', color_peligro:'#EF4444' }},
  { nombre: 'Teal',     emoji: '🩵', config: { color_primario:'#0D9488', color_primario_suave:'#0D948820', color_fondo:'#F0FDFA', color_superficie:'#FFFFFF', color_superficie2:'#CCFBF1', color_borde:'#99F6E4', color_texto:'#042F2E', color_texto_suave:'#0F766E', color_acento:'#F97316', color_exito:'#16A34A', color_peligro:'#DC2626' }},
  { nombre: 'Rose',     emoji: '🌹', config: { color_primario:'#BE185D', color_primario_suave:'#BE185D20', color_fondo:'#FFF1F2', color_superficie:'#FFFFFF', color_superficie2:'#FFE4E6', color_borde:'#FECDD3', color_texto:'#4C0519', color_texto_suave:'#9F1239', color_acento:'#D97706', color_exito:'#059669', color_peligro:'#DC2626' }},
]

// ── Preview público ───────────────────────────────────────────────────────────

function PreviewPublico({ cfg, nombre }: { cfg: TenantConfigUI; nombre: string }) {
  return (
    <div style={{ background: cfg.color_fondo, borderRadius: 12, border: `1px solid ${cfg.color_borde}`, overflow: 'hidden', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
      <div style={{ background: cfg.color_superficie2, borderBottom: `1px solid ${cfg.color_borde}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: cfg.color_primario, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{nombre.charAt(0)}</div>
        <span style={{ fontWeight: 600, fontSize: 12, color: cfg.color_texto }}>{nombre}</span>
        <span style={{ fontSize: 10, color: cfg.color_texto_suave, marginLeft: 'auto' }}>Reserva online</span>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color_texto_suave, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Servicios</div>
        {['Manicure clásica', 'Pedicure spa'].map(s => (
          <div key={s} style={{ background: cfg.color_superficie, border: `1px solid ${cfg.color_borde}`, borderRadius: 6, padding: '7px 10px', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: cfg.color_texto, fontSize: 12 }}>{s}</span>
            <span style={{ color: cfg.color_acento, fontSize: 11, fontWeight: 600 }}>$15.000</span>
          </div>
        ))}
        <button style={{ width: '100%', background: cfg.color_primario, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'default', marginTop: 8 }}>Reservar ahora</button>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <span style={{ background: cfg.color_exito + '20', color: cfg.color_exito, borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600 }}>✓ Confirmada</span>
          <span style={{ background: cfg.color_peligro + '20', color: cfg.color_peligro, borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600 }}>✕ Cancelada</span>
        </div>
      </div>
    </div>
  )
}

// ── Preview admin ─────────────────────────────────────────────────────────────

function PreviewAdmin({ cfg }: { cfg: AdminConfigUI }) {
  return (
    <div style={{ background: cfg.color_fondo, borderRadius: 12, border: `1px solid ${cfg.color_borde}`, overflow: 'hidden', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
      {/* Sidebar mini */}
      <div style={{ display: 'flex', height: 160 }}>
        <div style={{ width: 40, background: cfg.color_superficie, borderRight: `1px solid ${cfg.color_borde}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 6 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: cfg.color_primario, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>NX</div>
          {[cfg.color_primario, cfg.color_borde, cfg.color_borde, cfg.color_borde].map((c, i) => (
            <div key={i} style={{ width: 28, height: 28, borderRadius: 8, background: i === 0 ? cfg.color_primario + '20' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 14, height: 2, borderRadius: 1, background: i === 0 ? cfg.color_primario : cfg.color_texto_suave }}/>
            </div>
          ))}
        </div>
        {/* Main */}
        <div style={{ flex: 1, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color_texto, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Agenda</div>
          {[{n:'Camila Z.', s:'Manicure', h:'10:00'},{n:'María L.', s:'Pedicure', h:'11:30'}].map(r => (
            <div key={r.n} style={{ background: cfg.color_superficie, border: `1px solid ${cfg.color_borde}`, borderRadius: 6, padding: '5px 8px', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: cfg.color_texto }}>{r.n}</div>
                <div style={{ fontSize: 10, color: cfg.color_texto_suave }}>{r.s}</div>
              </div>
              <div style={{ fontSize: 10, color: cfg.color_primario, fontWeight: 600 }}>{r.h}</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <span style={{ background: cfg.color_primario, color: '#fff', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600 }}>+ Nueva</span>
            <span style={{ background: cfg.color_exito + '20', color: cfg.color_exito, borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600 }}>✓ Ok</span>
            <span style={{ background: cfg.color_peligro + '20', color: cfg.color_peligro, borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600 }}>✕ Err</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Editor de campos ──────────────────────────────────────────────────────────

function EditorCampos<T extends Record<string, string>>({
  campos, config, onChange, grupoActivo, setGrupoActivo
}: {
  campos: CampoColor<T>[]
  config: T
  onChange: (key: keyof T, val: string) => void
  grupoActivo: string
  setGrupoActivo: (g: string) => void
}) {
  const camposGrupo = campos.filter(c => c.grupo === grupoActivo)
  return (
    <>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {GRUPOS.map(g => (
          <button key={g} onClick={() => setGrupoActivo(g)}
            className={grupoActivo === g ? 'btn btn--primary' : 'btn btn--ghost'}
            style={{ fontSize: 12, padding: '5px 14px' }}>
            {g}
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: '4px 0' }}>
        {camposGrupo.map((campo, i) => (
          <div key={String(campo.key)} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < camposGrupo.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 2 }}>{campo.label}</div>
              <div style={{ fontSize: 11, color: 'var(--color-ink-soft)' }}>{campo.descripcion}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="text" value={config[campo.key as string] as string}
                onChange={e => onChange(campo.key, e.target.value)}
                style={{ width: 90, fontSize: 12, fontFamily: 'monospace', padding: '5px 8px', textTransform: 'uppercase' }}
                maxLength={9}
              />
              <label style={{ cursor: 'pointer', position: 'relative' }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: config[campo.key as string] as string, border: '2px solid var(--color-border)', cursor: 'pointer', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' }} />
                <input type="color" value={(config[campo.key as string] as string).slice(0, 7)}
                  onChange={e => onChange(campo.key, e.target.value)}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Page principal ────────────────────────────────────────────────────────────

type Tab = 'publico' | 'admin'

export function TemaEmpresaPage() {
  const { empresaId, empresas } = useFiltroEmpresa()
  const empresa = empresas.find(e => e.id_empresa === empresaId)
  const { configAdmin: configAdminActual } = useAdminTheme()

  const [tab,            setTab]            = useState<Tab>('publico')
  const [configPublico,  setConfigPublico]  = useState<TenantConfigUI>({ ...CONFIG_UI_DEFAULTS })
  const [configAdmin,    setConfigAdmin]    = useState<AdminConfigUI>({ ...ADMIN_CONFIG_DEFAULTS })
  const [grupoPublico,   setGrupoPublico]   = useState('Marca')
  const [grupoAdmin,     setGrupoAdmin]     = useState('Marca')
  const [guardando,      setGuardando]      = useState(false)
  const [guardado,       setGuardado]       = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  // Cargar ambas configs de la BD
  useEffect(() => {
    if (!empresaId) return
    supabase.from('empresas').select('config_ui, config_ui_admin').eq('id_empresa', empresaId).single()
      .then(({ data }) => {
        if (data?.config_ui)       setConfigPublico({ ...CONFIG_UI_DEFAULTS,  ...data.config_ui })
        if (data?.config_ui_admin) setConfigAdmin({   ...ADMIN_CONFIG_DEFAULTS, ...data.config_ui_admin })
      })
  }, [empresaId])

  // Sync admin config con el estado actual aplicado
  useEffect(() => {
    setConfigAdmin(prev => ({ ...prev, ...configAdminActual }))
  }, [configAdminActual])

  const setCampoPublico = useCallback((key: keyof TenantConfigUI, val: string) => {
    setConfigPublico(p => ({ ...p, [key]: val })); setGuardado(false)
  }, [])

  const setCampoAdmin = useCallback((key: keyof AdminConfigUI, val: string) => {
    setConfigAdmin(p => ({ ...p, [key]: val })); setGuardado(false)
  }, [])

  async function guardar() {
    if (!empresaId) return
    setGuardando(true); setError(null)
    const update: Record<string, unknown> = {}
    if (tab === 'publico') update['config_ui']       = configPublico
    if (tab === 'admin')   update['config_ui_admin'] = configAdmin
    const { error: err } = await supabase.from('empresas').update(update).eq('id_empresa', empresaId)
    if (err) setError('No se pudo guardar. ' + err.message)
    else { setGuardado(true); setTimeout(() => setGuardado(false), 3000) }
    setGuardando(false)
  }

  function resetear() {
    if (tab === 'publico') setConfigPublico({ ...CONFIG_UI_DEFAULTS })
    else                   setConfigAdmin({   ...ADMIN_CONFIG_DEFAULTS })
    setGuardado(false)
  }

  return (
    <div className="main">
      <PageHeader titulo="Tema visual">
        <button className="btn btn--ghost" onClick={resetear}>Restaurar</button>
        <button className={`btn ${guardado ? 'btn--ghost' : 'btn--primary'} btn--icon`} onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : guardado ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </PageHeader>

      {error && <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid var(--color-border)' }}>
        {([['publico','🌐 Página pública'],['admin','⚙️ Panel admin']] as [Tab,string][]).map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); setGuardado(false) }}
            style={{ padding: '10px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: tab === t ? 'var(--color-primary)' : 'var(--color-ink-soft)', borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: -2, transition: 'all .2s' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>

        {/* ── Panel izquierdo: editor ── */}
        <div>
          {/* Paletas */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-soft)', marginBottom: 12 }}>
              Paletas predefinidas {tab === 'admin' ? '— Admin' : '— Público'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(tab === 'publico' ? PALETAS_PUBLICO : PALETAS_ADMIN).map(p => (
                <button key={p.nombre}
                  onClick={() => tab === 'publico'
                    ? setConfigPublico(prev => ({ ...prev, ...p.config }))
                    : setConfigAdmin(prev => ({ ...prev, ...p.config }))
                  }
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: (p.config as any).color_fondo ?? 'var(--color-surface)', color: (p.config as any).color_texto ?? 'var(--color-ink)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
                  <span>{p.emoji}</span>
                  <span>{p.nombre}</span>
                  <span style={{ display: 'flex', gap: 2, marginLeft: 2 }}>
                    {[(p.config as any).color_primario, (p.config as any).color_acento, (p.config as any).color_fondo].map((c: string, i: number) => (
                      <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.1)' }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Campos */}
          {tab === 'publico'
            ? <EditorCampos campos={CAMPOS_PUBLICO} config={configPublico as any} onChange={setCampoPublico as any} grupoActivo={grupoPublico} setGrupoActivo={setGrupoPublico}/>
            : <EditorCampos campos={CAMPOS_ADMIN}   config={configAdmin as any}   onChange={setCampoAdmin as any}   grupoActivo={grupoAdmin}   setGrupoActivo={setGrupoAdmin}/>
          }
        </div>

        {/* ── Panel derecho: preview ── */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-soft)', marginBottom: 10 }}>
            Vista previa
          </div>
          {tab === 'publico'
            ? <PreviewPublico cfg={configPublico} nombre={empresa?.nombre_empresa ?? 'Mi Negocio'}/>
            : <PreviewAdmin   cfg={configAdmin}/>
          }
          <div className="card" style={{ padding: '12px 16px', marginTop: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--color-ink-soft)', marginBottom: 4 }}>Empresa activa</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{empresa?.nombre_empresa ?? '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--color-ink-soft)', marginTop: 4 }}>
              {tab === 'publico' ? 'Aplica al sitio público de reservas' : 'Aplica al panel de administración'}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
