import type { Agendamiento } from '../../types'
import { formatearHora } from '../../utils/calendarUtils'
import { EstadoBadge } from '../Common/EstadoBadge'

/** Vista de lista (estilo Cal.com): próximas citas agrupadas por día. */
export function ListView({
  citas,
  onCitaClick
}: {
  citas: Agendamiento[]
  onCitaClick: (cita: Agendamiento) => void
}) {
  const ordenadas = [...citas]
    .filter((c) => c.estado !== 'CANCELADA')
    .sort((a, b) =>
      a.fecha === b.fecha ? a.hora_inicio.localeCompare(b.hora_inicio) : a.fecha.localeCompare(b.fecha)
    )

  const grupos: Record<string, Agendamiento[]> = {}
  for (const cita of ordenadas) {
    grupos[cita.fecha] = grupos[cita.fecha] ?? []
    grupos[cita.fecha].push(cita)
  }

  const fechas = Object.keys(grupos)

  if (fechas.length === 0) {
    return <p style={{ color: 'var(--color-ink-soft)' }}>No hay citas en este rango.</p>
  }

  return (
    <div className="card">
      {fechas.map((fecha) => (
        <div key={fecha}>
          <div className="lista-citas__fecha">
            {new Date(fecha + 'T00:00:00').toLocaleDateString('es-CL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </div>
          {grupos[fecha].map((cita) => (
            <button key={cita.id_agendamiento} className="lista-citas__item" onClick={() => onCitaClick(cita)}>
              <span className="lista-citas__hora">{formatearHora(cita.hora_inicio)}–{formatearHora(cita.hora_fin)}</span>
              <span className="lista-citas__info">
                <span className="lista-citas__nombre">{cita.nombre_cliente}</span>
                {cita.servicios && (
                  <span className="lista-citas__servicio">{cita.servicios.nombre_servicio} · {cita.servicios.duracion} min</span>
                )}
                {cita.telefono && <span className="lista-citas__telefono">{cita.telefono}</span>}
              </span>
              <EstadoBadge estado={cita.estado} />
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
