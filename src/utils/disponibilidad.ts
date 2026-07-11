// Calcula las horas de inicio reservables para un prestador en un día dado,
// a partir de su horario laboral, sus ausencias y las citas ya ocupadas.

interface Rango {
  hora_inicio: string // 'HH:MM' o 'HH:MM:SS'
  hora_fin: string
}

interface GenerarHorasDisponiblesOpts {
  horaInicio: string
  horaFin: string
  duracionMin: number
  fecha: string // 'YYYY-MM-DD', para descartar horas pasadas si la fecha es hoy
  ocupados?: Rango[]
  ausencias?: Rango[]
  bufferMin?: number // colchón entre citas
  pasoMin?: number // granularidad de los horarios mostrados (Calendly usa 15 o 30)
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function minutosAHora(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function seSuperponen(inicioA: number, finA: number, inicioB: number, finB: number): boolean {
  return inicioA < finB && finA > inicioB
}

export function generarHorasDisponibles({
  horaInicio,
  horaFin,
  duracionMin,
  fecha,
  ocupados = [],
  ausencias = [],
  bufferMin = 0,
  pasoMin = 15
}: GenerarHorasDisponiblesOpts): string[] {
  const inicioJornada = aMinutos(horaInicio)
  const finJornada = aMinutos(horaFin)
  const bloqueos = [...ocupados, ...ausencias].map((r) => ({
    inicio: aMinutos(r.hora_inicio) - bufferMin,
    fin: aMinutos(r.hora_fin) + bufferMin
  }))

  const hoy = new Date()
  const esHoy = fecha === hoy.toISOString().slice(0, 10)
  const minutoActual = esHoy ? hoy.getHours() * 60 + hoy.getMinutes() : -1

  const horas: string[] = []
  for (let inicio = inicioJornada; inicio + duracionMin <= finJornada; inicio += pasoMin) {
    const fin = inicio + duracionMin
    if (esHoy && inicio <= minutoActual) continue
    const chocaConAlgo = bloqueos.some((b) => seSuperponen(inicio, fin, b.inicio, b.fin))
    if (!chocaConAlgo) horas.push(minutosAHora(inicio))
  }
  return horas
}

/** Convierte el día de JS (0=domingo…6=sábado) al día ISO usado en prestador_horarios (1=lunes…7=domingo). */
export function diaISO(fecha: Date): number {
  const jsDay = fecha.getDay()
  return jsDay === 0 ? 7 : jsDay
}
