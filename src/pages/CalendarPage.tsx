import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { WeekView } from '../components/Calendar/WeekView'
import { ListView } from '../components/Calendar/ListView'
import { MonthView } from '../components/Calendar/MonthView'
import { AppointmentModal } from '../components/Calendar/AppointmentModal'
import { listAgendamientosPorRango } from '../services/agendamientosService'
import { listHorariosPorPrestadores } from '../services/disponibilidadService'
import { listDiasBloqueadosPorRango, listAusenciasPorPrestadores } from '../services/ausenciasService'
import type { DiaBloqueado, PrestadorAusencia } from '../types'
import { listPrestadoresPublico, serviciosService } from '../services/entityServices'
import { getWeekDays, getMonthGrid, toISODate } from '../utils/calendarUtils'
import { useUserRole } from '../hooks/useUserRole'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import { PageHeader } from '../components/Common/PageHeader'
import type { Agendamiento, PrestadorPublico, Servicio } from '../types'

type Vista = 'semana' | 'lista' | 'mes'

export function CalendarPage() {
  const { idEmpresa, idSucursal, idPrestador, rol, loading: cargandoRol } = useUserRole()
  const { empresaId, sucursalId, setEmpresaId, setSucursalId, esAdmin, esSupervisor, empresas, sucursalesDeEmpresa } = useFiltroEmpresa()
  const esPrestador = rol === 'prestador'

  const [vista, setVista] = useState<Vista>('semana')
  const [anchor, setAnchor] = useState(new Date())
  const [diaSeleccionadoMes, setDiaSeleccionadoMes] = useState<string | null>(null)
  const [citas, setCitas] = useState<Agendamiento[]>([])
  const [prestadores, setPrestadores] = useState<PrestadorPublico[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [slotSeleccionado, setSlotSeleccionado] = useState<{ fecha: string; hora: string } | null>(null)
  const [citaSeleccionada, setCitaSeleccionada] = useState<Agendamiento | null>(null)
  const [cargando, setCargando] = useState(true)
  const [idPrestadorFiltro, setIdPrestadorFiltro] = useState<number | null>(null)
  const resetandoPrestador = useRef(false)  // true mientras se resetea por cambio de sucursal
  const [diasBloqueados, setDiasBloqueados] = useState<DiaBloqueado[]>([])
  const [ausenciasRecurrentes, setAusenciasRecurrentes] = useState<PrestadorAusencia[]>([])
  const [horariosActivos, setHorariosActivos] = useState<import('../types').PrestadorHorario[]>([])

  const dias = useMemo(() => getWeekDays(anchor), [anchor])
  const mesGrilla = useMemo(() => getMonthGrid(anchor), [anchor])

  // Semana: solo esos 7 días. Lista/Mes: toda la grilla del mes (42 días, incluye días de relleno).
  const rango = useMemo(() => {
    if (vista === 'semana') return { desde: toISODate(dias[0]), hasta: toISODate(dias[6]) }
    return { desde: toISODate(mesGrilla[0]), hasta: toISODate(mesGrilla[41]) }
  }, [vista, dias, mesGrilla])

  const cargarCitas = useCallback(async (overrideFiltroId?: number | null) => {
    if (!empresaId) return
    if (resetandoPrestador.current) return
    setCargando(true)
    try {
      // Usar el override si se pasa explícitamente (al resetear sucursal)
      const filtroId = overrideFiltroId !== undefined
        ? overrideFiltroId
        : (esPrestador ? idPrestador : idPrestadorFiltro)

      const [citas, bloqueados] = await Promise.all([
        listAgendamientosPorRango(rango.desde, rango.hasta, null, empresaId, sucursalId),
        listDiasBloqueadosPorRango(rango.desde, rango.hasta, filtroId, empresaId, sucursalId),
      ])
      // Filtrar por prestador en frontend (citas ya vienen filtradas por sucursal)
      const citasFiltradas = filtroId
        ? citas.filter(c => c.id_prestador === filtroId)
        : citas
      setCitas(citasFiltradas)
      setDiasBloqueados(bloqueados)

      // Cargar horarios y ausencias filtrando por sucursal cuando corresponde
      const todosIds = esPrestador && idPrestador
        ? [idPrestador]
        : await listPrestadoresPublico(empresaId)
            .then(ps => sucursalId
              ? ps.filter(p => p.id_sucursal === sucursalId).map(p => p.id_prestador)
              : ps.map(p => p.id_prestador)
            )
            .catch(() => [])

      if (todosIds.length > 0) {
        const [aus, horarios] = await Promise.all([
          listAusenciasPorPrestadores(todosIds),
          listHorariosPorPrestadores(todosIds),
        ])
        setAusenciasRecurrentes(aus)
        setHorariosActivos(horarios)
      } else {
        setAusenciasRecurrentes([])
        setHorariosActivos([])
      }
    } finally {
      setCargando(false)
    }
  }, [rango.desde, rango.hasta, idPrestador, idPrestadorFiltro, esPrestador, empresaId, sucursalId])

  useEffect(() => {
    if (!empresaId) return
    cargarCitas()
  }, [cargarCitas, empresaId, sucursalId])

  // Nota: idPrestadorFiltro ya está en las deps de cargarCitas vía useCallback
  // No se necesita un useEffect separado para él

  useEffect(() => {
    if (!empresaId) return
    resetandoPrestador.current = true
    setIdPrestadorFiltro(null)
    listPrestadoresPublico(empresaId)
      .then(data => {
        const filtrados = sucursalId
          ? data.filter(p => p.id_sucursal === sucursalId)
          : data
        setPrestadores(filtrados)
        resetandoPrestador.current = false
        if (!esPrestador && filtrados.length > 0) {
          const primero = filtrados[0].id_prestador
          setIdPrestadorFiltro(primero)
          // Pasar el id directamente para evitar race condition con el estado
          cargarCitas(primero)
        } else {
          cargarCitas(null)
        }
      })
      .catch(() => { setPrestadores([]); resetandoPrestador.current = false })
    serviciosService.listAll('nombre_servicio', empresaId, sucursalId ?? undefined)
      .then(setServicios).catch(() => setServicios([]))
    serviciosService.listAll('nombre_servicio', empresaId, sucursalId ?? undefined)
      .then(setServicios).catch(() => setServicios([]))
  }, [empresaId, sucursalId]) // eslint-disable-line react-hooks/exhaustive-deps

  const citasPorDia = useMemo(() => {
    const grupos: Record<string, Agendamiento[]> = {}
    for (const cita of citas) {
      grupos[cita.fecha] = grupos[cita.fecha] ?? []
      grupos[cita.fecha].push(cita)
    }
    return grupos
  }, [citas])

  // Lista: todas las citas del rango cargado (incluye pasadas), sin CANCELADAS.
  // Permite ver el historial de la semana/mes completo.
  const citasLista = useMemo(() => {
    return [...citas]
      .filter((c) => c.estado !== 'CANCELADA')
      .sort((a, b) =>
        a.fecha === b.fecha
          ? a.hora_inicio.localeCompare(b.hora_inicio)
          : a.fecha.localeCompare(b.fecha)
      )
  }, [citas])

  function moverSemana(delta: number) {
    const nueva = new Date(anchor)
    nueva.setDate(nueva.getDate() + delta * 7)
    setAnchor(nueva)
  }

  function moverMes(delta: number) {
    const nueva = new Date(anchor)
    nueva.setMonth(nueva.getMonth() + delta)
    setAnchor(nueva)
    setDiaSeleccionadoMes(null)
  }

  if (cargandoRol) {
    return <p style={{ color: 'var(--color-ink-soft)' }}>Cargando tu perfil…</p>
  }

  if (!idEmpresa) {
    return (
      <p style={{ color: 'var(--color-danger)' }}>
        Tu usuario no tiene un rol asignado todavía. Pide que te lo asignen para poder ver el calendario.
      </p>
    )
  }

  return (
    <div className="main">
      <PageHeader titulo={esPrestador ? 'Mi agenda' : 'Agenda'}>
        <div className="vista-switch">
          <button className={vista === 'semana' ? 'activo' : ''} onClick={() => setVista('semana')}>Semana</button>
          <button className={vista === 'lista' ? 'activo' : ''} onClick={() => setVista('lista')}>Lista</button>
          <button className={vista === 'mes' ? 'activo' : ''} onClick={() => setVista('mes')}>Mes</button>
        </div>
      </PageHeader>

      {/* Selector empresa + sucursal compacto (Lista y Mes lo usan; Semana tiene el suyo inline) */}
      {!esPrestador && vista !== 'semana' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          {(esAdmin || esSupervisor) && empresas.length > 0 && (
            <>
              <span style={{ fontSize: 11, color: 'var(--color-ink-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empresa:</span>
              <select
                value={empresaId ?? ''}
                onChange={e => setEmpresaId(Number(e.target.value))}
                style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-ink)', fontSize: 12 }}
              >
                {empresas.map(e => <option key={e.id_empresa} value={e.id_empresa}>{e.nombre_empresa}</option>)}
              </select>
            </>
          )}
          {sucursalesDeEmpresa.length > 1 && (
            <>
              <span style={{ fontSize: 11, color: 'var(--color-ink-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sucursal:</span>
              <select
                value={sucursalId ?? ''}
                onChange={e => setSucursalId(Number(e.target.value))}
                style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-ink)', fontSize: 12 }}
              >
                {sucursalesDeEmpresa.map(s => <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre_sucursal}</option>)}
              </select>
            </>
          )}
        </div>
      )}

      {esPrestador && (
        <p style={{ color: 'var(--color-ink-soft)', fontSize: 13, marginBottom: 14 }}>
          Esta es tu agenda personal — solo puedes ver y cancelar tus propias citas.
        </p>
      )}

      {vista === 'semana' && (
        <>
          {/* Fila de filtros: empresa/sucursal + prestador */}
          {!esPrestador && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              {(esAdmin || esSupervisor) && empresas.length > 0 && (
                <>
                  <span style={{ fontSize: 11, color: 'var(--color-ink-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empresa:</span>
                  <select
                    value={empresaId ?? ''}
                    onChange={e => setEmpresaId(Number(e.target.value))}
                    style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-ink)', fontSize: 12 }}
                  >
                    {empresas.map(e => <option key={e.id_empresa} value={e.id_empresa}>{e.nombre_empresa}</option>)}
                  </select>
                </>
              )}
              {sucursalesDeEmpresa.length > 1 && (
                <>
                  <span style={{ fontSize: 11, color: 'var(--color-ink-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sucursal:</span>
                  <select
                    value={sucursalId ?? ''}
                    onChange={e => setSucursalId(Number(e.target.value))}
                    style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-ink)', fontSize: 12 }}
                  >
                    {sucursalesDeEmpresa.map(s => <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre_sucursal}</option>)}
                  </select>
                </>
              )}
              {prestadores.length > 0 && (
                <>
                  <span style={{ fontSize: 11, color: 'var(--color-ink-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ver agenda de:</span>
                  <select
                    style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-ink)', fontSize: 12 }}
                    value={idPrestadorFiltro ?? ''}
                    onChange={e => setIdPrestadorFiltro(Number(e.target.value))}
                  >
                    {prestadores.map(p => (
                      <option key={p.id_prestador} value={p.id_prestador}>{p.nombre_prestador}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}

          {/* Botones nav — pegados al calendario, derecha */}
          <div style={{ display: 'flex', justifyContent: esPrestador ? 'flex-start' : 'flex-end', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="btn btn--ghost cal-nav-btn" onClick={() => moverSemana(-1)} title="Semana anterior">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <button className="btn btn--ghost cal-nav-hoy" onClick={() => setAnchor(new Date())}>Hoy</button>
              <button className="btn btn--ghost cal-nav-btn" onClick={() => moverSemana(1)} title="Semana siguiente">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
          {cargando ? (
            <p style={{ color: 'var(--color-ink-soft)' }}>Cargando agenda…</p>
          ) : (
            <div className="calendar-scroll">
              <WeekView
                dias={dias}
                citasPorDia={citasPorDia}
                diasBloqueados={diasBloqueados}
                ausenciasRecurrentes={ausenciasRecurrentes}
                horariosActivos={horariosActivos}
                idPrestadorActual={esPrestador ? idPrestador : idPrestadorFiltro}
                onSlotClick={(fecha, hora) => {
                  if (esPrestador) return
                  setSlotSeleccionado({ fecha, hora })
                }}
                onCitaClick={(cita) => setCitaSeleccionada(cita)}
              />
            </div>
          )}
        </>
      )}

      {vista === 'lista' && (
        cargando ? (
          <p style={{ color: 'var(--color-ink-soft)' }}>Cargando agenda…</p>
        ) : (
          <ListView citas={citasLista} onCitaClick={(cita) => setCitaSeleccionada(cita)} />
        )
      )}

      {vista === 'mes' && (
        <>
          <div className="calendar__nav">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="btn btn--ghost cal-nav-btn" onClick={() => moverMes(-1)} title="Mes anterior">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <button className="btn btn--ghost cal-nav-hoy" onClick={() => { setAnchor(new Date()); setDiaSeleccionadoMes(null) }}>Hoy</button>
              <button className="btn btn--ghost cal-nav-btn" onClick={() => moverMes(1)} title="Mes siguiente">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
            <span className="calendar__nav-label" style={{ textTransform: 'capitalize' }}>
              {anchor.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          {cargando ? (
            <p style={{ color: 'var(--color-ink-soft)' }}>Cargando agenda…</p>
          ) : (
            <MonthView
              anchor={anchor}
              citasPorDia={citasPorDia}
              diaSeleccionado={diaSeleccionadoMes}
              onDiaClick={setDiaSeleccionadoMes}
              onCitaClick={(cita) => setCitaSeleccionada(cita)}
            />
          )}
        </>
      )}

      {(slotSeleccionado || citaSeleccionada) && (
        <AppointmentModal
          fecha={citaSeleccionada?.fecha ?? slotSeleccionado!.fecha}
          horaInicial={citaSeleccionada?.hora_inicio ?? slotSeleccionado!.hora}
          citaExistente={citaSeleccionada}
          prestadores={prestadores}
          servicios={servicios}
          idEmpresa={empresaId ?? idEmpresa ?? 0}
          idSucursal={sucursalId ?? idSucursal ?? 1}
          onClose={() => {
            setSlotSeleccionado(null)
            setCitaSeleccionada(null)
          }}
          onSaved={() => {
            setSlotSeleccionado(null)
            setCitaSeleccionada(null)
            cargarCitas()
          }}
        />
      )}
    </div>
  )
}
