export const HORA_INICIO_DIA = 8  // default visible si no hay citas fuera de rango
export const HORA_FIN_DIA   = 20
export const ALTO_HORA_PX   = 60

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Convierte "09:00:00" o "09:00" a "09:00" — Postgres devuelve horas con segundos. */
export function formatearHora(hora: string): string {
  return hora.slice(0, 5)
}

/**
 * Convierte un Date a "YYYY-MM-DD" usando hora LOCAL (no UTC).
 * En UTC-3, toISOString() corta un día antes a medianoche.
 */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diasHaciaAtras = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diasHaciaAtras)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function getMonthGrid(anchor: Date): Date[] {
  const inicioMes    = startOfMonth(anchor)
  const inicioGrilla = startOfWeek(inicioMes)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicioGrilla)
    d.setDate(inicioGrilla.getDate() + i)
    return d
  })
}

export const NOMBRES_DIA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
