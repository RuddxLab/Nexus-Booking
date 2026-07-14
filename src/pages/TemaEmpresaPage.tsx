import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../services/supabaseClient'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import { PageHeader } from '../components/Common/PageHeader'
import { CONFIG_UI_DEFAULTS, type TenantConfigUI } from '../context/TenantContext'
import { ADMIN_CONFIG_DEFAULTS, type AdminConfigUI, useAdminTheme } from '../context/AdminThemeContext'
import { IconGuardar } from '../components/Common/icons'

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

interface Paleta<T> { nombre: string; emoji: string; seccion: string; config: Partial<T> }

const PALETA_BASE_PUBLICO = [
  { nombre: 'Cuero Clásico',       emoji: '💈', seccion: 'Barberías',         config: { color_primario:'#D4A373', color_primario_suave:'#D4A37320', color_fondo:'#FDFBF7', color_superficie:'#FFFFFF', color_superficie2:'#F5F1EA', color_borde:'#E8DED0', color_texto:'#1E1A17', color_texto_suave:'#4A5759', color_acento:'#D4A373', color_exito:'#4A7C59', color_peligro:'#C0392B' } },
  { nombre: 'Cyber Obsidiana',      emoji: '⚡', seccion: 'Barberías',         config: { color_primario:'#66FCF1', color_primario_suave:'#66FCF120', color_fondo:'#0B0C10', color_superficie:'#1F2833', color_superficie2:'#151920', color_borde:'#2E3A46', color_texto:'#FFFFFF', color_texto_suave:'#A0AEB8', color_acento:'#66FCF1', color_exito:'#45A049', color_peligro:'#EF4444' } },
  { nombre: 'Bosque Ejecutivo',     emoji: '♟️', seccion: 'Barberías',         config: { color_primario:'#D4AF37', color_primario_suave:'#D4AF3720', color_fondo:'#111E15', color_superficie:'#1A2B1E', color_superficie2:'#162019', color_borde:'#2A3D2E', color_texto:'#FAF6F0', color_texto_suave:'#8FA896', color_acento:'#D4AF37', color_exito:'#3E9B5E', color_peligro:'#E05252' } },
  { nombre: 'Rose Gold',            emoji: '🌹', seccion: 'Salones & Estética', config: { color_primario:'#C4848A', color_primario_suave:'#C4848A18', color_fondo:'#FFF8F6', color_superficie:'#FFFFFF', color_superficie2:'#FFF0EE', color_borde:'#D4A5A5', color_texto:'#2B1B17', color_texto_suave:'#8A5E62', color_acento:'#E5B3B3', color_exito:'#4A7C59', color_peligro:'#B91C1C' } },
  { nombre: 'Esmeralda Orgánico',   emoji: '🌿', seccion: 'Salones & Estética', config: { color_primario:'#0A231C', color_primario_suave:'#0A231C18', color_fondo:'#FAF8F5', color_superficie:'#FFFFFF', color_superficie2:'#F2EEE8', color_borde:'#D9C9B0', color_texto:'#0A231C', color_texto_suave:'#1E352F', color_acento:'#D9B48F', color_exito:'#2D6E4F', color_peligro:'#B91C1C' } },
  { nombre: 'Matte Onyx',           emoji: '🖤', seccion: 'Salones & Estética', config: { color_primario:'#111111', color_primario_suave:'#11111114', color_fondo:'#FCFBF9', color_superficie:'#FFFFFF', color_superficie2:'#F4F2EF', color_borde:'#D5C3BE', color_texto:'#111111', color_texto_suave:'#8E7C77', color_acento:'#D5C3BE', color_exito:'#4A7C59', color_peligro:'#C0392B' } },
  { nombre: 'Carbon',               emoji: '🪨', seccion: 'General',            config: { color_primario:'#374151', color_primario_suave:'#37415118', color_fondo:'#F9FAFB', color_superficie:'#FFFFFF', color_superficie2:'#F3F4F6', color_borde:'#E5E7EB', color_texto:'#111827', color_texto_suave:'#6B7280', color_acento:'#F59E0B', color_exito:'#10B981', color_peligro:'#EF4444' } },
]

