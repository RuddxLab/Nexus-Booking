import type { Agendamiento } from '../../types'
import { timeToMinutes, ALTO_HORA_PX, formatearHora } from '../../utils/calendarUtils'

/**
 * Calcula posición vertical y alto del bloque relativo a horaInicioDia.
 * horaInicioDia se pasa dinámicamente desde WeekView para soportar
 * citas antes de las 08:00.
 */
function bloquePosicion(horaInicio: string, horaFin: string, horaInicioDia: number) {
  const inicioMin = timeToMinutes(horaInicio) - horaInicioDia * 60
  const finMin    = timeToMinutes(horaFin)    - horaInicioDia * 60
  const top    = (inicioMin / 60) * ALTO_HORA_PX
  const height = Math.max(((finMin - inicioMin) / 60) * ALTO_HORA_PX, 24)
  return { top, height }
}

export function AppointmentBlock({
  cita,
  horaInicioDia,
  onClick
}: {
  cita: Agendamiento
  horaInicioDia: number
  onClick: (cita: Agendamiento) => void
}) {
  const { top, height } = bloquePosicion(cita.hora_inicio, cita.hora_fin, horaInicioDia)
  const horaInicio = formatearHora(cita.hora_inicio)
  const horaFin    = formatearHora(cita.hora_fin)
  const servicio   = cita.servicios?.nombre_servicio ?? ''

  return (
    <div
      className={`appointment-block appointment-block--${cita.estado}`}
      style={{ top, height, minHeight: 22 }}
      onClick={(e) => { e.stopPropagation(); onClick(cita) }}
      title={`${cita.nombre_cliente} · ${servicio} · ${horaInicio}–${horaFin}`}
    >
      <span className="appointment-block__hora">{horaInicio}–{horaFin}</span>
      <span className="appointment-block__nombre">
        {cita.nombre_cliente}{servicio ? ` · ${servicio}` : ''}
      </span>
    </div>
  )
}
