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
  bufferMin?: number  // colchón entre citas
  pasoMin?: number    // granularidad de PRESENTACIÓN (cada cuántos min mostrar slots)
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

/**
 * Calcula el paso de presentación óptimo según la duración del servicio.
 * - Duraciones cortas (≤30 min): paso de 15 min
 * - Duraciones medias (31-60 min): paso de 30 min  
 * - Duraciones largas (>60 min): paso de 30 min
 * Siempre múltiplo de 5 para coincidir con la búsqueda interna.
 */
function calcularPasoPresntacion(duracionMin: number): number {
  if (duracionMin <= 30) return 15
  return 30
}

export function generarHorasDisponibles({
  horaInicio,
  horaFin,
  duracionMin,
  fecha,
  ocupados = [],
  ausencias = [],
  bufferMin = 0,
  pasoMin,
}: GenerarHorasDisponiblesOpts): string[] {
  const inicioJornada = aMinutos(horaInicio)
  const finJornada    = aMinutos(horaFin)

  const bloqueos = [...ocupados, ...ausencias].map((r) => ({
    inicio: aMinutos(r.hora_inicio) - bufferMin,
    fin:    aMinutos(r.hora_fin)    + bufferMin,
  }))

  const hoy = new Date()
  const esHoy = fecha === hoy.toISOString().slice(0, 10)
  const minutoActual = esHoy ? hoy.getHours() * 60 + hoy.getMinutes() : -1

  // Paso de presentación: cuántos minutos entre slots visibles
  const pasoDisplay = pasoMin ?? calcularPasoPresntacion(duracionMin)

  // Paso interno de búsqueda: siempre 5 min para no perder huecos
  // independientemente de la duración del servicio
  const PASO_BUSQUEDA = 5

  // 1. Encontrar todos los slots válidos (cada 5 min)
  const slotsValidos = new Set<number>()
  for (let inicio = inicioJornada; inicio + duracionMin <= finJornada; inicio += PASO_BUSQUEDA) {
    const fin = inicio + duracionMin
    if (esHoy && inicio <= minutoActual) continue
    const choca = bloqueos.some((b) => seSuperponen(inicio, fin, b.inicio, b.fin))
    if (!choca) slotsValidos.add(inicio)
  }

  // 2. Filtrar para mostrar solo slots en el paso de presentación,
  //    EXCEPTO cuando un slot de presentación no está disponible pero
  //    hay uno cercano válido (hueco post-ausencia)
  const horas: string[] = []

  for (let inicio = inicioJornada; inicio + duracionMin <= finJornada; inicio += pasoDisplay) {
    if (slotsValidos.has(inicio)) {
      // El slot "redondo" está disponible — mostrarlo
      horas.push(minutosAHora(inicio))
    } else {
      // Buscar el primer slot válido dentro de los próximos pasoDisplay minutos
      // Esto captura huecos post-ausencia (ej: ausencia termina 15:00, jornada
      // empezaba a mostrar 15:30, pero 15:00 es válido)
      for (let offset = 0; offset < pasoDisplay; offset += PASO_BUSQUEDA) {
        const candidato = inicio + offset
        if (slotsValidos.has(candidato) && !horas.includes(minutosAHora(candidato))) {
          horas.push(minutosAHora(candidato))
          break
        }
      }
    }
  }

  return horas.sort()
}

/** Convierte el día de JS (0=domingo…6=sábado) al día ISO usado en prestador_horarios (1=lunes…7=domingo). */
export function diaISO(fecha: Date): number {
  const jsDay = fecha.getDay()
  return jsDay === 0 ? 7 : jsDay
}