const PALETAS_PUBLICO: Paleta<TenantConfigUI>[] = PALETA_BASE_PUBLICO as any
const PALETAS_ADMIN:   Paleta<AdminConfigUI>[]  = PALETA_BASE_PUBLICO as any

// ── Filtro por tipo ───────────────────────────────────────────────────────────

const TIPOS_EMPRESA = [
  { id: 'todos',    label: 'Todas',               emoji: '✦' },
  { id: 'barberia', label: 'Barberías',            emoji: '💈' },
  { id: 'salon',    label: 'Salones & Estética',   emoji: '✨' },
  { id: 'general',  label: 'General',              emoji: '🪨' },
]

const SECCION_POR_TIPO: Record<string, string[]> = {
  todos:    ['Barberías', 'Salones & Estética', 'General'],
  barberia: ['Barberías'],
  salon:    ['Salones & Estética'],
  general:  ['General'],
}

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
      <div style={{ display: 'flex', height: 160 }}>
        <div style={{ width: 40, background: cfg.color_superficie, borderRight: `1px solid ${cfg.color_borde}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 6 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: cfg.color_primario, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>NX</div>
          {[cfg.color_primario, cfg.color_borde, cfg.color_borde, cfg.color_borde].map((c, i) => (
            <div key={i} style={{ width: 28, height: 28, borderRadius: 8, background: i === 0 ? cfg.color_primario + '20' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 14, height: 2, borderRadius: 1, background: i === 0 ? cfg.color_primario : cfg.color_texto_suave }}/>
            </div>
          ))}
        </div>
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

// ── Paletas grid compartido ───────────────────────────────────────────────────

function PaletasGrid({ paletas, tipoEmpresa, onSelect }: {
  paletas: Paleta<any>[]
  tipoEmpresa: string
  onSelect: (p: Paleta<any>) => void
}) {
  return (
    <>
      {SECCION_POR_TIPO[tipoEmpresa].map(seccion => {
        const lista = paletas.filter(p => p.seccion === seccion)
        if (!lista.length) return null
        const iconSec = seccion === 'Barberías' ? '💈' : seccion === 'Salones & Estética' ? '✨' : '🪨'
        return (
          <div key={seccion} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-ink-soft)', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--color-border)' }}>
              {iconSec} {seccion}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(176px, 1fr))', gap: 8 }}>
              {lista.map(p => {
                const cfg = p.config as any
                const esDark = cfg.color_fondo && parseInt(cfg.color_fondo.replace('#','').slice(0,2), 16) < 80
                return (
                  <button key={p.nombre} onClick={() => onSelect(p)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: cfg.color_fondo ?? 'var(--color-surface)', cursor: 'pointer', textAlign: 'left', transition: 'box-shadow 0.15s' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                      <div style={{ width: 18, height: 10, borderRadius: 3, background: cfg.color_primario }} />
                      <div style={{ width: 18, height: 10, borderRadius: 3, background: cfg.color_acento }} />
                      <div style={{ width: 18, height: 10, borderRadius: 3, background: cfg.color_superficie ?? '#fff', border: '1px solid rgba(0,0,0,0.08)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: esDark ? (cfg.color_texto ?? '#fff') : (cfg.color_texto ?? '#111'), lineHeight: 1.3 }}>{p.emoji} {p.nombre}</div>
                      <div style={{ fontSize: 10, color: cfg.color_texto_suave ?? '#888', marginTop: 1 }}>{p.seccion}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}


// ── Page principal ────────────────────────────────────────────────────────────

type Tab = 'publico' | 'admin'

export function TemaEmpresaPage() {
  const { empresaId, setEmpresaId, empresas, esAdmin } = useFiltroEmpresa()
  const empresa = empresas.find(e => e.id_empresa === empresaId)
  const { configAdmin: configAdminActual } = useAdminTheme()

  const [tab,           setTab]           = useState<Tab>('publico')
  const [configPublico, setConfigPublico] = useState<TenantConfigUI>({ ...CONFIG_UI_DEFAULTS })
  const [configAdmin,   setConfigAdmin]   = useState<AdminConfigUI>({ ...ADMIN_CONFIG_DEFAULTS })
  const [grupoPublico,  setGrupoPublico]  = useState('Marca')
  const [grupoAdmin,    setGrupoAdmin]    = useState('Marca')
  const [tipoEmpresa,   setTipoEmpresa]   = useState('todos')
  const [guardando,     setGuardando]     = useState(false)
  const [guardado,      setGuardado]      = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  useEffect(() => {
    if (!empresaId) return
    supabase.from('empresas').select('config_ui, config_ui_admin').eq('id_empresa', empresaId).single()
      .then(({ data }) => {
        if (data?.config_ui)       setConfigPublico({ ...CONFIG_UI_DEFAULTS,  ...data.config_ui })
        if (data?.config_ui_admin) setConfigAdmin({   ...ADMIN_CONFIG_DEFAULTS, ...data.config_ui_admin })
      })
  }, [empresaId])

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
    if (tab === 'admin')   setConfigAdmin({   ...ADMIN_CONFIG_DEFAULTS })
    setGuardado(false)
  }

  return (
    <div className="main">
      <PageHeader titulo="Tema visual">
        {/* Selector de empresa (solo admin con múltiples empresas) */}
        {esAdmin && empresas.length > 1 && (
          <select
            value={empresaId ?? ''}
            onChange={e => setEmpresaId(Number(e.target.value))}
            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-ink)', minWidth: 160, cursor: 'pointer' }}
          >
            {empresas.map(e => (
              <option key={e.id_empresa} value={e.id_empresa}>{e.nombre_empresa}</option>
            ))}
          </select>
        )}
        <button className="btn btn--ghost" onClick={resetear}>Restaurar</button>
        <button className={`btn ${guardado ? 'btn--ghost' : 'btn--primary'} btn--icon`} onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : guardado ? '✓ Guardado' : <><IconGuardar /> Guardar cambios</>}
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

      {/* ── Tabs Público / Admin ── */}
      {(
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>

          {/* Panel izquierdo */}
          <div>
            {/* Paletas */}
            <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-soft)', marginBottom: 12 }}>
                Paletas — {tab === 'publico' ? 'Página pública' : 'Panel admin'}
              </div>
              {/* Filtro tipo */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {TIPOS_EMPRESA.map(t => (
                  <button key={t.id} onClick={() => setTipoEmpresa(t.id)}
                    className={tipoEmpresa === t.id ? 'btn btn--primary' : 'btn btn--ghost'}
                    style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>{t.emoji}</span> {t.label}
                  </button>
                ))}
              </div>
              <PaletasGrid
                paletas={tab === 'publico' ? PALETAS_PUBLICO : PALETAS_ADMIN}
                tipoEmpresa={tipoEmpresa}
                onSelect={p => tab === 'publico'
                  ? setConfigPublico(prev => ({ ...prev, ...p.config }))
                  : setConfigAdmin(prev => ({ ...prev, ...p.config }))
                }
              />
            </div>

            {/* Campos */}
            {tab === 'publico'
              ? <EditorCampos campos={CAMPOS_PUBLICO} config={configPublico as any} onChange={setCampoPublico as any} grupoActivo={grupoPublico} setGrupoActivo={setGrupoPublico}/>
              : <EditorCampos campos={CAMPOS_ADMIN}   config={configAdmin as any}   onChange={setCampoAdmin as any}   grupoActivo={grupoAdmin}   setGrupoActivo={setGrupoAdmin}/>
            }
          </div>

          {/* Panel derecho: preview */}
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
