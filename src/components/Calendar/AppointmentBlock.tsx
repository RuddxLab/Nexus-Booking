import type { Agendamiento } from '../../types'
import { timeToMinutes, ALTO_HORA_PX, formatearHora } from '../../utils/calendarUtils'

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
  const horaIni  = formatearHora(cita.hora_inicio)
  const horaFin  = formatearHora(cita.hora_fin)
  const servicio = cita.servicios?.nombre_servicio ?? ''
  const corto    = height < 44  // bloque pequeño: solo nombre

  return (
    <div
      className={`appointment-block appointment-block--${cita.estado}`}
      style={{ top, height, minHeight: 22 }}
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
