import type { Agendamiento } from '../../types'
import { getMonthGrid, toISODate, NOMBRES_DIA } from '../../utils/calendarUtils'

/** Vista de mes: una grilla con la cantidad de citas por día. */
export function MonthView({
  anchor,
  citasPorDia,
  diaSeleccionado,
  onDiaClick
}: {
  anchor: Date
  citasPorDia: Record<string, Agendamiento[]>
  diaSeleccionado: string | null
  onDiaClick: (fecha: string) => void
}) {
  const dias = getMonthGrid(anchor)
  const mesActual = anchor.getMonth()
  const hoyISO = toISODate(new Date())

  return (
    <div className="card mes-grilla">
      {NOMBRES_DIA.map((n) => (
        <div key={n} className="mes-grilla__encabezado">{n}</div>
      ))}
      {dias.map((dia) => {
        const iso = toISODate(dia)
        const citas = (citasPorDia[iso] ?? []).filter(c => c.estado !== 'CANCELADA')
        const esDelMes = dia.getMonth() === mesActual
        const esHoy = iso === hoyISO
        return (
          <button
            key={iso}
            className={
              'mes-grilla__dia' +
              (esDelMes ? '' : ' mes-grilla__dia--fuera') +
              (esHoy ? ' mes-grilla__dia--hoy' : '') +
              (diaSeleccionado === iso ? ' mes-grilla__dia--seleccionado' : '')
            }
            onClick={() => onDiaClick(iso)}
          >
            <span>{dia.getDate()}</span>
            {citas.length > 0 && <span className="mes-grilla__contador">{citas.length}</span>}
          </button>
        )
      })}
    </div>
  )
}
