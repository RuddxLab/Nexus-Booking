import { useEffect, useState } from 'react'
import { PageHeader } from '../components/Common/PageHeader'
import { prestadoresService } from '../services/entityServices'
import { listHorariosPrestador, guardarDiaHorario, DiaHorarioForm } from '../services/horariosAdminService'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import { SelectorFiltro } from '../components/Common/SelectorFiltro'
import type { Prestador } from '../types'

const DIAS = [
  { dia: 1, nombre: 'Lunes' },
  { dia: 2, nombre: 'Martes' },
  { dia: 3, nombre: 'Miércoles' },
  { dia: 4, nombre: 'Jueves' },
  { dia: 5, nombre: 'Viernes' },
  { dia: 6, nombre: 'Sábado' },
  { dia: 7, nombre: 'Domingo' }
]

export function HorariosPage() {
  const { empresaId, sucursalId, setEmpresaId, setSucursalId, esAdmin, esSupervisor, empresas, sucursalesDeEmpresa } = useFiltroEmpresa()
  const [prestadores, setPrestadores] = useState<Prestador[]>([])
  const [idPrestador, setIdPrestador] = useState<number | null>(null)
  const [filas, setFilas] = useState<DiaHorarioForm[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    if (!empresaId) return
    setIdPrestador(null)
    prestadoresService.listAll('nombre_prestador', empresaId, sucursalId ?? undefined).then(lista => {
      setPrestadores(lista)
      if (lista.length > 0) setIdPrestador(lista[0].id_prestador)
    })
  }, [empresaId, sucursalId])

  useEffect(() => {
    if (!idPrestador) return
    setCargando(true)
    setMensaje(null)
    listHorariosPrestador(idPrestador)
      .then((horarios) => {
        const filasCompletas = DIAS.map(({ dia }) => {
          const existente = horarios.find((h) => h.dia === dia)
          return {
            id_prestador_horario: existente?.id_prestador_horario,
            dia,
            activo: existente?.activo ?? false,
            hora_inicio: existente?.hora_inicio?.slice(0, 5) ?? '09:00',
            hora_fin: existente?.hora_fin?.slice(0, 5) ?? '18:00'
          }
        })
        setFilas(filasCompletas)
      })
      .finally(() => setCargando(false))
  }, [idPrestador])

  function actualizarFila(dia: number, cambios: Partial<DiaHorarioForm>) {
    setFilas((prev) => prev.map((f) => (f.dia === dia ? { ...f, ...cambios } : f)))
  }

  async function guardarTodo() {
    const prestador = prestadores.find((p) => p.id_prestador === idPrestador)
    if (!prestador) return
    setGuardando(true)
    setMensaje(null)
    try {
      for (const fila of filas) {
        await guardarDiaHorario(fila, {
          idPrestador: prestador.id_prestador,
          idEmpresa: prestador.id_empresa,
          idSucursal: prestador.id_sucursal
        })
      }
      setMensaje('Horario guardado.')
      const horarios = await listHorariosPrestador(prestador.id_prestador)
      setFilas(
        DIAS.map(({ dia }) => {
          const existente = horarios.find((h) => h.dia === dia)
          return {
            id_prestador_horario: existente?.id_prestador_horario,
            dia,
            activo: existente?.activo ?? false,
            hora_inicio: existente?.hora_inicio?.slice(0, 5) ?? '09:00',
            hora_fin: existente?.hora_fin?.slice(0, 5) ?? '18:00'
          }
        })
      )
    } catch {
      setMensaje('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="main">
      <PageHeader titulo="Horarios" />
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

      <div className="field" style={{ maxWidth: 320, marginBottom: 20 }}>
        <label>Prestador</label>
        <select value={idPrestador ?? ''} onChange={(e) => setIdPrestador(Number(e.target.value))}>
          {prestadores.map((p) => (
            <option key={p.id_prestador} value={p.id_prestador}>{p.nombre_prestador}</option>
          ))}
        </select>
      </div>

      {cargando ? (
        <p style={{ color: 'var(--color-ink-soft)' }}>Cargando…</p>
      ) : (
        <div className="card" style={{ padding: 8 }}>
          {DIAS.map(({ dia, nombre }) => {
            const fila = filas.find((f) => f.dia === dia)
            if (!fila) return null
            return (
              <div key={dia} className="horario-fila">
                <label className="horario-fila__checkbox">
                  <input
                    type="checkbox"
                    checked={fila.activo}
                    onChange={(e) => actualizarFila(dia, { activo: e.target.checked })}
                  />
                  {nombre}
                </label>
                <input
                  type="time"
                  value={fila.hora_inicio}
                  disabled={!fila.activo}
                  onChange={(e) => actualizarFila(dia, { hora_inicio: e.target.value })}
                />
                <span style={{ color: 'var(--color-ink-soft)' }}>a</span>
                <input
                  type="time"
                  value={fila.hora_fin}
                  disabled={!fila.activo}
                  onChange={(e) => actualizarFila(dia, { hora_fin: e.target.value })}
                />
              </div>
            )
          })}
        </div>
      )}

      {mensaje && <p style={{ color: 'var(--color-success)', marginTop: 12 }}>{mensaje}</p>}

      <button className="btn btn--primary" style={{ marginTop: 16 }} disabled={guardando || cargando} onClick={guardarTodo}>
        {guardando ? 'Guardando…' : 'Guardar horario'}
      </button>
    </div>
  )
}
