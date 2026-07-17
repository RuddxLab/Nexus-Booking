// Calcula las horas de inicio reservables para un prestador en un día dado,
// a partir de su horario laboral, sus ausencias y las citas ya ocupadas.

interface Rango {
  hora_inicio: string // 'HH:MM' o 'HH:MM:SS'
  hora_fin: string
}

interface GenerarHorasDisponiblesOpts {
  horaInicio:  string
  horaFin:     string
  duracionMin: number
  fecha:       string    // 'YYYY-MM-DD'
  ocupados?:   Rango[]
  ausencias?:  Rango[]
  bufferMin?:  number   // colchón entre citas
  pasoMin?:    number   // granularidad de presentación (NULL = usar duración)
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
  ocupados  = [],
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

  // Paso de presentación:
  // - Si pasoMin está definido → usarlo (configuración del prestador)
  // - Si es null/undefined     → usar la duración del servicio
  const pasoDisplay = (pasoMin != null && pasoMin > 0) ? pasoMin : duracionMin

  // Paso interno de búsqueda: MCD entre pasoDisplay y 5
  // Siempre ≤5 min para no perder huecos post-ausencia
  const PASO_BUSQUEDA = Math.min(pasoDisplay, 5)

  // 1. Encontrar todos los slots válidos con búsqueda fina
  const slotsValidos = new Set<number>()
  for (let inicio = inicioJornada; inicio + duracionMin <= finJornada; inicio += PASO_BUSQUEDA) {
    const fin = inicio + duracionMin
    if (esHoy && inicio <= minutoActual) continue
    const choca = bloqueos.some((b) => seSuperponen(inicio, fin, b.inicio, b.fin))
    if (!choca) slotsValidos.add(inicio)
  }

  // 2. Presentar slots en el paso configurado,
  //    recuperando huecos post-ausencia que no caen en múltiplo del paso
  const horas: string[] = []
  const mostrados = new Set<number>()

  for (let inicio = inicioJornada; inicio + duracionMin <= finJornada; inicio += pasoDisplay) {
    if (slotsValidos.has(inicio)) {
      horas.push(minutosAHora(inicio))
      mostrados.add(inicio)
    } else {
      // Recuperar hueco post-ausencia SOLO si el slot fue bloqueado por una
      // ausencia o reserva. Si simplemente ya pasó la hora, no rescatar:
      // evita mostrar slots con separación menor al paso configurado.
      const fueBloqueo = bloqueos.some((b) =>
        seSuperponen(inicio, inicio + duracionMin, b.inicio, b.fin)
      )
      if (fueBloqueo) {
        for (let offset = PASO_BUSQUEDA; offset < pasoDisplay; offset += PASO_BUSQUEDA) {
          const candidato = inicio + offset
          if (slotsValidos.has(candidato) && !mostrados.has(candidato)) {
            horas.push(minutosAHora(candidato))
            mostrados.add(candidato)
            break
          }
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
