import type { Agendamiento } from '../../types'
import { getMonthGrid, toISODate, NOMBRES_DIA, formatearHora } from '../../utils/calendarUtils'
import { EstadoBadge } from '../Common/EstadoBadge'

const MAX_DOTS = 3

function dotClass(estado: string) {
  if (['COMPLETADA','PAGADA'].includes(estado)) return 'mes-grilla__dot mes-grilla__dot--success'
  if (['CANCELADA','NO_ASISTIO'].includes(estado)) return 'mes-grilla__dot mes-grilla__dot--danger'
  return 'mes-grilla__dot'
}

export function MonthView({
  anchor,
  citasPorDia,
  diaSeleccionado,
  onDiaClick,
  onCitaClick,
}: {
  anchor: Date
  citasPorDia: Record<string, Agendamiento[]>
  diaSeleccionado: string | null
  onDiaClick: (fecha: string) => void
  onCitaClick?: (cita: Agendamiento) => void
}) {
  const dias       = getMonthGrid(anchor)
  const mesActual  = anchor.getMonth()
  const hoyISO     = toISODate(new Date())

  // Citas del día seleccionado para el panel de detalle
  const citasDia = diaSeleccionado
    ? (citasPorDia[diaSeleccionado] ?? []).filter(c => c.estado !== 'CANCELADA')
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
    : []

  return (
    <div>
      <div className="mes-grilla">
        {/* Encabezados */}
        {NOMBRES_DIA.map(n => (
          <div key={n} className="mes-grilla__encabezado">{n}</div>
        ))}

        {/* Días */}
        {dias.map(dia => {
          const iso      = toISODate(dia)
          const citas    = citasPorDia[iso] ?? []
          const activas  = citas.filter(c => c.estado !== 'CANCELADA')
          const esDelMes = dia.getMonth() === mesActual
          const esHoy    = iso === hoyISO
          const selec    = diaSeleccionado === iso

          // Dots: máx MAX_DOTS visibles + overflow
          const dotsVisibles = activas.slice(0, MAX_DOTS)
          const extra        = activas.length - MAX_DOTS

          return (
            <button
              key={iso}
              className={
                'mes-grilla__dia' +
                (esDelMes ? '' : ' mes-grilla__dia--fuera') +
                (selec ? ' mes-grilla__dia--seleccionado' : '')
              }
              onClick={() => onDiaClick(iso)}
            >
              <span className={`mes-grilla__num${esHoy ? ' mes-grilla__dia--hoy' : ''}`}>
                {dia.getDate()}
              </span>
              {activas.length > 0 && (
                <div className="mes-grilla__dots">
                  {dotsVisibles.map((c, i) => (
                    <span key={i} className={dotClass(c.estado)} />
                  ))}
                  {extra > 0 && (
                    <span className="mes-grilla__mas">+{extra}</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Panel de detalle del día seleccionado */}
      {diaSeleccionado && (
        <div className="mes-detalle">
          <div className="mes-detalle__header">
            {new Date(diaSeleccionado + 'T00:00:00').toLocaleDateString('es-CL', {
              weekday: 'long', day: 'numeric', month: 'long'
            })}
            {citasDia.length === 0 && (
              <span style={{ fontWeight: 400, color: 'var(--color-ink-soft)', marginLeft: 8 }}>
                — Sin citas
              </span>
            )}
          </div>
          {citasDia.map(cita => (
            <button
              key={cita.id_agendamiento}
              className={`lista-citas__item lista-citas__item--${cita.estado}`}
              onClick={() => onCitaClick?.(cita)}
              style={{ width: '100%' }}
            >
              <span className="lista-citas__hora">
                {formatearHora(cita.hora_inicio)}<br/>
                <span style={{ opacity: 0.6, fontWeight: 500, fontSize: 10.5 }}>
                  {formatearHora(cita.hora_fin)}
                </span>
              </span>
              <span className="lista-citas__info">
                <span className="lista-citas__nombre">{cita.nombre_cliente}</span>
                {cita.servicios && (
                  <span className="lista-citas__servicio">
                    {cita.servicios.nombre_servicio} · {cita.servicios.duracion} min
                  </span>
                )}
              </span>
              <EstadoBadge estado={cita.estado} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
