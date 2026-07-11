import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../services/supabaseClient'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import { PageHeader } from '../components/Common/PageHeader'
import { CONFIG_UI_DEFAULTS, type TenantConfigUI } from '../context/TenantContext'

// ── Definición de campos editables ───────────────────────────────────────────

interface CampoColor {
  key: keyof TenantConfigUI
  label: string
  descripcion: string
  grupo: string
}

const CAMPOS: CampoColor[] = [
  { key: 'color_primario',       label: 'Color primario',       descripcion: 'Botones, pasos activos, links',         grupo: 'Marca' },
  { key: 'color_primario_suave', label: 'Primario suave',       descripcion: 'Fondo de hover y focus rings',          grupo: 'Marca' },
  { key: 'color_acento',         label: 'Color de acento',      descripcion: 'Detalles decorativos y badges',         grupo: 'Marca' },
  { key: 'color_fondo',          label: 'Fondo de página',      descripcion: 'Color base de toda la página pública',  grupo: 'Superficies' },
  { key: 'color_superficie',     label: 'Tarjetas',             descripcion: 'Fondo de cards y modales',              grupo: 'Superficies' },
  { key: 'color_superficie2',    label: 'Superficie secundaria',descripcion: 'Panel lateral y fondos alternativos',   grupo: 'Superficies' },
  { key: 'color_borde',          label: 'Bordes',               descripcion: 'Líneas divisoras y contornos',          grupo: 'Superficies' },
  { key: 'color_texto',          label: 'Texto principal',      descripcion: 'Títulos y cuerpo de texto',             grupo: 'Tipografía' },
  { key: 'color_texto_suave',    label: 'Texto secundario',     descripcion: 'Labels, subtítulos, placeholders',      grupo: 'Tipografía' },
  { key: 'color_exito',          label: 'Color de éxito',       descripcion: 'Confirmaciones y estados OK',           grupo: 'Estados' },
  { key: 'color_peligro',        label: 'Color de error',       descripcion: 'Errores y cancelaciones',               grupo: 'Estados' },
]

const GRUPOS = ['Marca', 'Superficies', 'Tipografía', 'Estados']

// ── Paletas predefinidas ──────────────────────────────────────────────────────

interface Paleta {
  nombre: string
  emoji:  string
  config: Partial<TenantConfigUI>
}

const PALETAS: Paleta[] = [
  {
    nombre: 'Sage & Cream',
    emoji:  '🌿',
    config: {
      color_primario: '#8A9278', color_primario_suave: '#8A927820',
      color_fondo: '#F5EFE8', color_superficie: '#FFFFFF', color_superficie2: '#F0EAE2',
      color_borde: '#E8E0D5', color_texto: '#2C2416', color_texto_suave: '#8A7E6E',
      color_acento: '#C8A46A', color_exito: '#4A7C59', color_peligro: '#C0392B',
    },
  },
  {
    nombre: 'Carbón & Naranja',
    emoji:  '✂️',
    config: {
      color_primario: '#2C3E50', color_primario_suave: '#2C3E5020',
      color_fondo: '#F8F6F3', color_superficie: '#FFFFFF', color_superficie2: '#F0EDE8',
      color_borde: '#E2DDD8', color_texto: '#1A1A1A', color_texto_suave: '#6B6B6B',
      color_acento: '#E67E22', color_exito: '#27AE60', color_peligro: '#E74C3C',
    },
  },
  {
    nombre: 'Lavanda & Rosa',
    emoji:  '💜',
    config: {
      color_primario: '#7C6FA0', color_primario_suave: '#7C6FA020',
      color_fondo: '#FAF8FF', color_superficie: '#FFFFFF', color_superficie2: '#F3F0FA',
      color_borde: '#E4DFF5', color_texto: '#2D2040', color_texto_suave: '#7B6E94',
      color_acento: '#E8A0BF', color_exito: '#5B9E6F', color_peligro: '#C0392B',
    },
  },
  {
    nombre: 'Océano',
    emoji:  '🌊',
    config: {
      color_primario: '#1A6B8A', color_primario_suave: '#1A6B8A20',
      color_fondo: '#F0F7FA', color_superficie: '#FFFFFF', color_superficie2: '#E8F4F8',
      color_borde: '#C8DFE8', color_texto: '#0D2B35', color_texto_suave: '#4A7080',
      color_acento: '#F0A500', color_exito: '#2E8B57', color_peligro: '#DC3545',
    },
  },
  {
    nombre: 'Tierra & Cobre',
    emoji:  '🏺',
    config: {
      color_primario: '#8B4513', color_primario_suave: '#8B451320',
      color_fondo: '#FDF6EE', color_superficie: '#FFFFFF', color_superficie2: '#F5EBE0',
      color_borde: '#E8D5C0', color_texto: '#3D1F0A', color_texto_suave: '#8C6045',
      color_acento: '#CD853F', color_exito: '#4A7C59', color_peligro: '#B22222',
    },
  },
  {
    nombre: 'Noche',
    emoji:  '🌙',
    config: {
      color_primario: '#6C63FF', color_primario_suave: '#6C63FF20',
      color_fondo: '#0F0F14', color_superficie: '#1A1A24', color_superficie2: '#24243A',
      color_borde: '#2E2E45', color_texto: '#E8E6F0', color_texto_suave: '#8880A8',
      color_acento: '#FF6B9D', color_exito: '#4ECDC4', color_peligro: '#FF6B6B',
    },
  },
]

