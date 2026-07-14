import type { Agendamiento } from '../../types'
import { formatearHora } from '../../utils/calendarUtils'
import { EstadoBadge } from '../Common/EstadoBadge'

const DIAS_CORTO = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB']
const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']

export function ListView({
  citas,
  onCitaClick
}: {
  citas: Agendamiento[]
  onCitaClick: (cita: Agendamiento) => void
}) {
  const hoyISO = new Date().toISOString().split('T')[0]

  const ordenadas = [...citas]
    .filter(c => c.estado !== 'CANCELADA')
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
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--color-ink-soft)', fontSize: 14 }}>
        Sin citas en este rango.
      </div>
    )
  }

  return (
    <div className="lista-citas">
      {fechas.map(fecha => {
        const d    = new Date(fecha + 'T00:00:00')
        const esHoy = fecha === hoyISO
        const diaSemana = DIAS_CORTO[d.getDay()]
        const numDia    = d.getDate()
        const mes       = MESES[d.getMonth()]

        return (
          <div key={fecha} className="lista-citas__grupo">
            {/* Timeline izquierda */}
            <div className="lista-citas__timeline">
              <span className="lista-citas__fecha-label">{diaSemana}</span>
              <span className={`lista-citas__fecha-num${esHoy ? ' lista-citas__fecha-num--hoy' : ''}`}>
                {numDia}
              </span>
              <span className="lista-citas__fecha-label" style={{ marginTop: 2 }}>{mes}</span>
            </div>

            {/* Items del día */}
            <div className="lista-citas__items">
              {grupos[fecha].map(cita => (
                <button
                  key={cita.id_agendamiento}
                  className={`lista-citas__item lista-citas__item--${cita.estado}`}
                  onClick={() => onCitaClick(cita)}
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
                    {cita.telefono && (
                      <span className="lista-citas__telefono">{cita.telefono}</span>
                    )}
                  </span>
                  <EstadoBadge estado={cita.estado} />
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
