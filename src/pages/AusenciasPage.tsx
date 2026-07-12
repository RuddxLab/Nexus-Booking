import { useEffect, useState } from 'react'
import { PageHeader } from '../components/Common/PageHeader'
import { prestadoresService } from '../services/entityServices'
import {
  listAusencias, crearAusencia, eliminarAusencia,
  listDiasBloqueados, crearDiaBloqueado, actualizarDiaBloqueado, eliminarDiaBloqueado
} from '../services/ausenciasService'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import { SelectorFiltro } from '../components/Common/SelectorFiltro'
import type { Prestador, PrestadorAusencia, DiaBloqueado } from '../types'

const DIAS_SEMANA = [
  { valor: 'LUNES',     label: 'Lunes' },
  { valor: 'MARTES',    label: 'Martes' },
  { valor: 'MIERCOLES', label: 'Miércoles' },
  { valor: 'JUEVES',    label: 'Jueves' },
  { valor: 'VIERNES',   label: 'Viernes' },
  { valor: 'SABADO',    label: 'Sábado' },
  { valor: 'DOMINGO',   label: 'Domingo' },
]

type Tab = 'ausencias' | 'bloqueados'

export function AusenciasPage() {
  const { empresaId, sucursalId, setEmpresaId, setSucursalId, esAdmin, esSupervisor, empresas, sucursalesDeEmpresa } = useFiltroEmpresa()
  const [tab, setTab] = useState<Tab>('ausencias')
  const [prestadores, setPrestadores] = useState<Prestador[]>([])
  const [prestadorSel, setPrestadorSel] = useState<number>(0)

  // Ausencias recurrentes
  const [ausencias, setAusencias] = useState<PrestadorAusencia[]>([])
  const [nuevoAusenciaDia, setNuevoAusenciaDia] = useState('LUNES')
  const [nuevoAusenciaInicio, setNuevoAusenciaInicio] = useState('13:00')
  const [nuevoAusenciaFin, setNuevoAusenciaFin] = useState('14:00')

  // Días bloqueados
  const [diasBloqueados, setDiasBloqueados] = useState<DiaBloqueado[]>([])
  const [nbFecha, setNbFecha] = useState('')
  const [nbDesc, setNbDesc] = useState('')
  const [nbPrestador, setNbPrestador] = useState<number | ''>('')
  const [nbInicio, setNbInicio] = useState('')
  const [nbFin, setNbFin] = useState('')
  const [nbDiaCompleto, setNbDiaCompleto] = useState(true)

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!empresaId) return
    prestadoresService.listAll('nombre_prestador', empresaId, sucursalId ?? undefined)
      .then(data => {
        const activos = data.filter(p => p.activo)
        setPrestadores(activos)
        if (activos.length > 0) setPrestadorSel(activos[0].id_prestador)
      })
    cargarDiasBloqueados()
  }, [empresaId, sucursalId])

  useEffect(() => {
    if (prestadorSel) cargarAusencias()
  }, [prestadorSel])

  async function cargarAusencias() {
    if (!prestadorSel) return
    const data = await listAusencias(prestadorSel)
    setAusencias(data)
  }

  async function cargarDiasBloqueados() {
    if (!empresaId) return
    const data = await listDiasBloqueados(empresaId)
    setDiasBloqueados(data)
  }

  async function handleAgregarAusencia() {
    if (!prestadorSel) return
    setGuardando(true)
    setError(null)
    try {
      await crearAusencia({
        id_prestador: prestadorSel,
        dia: nuevoAusenciaDia,
        hora_inicio: nuevoAusenciaInicio,
        hora_fin: nuevoAusenciaFin,
      })
      await cargarAusencias()
    } catch { setError('No se pudo guardar la ausencia.') }
    finally { setGuardando(false) }
  }

  async function handleEliminarAusencia(id: number) {
    await eliminarAusencia(id)
    await cargarAusencias()
  }

  async function handleAgregarBloqueado() {
    if (!nbFecha) return setError('La fecha es obligatoria.')
    if (!empresaId) return setError('No se encontró la empresa.')
    setGuardando(true)
    setError(null)
    try {
      await crearDiaBloqueado(
        {
          fecha: nbFecha,
          descripcion: nbDesc || null,
          id_prestador: nbPrestador !== '' ? Number(nbPrestador) : null,
          hora_inicio: nbDiaCompleto ? null : (nbInicio || null),
          hora_fin:    nbDiaCompleto ? null : (nbFin    || null),
        },
        empresaId,
        sucursalId ?? 1,
      )
      setNbFecha(''); setNbDesc(''); setNbPrestador(''); setNbInicio(''); setNbFin(''); setNbDiaCompleto(true)
      await cargarDiasBloqueados()
    } catch { setError('No se pudo guardar el día bloqueado.') }
    finally { setGuardando(false) }
  }

  async function handleEliminarBloqueado(id: number) {
    await eliminarDiaBloqueado(id)
    await cargarDiasBloqueados()
  }

  const prestadorNombre = (id: number | null) =>
    id ? prestadores.find(p => p.id_prestador === id)?.nombre_prestador ?? `#${id}` : 'Todos'

  return (
    <div className="main">
      <PageHeader titulo="Ausencias y días bloqueados" />
      <SelectorFiltro
        esAdmin={esAdmin}
        esSupervisor={esSupervisor}
        empresas={empresas}
        sucursalesDeEmpresa={sucursalesDeEmpresa}
        empresaId={empresaId}
        sucursalId={sucursalId}
        onEmpresaChange={setEmpresaId}
        onSucursalChange={setSucursalId}
      />

      {/* Tabs */}
      <div className="vista-switch" style={{ marginBottom: 24 }}>
        <button className={tab === 'ausencias' ? 'activo' : ''} onClick={() => setTab('ausencias')}>
          Ausencias recurrentes
        </button>
        <button className={tab === 'bloqueados' ? 'activo' : ''} onClick={() => setTab('bloqueados')}>
          Días bloqueados
        </button>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

      {/* ── Tab: Ausencias recurrentes ─────────────────────────────── */}
      {tab === 'ausencias' && (
        <div>
          {/* Selector de prestador */}
          <div className="field" style={{ maxWidth: 320, marginBottom: 24 }}>
            <label>Prestador</label>
            <select value={prestadorSel} onChange={e => setPrestadorSel(Number(e.target.value))}>
              {prestadores.map(p => (
                <option key={p.id_prestador} value={p.id_prestador}>{p.nombre_prestador}</option>
              ))}
            </select>
          </div>

          {/* Formulario nueva ausencia */}
          <div className="card" style={{ padding: 20, marginBottom: 24 }}>
            <p style={{ fontWeight: 700, marginBottom: 16, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-ink-soft)' }}>
              Nueva ausencia recurrente
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Día</label>
                <select value={nuevoAusenciaDia} onChange={e => setNuevoAusenciaDia(e.target.value)}>
                  {DIAS_SEMANA.map(d => <option key={d.valor} value={d.valor}>{d.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Desde</label>
                <input type="time" value={nuevoAusenciaInicio} onChange={e => setNuevoAusenciaInicio(e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Hasta</label>
                <input type="time" value={nuevoAusenciaFin} onChange={e => setNuevoAusenciaFin(e.target.value)} />
              </div>
              <button className="btn btn--primary" onClick={handleAgregarAusencia} disabled={guardando}>
                + Agregar
              </button>
            </div>
          </div>

          {/* Lista de ausencias */}
          <div className="card">
            {ausencias.length === 0 ? (
              <p style={{ padding: 20, color: 'var(--color-ink-soft)' }}>No hay ausencias recurrentes para este prestador.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ausencias.map(a => (
                    <tr key={a.id_prestador_ausencia}>
                      <td>{DIAS_SEMANA.find(d => d.valor === a.dia)?.label ?? a.dia}</td>
                      <td>{a.hora_inicio?.slice(0, 5)}</td>
                      <td>{a.hora_fin?.slice(0, 5)}</td>
                      <td>
                        <button
                          className="btn btn--danger"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                          onClick={() => handleEliminarAusencia(a.id_prestador_ausencia)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Días bloqueados ───────────────────────────────────── */}
      {tab === 'bloqueados' && (
        <div>
          {/* Formulario nuevo día bloqueado */}
          <div className="card" style={{ padding: 20, marginBottom: 24 }}>
            <p style={{ fontWeight: 700, marginBottom: 16, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-ink-soft)' }}>
              Nuevo día bloqueado
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Fecha</label>
                <input type="date" value={nbFecha} onChange={e => setNbFecha(e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0, minWidth: 200 }}>
                <label>Descripción</label>
                <input
                  placeholder="Ej: Feriado, Vacaciones…"
                  value={nbDesc}
                  onChange={e => setNbDesc(e.target.value)}
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Prestador</label>
                <select value={nbPrestador} onChange={e => setNbPrestador(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">Todos</option>
                  {prestadores.map(p => (
                    <option key={p.id_prestador} value={p.id_prestador}>{p.nombre_prestador}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Horario</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400, fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>
                  <input type="checkbox" checked={nbDiaCompleto} onChange={e => setNbDiaCompleto(e.target.checked)} />
                  Día completo
                </label>
              </div>
              {!nbDiaCompleto && (
                <>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Desde</label>
                    <input type="time" value={nbInicio} onChange={e => setNbInicio(e.target.value)} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Hasta</label>
                    <input type="time" value={nbFin} onChange={e => setNbFin(e.target.value)} />
                  </div>
                </>
              )}
              <button className="btn btn--primary" onClick={handleAgregarBloqueado} disabled={guardando}>
                + Agregar
              </button>
            </div>
          </div>

          {/* Lista de días bloqueados */}
          <div className="card">
            {diasBloqueados.length === 0 ? (
              <p style={{ padding: 20, color: 'var(--color-ink-soft)' }}>No hay días bloqueados registrados.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Prestador</th>
                    <th>Horario</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {diasBloqueados.map(d => (
                    <tr key={d.id_dia_bloqueado}>
                      <td>{new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                      <td>{d.descripcion ?? '—'}</td>
                      <td>{prestadorNombre(d.id_prestador)}</td>
                      <td>
                        {d.hora_inicio && d.hora_fin
                          ? `${d.hora_inicio.slice(0,5)} – ${d.hora_fin.slice(0,5)}`
                          : 'Día completo'}
                      </td>
                      <td>
                        <button
                          className="btn btn--danger"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                          onClick={() => handleEliminarBloqueado(d.id_dia_bloqueado)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