// ── Componente Preview ────────────────────────────────────────────────────────

function Preview({ cfg, nombre }: { cfg: TenantConfigUI; nombre: string }) {
  return (
    <div style={{
      background: cfg.color_fondo,
      borderRadius: 12,
      border: `1px solid ${cfg.color_borde}`,
      overflow: 'hidden',
      fontFamily: 'Inter, sans-serif',
      fontSize: 13,
    }}>
      {/* Header simulado */}
      <div style={{
        background: cfg.color_superficie2,
        borderBottom: `1px solid ${cfg.color_borde}`,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: cfg.color_primario,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: '#fff',
        }}>
          {nombre.charAt(0).toUpperCase()}
        </div>
        <span style={{ fontWeight: 600, fontSize: 12, color: cfg.color_texto }}>{nombre}</span>
      </div>

      {/* Contenido simulado */}
      <div style={{ padding: 14 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color_texto_suave, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Servicios
          </div>
          {['Manicure', 'Pedicure'].map(s => (
            <div key={s} style={{
              background: cfg.color_superficie,
              border: `1px solid ${cfg.color_borde}`,
              borderRadius: 6,
              padding: '7px 10px',
              marginBottom: 4,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ color: cfg.color_texto, fontSize: 12 }}>{s}</span>
              <span style={{ color: cfg.color_acento, fontSize: 11, fontWeight: 600 }}>$15.000</span>
            </div>
          ))}
        </div>

        {/* Botón primario */}
        <button style={{
          width: '100%',
          background: cfg.color_primario,
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 0',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'default',
          marginBottom: 6,
        }}>
          Reservar ahora
        </button>

        {/* Badge éxito y error */}
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{
            background: cfg.color_exito + '20',
            color: cfg.color_exito,
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 600,
          }}>✓ Confirmada</span>
          <span style={{
            background: cfg.color_peligro + '20',
            color: cfg.color_peligro,
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 600,
          }}>✕ Cancelada</span>
        </div>
      </div>
    </div>
  )
}

// ── Page principal ────────────────────────────────────────────────────────────

export function TemaEmpresaPage() {
  const { empresaId, empresas } = useFiltroEmpresa()
  const empresa = empresas.find(e => e.id_empresa === empresaId)

  const [config,    setConfig]    = useState<TenantConfigUI>({ ...CONFIG_UI_DEFAULTS })
  const [guardando, setGuardando] = useState(false)
  const [guardado,  setGuardado]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [grupoActivo, setGrupoActivo] = useState('Marca')

  // Cargar config actual de la empresa
  useEffect(() => {
    if (!empresaId) return
    supabase
      .from('empresas')
      .select('config_ui')
      .eq('id_empresa', empresaId)
      .single()
      .then(({ data }) => {
        if (data?.config_ui) {
          setConfig({ ...CONFIG_UI_DEFAULTS, ...data.config_ui })
        } else {
          setConfig({ ...CONFIG_UI_DEFAULTS })
        }
      })
  }, [empresaId])

  const setCampo = useCallback((key: keyof TenantConfigUI, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    setGuardado(false)
  }, [])

  const aplicarPaleta = useCallback((paleta: Paleta) => {
    setConfig(prev => ({ ...prev, ...paleta.config }))
    setGuardado(false)
  }, [])

  async function guardar() {
    if (!empresaId) return
    setGuardando(true)
    setError(null)
    const { error: err } = await supabase
      .from('empresas')
      .update({ config_ui: config })
      .eq('id_empresa', empresaId)
    if (err) setError('No se pudo guardar. ' + err.message)
    else { setGuardado(true); setTimeout(() => setGuardado(false), 3000) }
    setGuardando(false)
  }

  function resetear() {
    setConfig({ ...CONFIG_UI_DEFAULTS })
    setGuardado(false)
  }

  const camposGrupo = CAMPOS.filter(c => c.grupo === grupoActivo)

  return (
    <div>
      <PageHeader titulo="Tema visual">
        <button
          className="btn btn--ghost"
          onClick={resetear}
          title="Restaurar valores por defecto"
        >
          Restaurar
        </button>
        <button
          className={`btn ${guardado ? 'btn--ghost' : 'btn--primary'} btn--icon`}
          onClick={guardar}
          disabled={guardando}
        >
          {guardando ? 'Guardando…' : guardado ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </PageHeader>

      {error && <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>

        {/* ── Panel izquierdo: editor ── */}
        <div>
          {/* Paletas predefinidas */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-soft)', marginBottom: 12 }}>
              Paletas predefinidas
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PALETAS.map(p => (
                <button
                  key={p.nombre}
                  onClick={() => aplicarPaleta(p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: p.config.color_fondo ?? 'var(--color-surface)',
                    color: p.config.color_texto ?? 'var(--color-ink)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{p.emoji}</span>
                  <span>{p.nombre}</span>
                  {/* Mini swatches */}
                  <span style={{ display: 'flex', gap: 2, marginLeft: 2 }}>
                    {[p.config.color_primario, p.config.color_acento, p.config.color_fondo].map((c, i) => (
                      <span key={i} style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: c, border: '1px solid rgba(0,0,0,0.1)',
                      }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tabs de grupos */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {GRUPOS.map(g => (
              <button
                key={g}
                onClick={() => setGrupoActivo(g)}
                className={grupoActivo === g ? 'btn btn--primary' : 'btn btn--ghost'}
                style={{ fontSize: 12, padding: '5px 14px' }}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Campos del grupo activo */}
          <div className="card" style={{ padding: '4px 0' }}>
            {camposGrupo.map((campo, i) => (
              <div
                key={campo.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 20px',
                  borderBottom: i < camposGrupo.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 2 }}>
                    {campo.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-ink-soft)' }}>
                    {campo.descripcion}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Input de texto hex */}
                  <input
                    type="text"
                    value={config[campo.key] as string}
                    onChange={e => setCampo(campo.key, e.target.value)}
                    style={{
                      width: 90,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      padding: '5px 8px',
                      textTransform: 'uppercase',
                    }}
                    maxLength={9}
                  />
                  {/* Color picker nativo */}
                  <label style={{ cursor: 'pointer', position: 'relative' }}>
                    <div style={{
                      width: 32, height: 32,
                      borderRadius: 'var(--radius-sm)',
                      background: config[campo.key] as string,
                      border: '2px solid var(--color-border)',
                      cursor: 'pointer',
                      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                    }} />
                    <input
                      type="color"
                      value={(config[campo.key] as string).slice(0, 7)}
                      onChange={e => setCampo(campo.key, e.target.value)}
                      style={{
                        position: 'absolute',
                        opacity: 0,
                        width: 0,
                        height: 0,
                        pointerEvents: 'none',
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Panel derecho: preview ── */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-soft)', marginBottom: 10 }}>
            Vista previa
          </div>
          <Preview cfg={config} nombre={empresa?.nombre_empresa ?? 'Mi Negocio'} />

          {/* Info empresa */}
          <div className="card" style={{ padding: '12px 16px', marginTop: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--color-ink-soft)', marginBottom: 8 }}>Empresa activa</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{empresa?.nombre_empresa ?? '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--color-ink-soft)', marginTop: 2 }}>
              Los cambios aplican al sitio público de esta empresa
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
