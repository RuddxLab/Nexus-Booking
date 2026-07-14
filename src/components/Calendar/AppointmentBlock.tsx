import type { Agendamiento } from '../../types'
import { timeToMinutes, ALTO_HORA_PX, formatearHora } from '../../utils/calendarUtils'

function bloquePosicion(horaInicio: string, horaFin: string, horaInicioDia: number) {
  const inicioMin = timeToMinutes(horaInicio) - horaInicioDia * 60
  const finMin    = timeToMinutes(horaFin)    - horaInicioDia * 60
  const top    = (inicioMin / 60) * ALTO_HORA_PX
  const height = Math.max(((finMin - inicioMin) / 60) * ALTO_HORA_PX, 28)
  return { top, height }
}

export function AppointmentBlock({
  cita,
  horaInicioDia,
  col = 0,
  totalCols = 1,
  onClick,
}: {
  cita: Agendamiento
  horaInicioDia: number
  col?: number
  totalCols?: number
  onClick: (cita: Agendamiento) => void
}) {
  const { top, height } = bloquePosicion(cita.hora_inicio, cita.hora_fin, horaInicioDia)
  const horaIni  = formatearHora(cita.hora_inicio)
  const horaFin  = formatearHora(cita.hora_fin)
  const servicio = cita.servicios?.nombre_servicio ?? ''
  const corto    = height < 48

  // Calcular posición horizontal según columna
  const GAP    = 2
  const LEFT   = 4
  const RIGHT  = 4
  const ancho  = `calc((100% - ${LEFT + RIGHT}px - ${GAP * (totalCols - 1)}px) / ${totalCols})`
  const left   = `calc(${LEFT}px + (${ancho} + ${GAP}px) * ${col})`

  return (
    <div
      className={`appointment-block appointment-block--${cita.estado}`}
      style={{
        position: 'absolute',
        top,
        height,
        minHeight: 28,
        left,
        width: ancho,
        right: 'auto',
      }}
      onClick={(e) => { e.stopPropagation(); onClick(cita) }}
      title={`${cita.nombre_cliente}${servicio ? ` · ${servicio}` : ''} · ${horaIni}–${horaFin}`}
    >
      {!corto && (
        <span className="appointment-block__hora">{horaIni} – {horaFin}</span>
      )}
      <span className="appointment-block__nombre">{cita.nombre_cliente}</span>
      {!corto && servicio && (
        <span className="appointment-block__servicio">{servicio}</span>
      )}
    </div>
  )
}

// ── Algoritmo de columnas para citas solapadas ────────────────────────────────

export interface CitaConColumna {
  cita: Agendamiento
  col: number
  totalCols: number
}

/**
 * Recibe lista de citas y devuelve cada una con su columna asignada
 * y el total de columnas del grupo al que pertenece.
 * Algoritmo: greedy sweep-line, igual a Google Calendar.
 */
export function asignarColumnas(citas: Agendamiento[]): CitaConColumna[] {
  if (citas.length === 0) return []

  // Ordenar por inicio, luego por fin (más largas primero)
  const ordenadas = [...citas].sort((a, b) => {
    const da = timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio)
    return da !== 0 ? da : timeToMinutes(b.hora_fin) - timeToMinutes(a.hora_fin)
  })

  // Grupos de solapamiento
  const resultado: CitaConColumna[] = []
  const grupos: Agendamiento[][] = []  // cada grupo es un conjunto de citas solapadas

  for (const cita of ordenadas) {
    const ini = timeToMinutes(cita.hora_inicio)
    const fin = timeToMinutes(cita.hora_fin)

    // Buscar grupo existente donde cabe
    let asignado = false
    for (const grupo of grupos) {
      // Verificar si hay solapamiento con alguna cita del grupo
      const solapaConGrupo = grupo.some(c => {
        const cIni = timeToMinutes(c.hora_inicio)
        const cFin = timeToMinutes(c.hora_fin)
        return ini < cFin && fin > cIni
      })
      if (!solapaConGrupo) {
        grupo.push(cita)
        asignado = true
        break
      }
    }
    if (!asignado) grupos.push([cita])
  }

  // Para cada cita en cada grupo, encontrar columna libre
  // Primero calcular qué citas se solapan entre sí en grupos de solapamiento simultáneo
  const mapped = new Map<number, CitaConColumna>()

  for (const cita of ordenadas) {
    // Encontrar todas las citas que se solapan CON esta
    const solapadas = ordenadas.filter(c => {
      if (c === cita) return false
      return (
        timeToMinutes(c.hora_inicio) < timeToMinutes(cita.hora_fin) &&
        timeToMinutes(c.hora_fin)    > timeToMinutes(cita.hora_inicio)
      )
    })

    // Columnas ocupadas por citas solapadas ya asignadas
    const colsOcupadas = new Set<number>()
    for (const s of solapadas) {
      const m = mapped.get(s.id_agendamiento)
      if (m) colsOcupadas.add(m.col)
    }

    // Asignar primera columna libre
    let col = 0
    while (colsOcupadas.has(col)) col++

    mapped.set(cita.id_agendamiento, { cita, col, totalCols: 1 })
  }

  // Segunda pasada: calcular totalCols por grupo de solapamiento
  for (const cita of ordenadas) {
    const mc = mapped.get(cita.id_agendamiento)!
    const solapadas = ordenadas.filter(c => {
      if (c === cita) return false
      return (
        timeToMinutes(c.hora_inicio) < timeToMinutes(cita.hora_fin) &&
        timeToMinutes(c.hora_fin)    > timeToMinutes(cita.hora_inicio)
      )
    })
    const maxCol = Math.max(mc.col, ...solapadas.map(s => mapped.get(s.id_agendamiento)?.col ?? 0))
    mc.totalCols = maxCol + 1
  }

  // Propagar totalCols a todas las citas del mismo grupo
  for (const cita of ordenadas) {
    const mc = mapped.get(cita.id_agendamiento)!
    const solapadas = ordenadas.filter(c => {
      if (c === cita) return false
      return (
        timeToMinutes(c.hora_inicio) < timeToMinutes(cita.hora_fin) &&
        timeToMinutes(c.hora_fin)    > timeToMinutes(cita.hora_inicio)
      )
    })
    const maxTotalCols = Math.max(mc.totalCols, ...solapadas.map(s => mapped.get(s.id_agendamiento)?.totalCols ?? 1))
    mc.totalCols = maxTotalCols
    for (const s of solapadas) {
      const ms = mapped.get(s.id_agendamiento)!
      ms.totalCols = Math.max(ms.totalCols, maxTotalCols)
    }
  }

  return ordenadas.map(c => mapped.get(c.id_agendamiento)!)
}
