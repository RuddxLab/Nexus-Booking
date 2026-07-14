import { useState } from 'react'
import type { Agendamiento, PrestadorAusencia, DiaBloqueado, PrestadorHorario } from '../../types'
import {
  NOMBRES_DIA,
  toISODate,
  timeToMinutes,
  ALTO_HORA_PX
} from '../../utils/calendarUtils'
import { diaISO } from '../../utils/disponibilidad'
import { AppointmentBlock, asignarColumnas } from './AppointmentBlock'

const DEFAULT_HORA_INICIO = 8
const DEFAULT_HORA_FIN    = 20
const NOMBRES_DIA_ISO = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO']

function esMobile() {
  return typeof window !== 'undefined' && window.innerWidth <= 768
}

function calcularRangoHoras(citasPorDia: Record<string, Agendamiento[]>): {
  horaInicio: number
  horas: number[]
} {
  let min = DEFAULT_HORA_INICIO
  let max = DEFAULT_HORA_FIN

  for (const citas of Object.values(citasPorDia)) {
    for (const c of citas) {
      if (c.estado === 'CANCELADA') continue
      const ih = Math.floor(timeToMinutes(c.hora_inicio) / 60)
      const fh = Math.ceil(timeToMinutes(c.hora_fin) / 60)
      if (ih < min) min = ih
      if (fh > max) max = fh
    }
  }
  return { horaInicio: min, horas: Array.from({ length: max - min }, (_, i) => min + i) }
}

interface BloqueRojo {
  horaInicio: string   // "HH:MM" o "00:00" si día completo
  horaFin: string      // "HH:MM" o "23:59" si día completo
  etiqueta: string
  diaCom: boolean      // día completo
}

/** Bloque visual rojo */
function BloqueAusencia({ bloque, horaInicioDia, totalHoras }: {
  bloque: BloqueRojo
  horaInicioDia: number
  totalHoras: number
}) {
  const totalAlto   = totalHoras * ALTO_HORA_PX
  const inicioMin   = timeToMinutes(bloque.horaInicio) - horaInicioDia * 60
  const finMin      = timeToMinutes(bloque.horaFin)    - horaInicioDia * 60
  const top         = Math.max(0, (inicioMin / 60) * ALTO_HORA_PX)
  const height      = bloque.diaCom
    ? totalAlto
    : Math.max(((finMin - inicioMin) / 60) * ALTO_HORA_PX, 20)

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 2,
        right: 2,
        height,
        background: bloque.diaCom ? 'rgba(229,72,77,0.08)' : 'rgba(229,72,77,0.10)',
        borderLeft: '3px solid #E5484D',
        borderRadius: 6,
        zIndex: 1,
        pointerEvents: 'none',
        ...(!bloque.diaCom ? {
          display: 'flex',
          alignItems: 'flex-start',
          padding: '4px 6px',
          fontSize: 11,
          color: '#E5484D',
          fontWeight: 600,
          overflow: 'hidden',
          lineHeight: 1.3,
        } : {}),
      }}
      title={bloque.etiqueta}
    >
      {!bloque.diaCom && bloque.etiqueta}
    </div>
  )
}

export function WeekView({
  dias,
  citasPorDia,
  diasBloqueados = [],
  ausenciasRecurrentes = [],
  horariosActivos = [],
  idPrestadorActual = null,
  onSlotClick,
  onCitaClick,
}: {
  dias: Date[]
  citasPorDia: Record<string, Agendamiento[]>
  diasBloqueados?: DiaBloqueado[]
  ausenciasRecurrentes?: PrestadorAusencia[]
  horariosActivos?: PrestadorHorario[]
  idPrestadorActual?: number | null  // si viene, filtra días no laborables solo para este prestador
  onSlotClick: (fecha: string, hora: string) => void
  onCitaClick: (cita: Agendamiento) => void
}) {
  const hoyISO = toISODate(new Date())

  const indiceHoy = dias.findIndex(d => toISODate(d) === hoyISO)
  const [offsetMobile, setOffsetMobile] = useState<number>(
    indiceHoy >= 0 ? Math.min(indiceHoy, 4) : 0
  )

  const diasVisibles = esMobile() ? dias.slice(offsetMobile, offsetMobile + 3) : dias
  const puedeAntes   = offsetMobile > 0
  const puedeDespues = offsetMobile + 3 < dias.length

  const { horaInicio, horas } = calcularRangoHoras(citasPorDia)

  /** True si el día de semana no tiene horario activo en ningún prestador */
  function diaNoLaborable(dia: Date): boolean {
    if (horariosActivos.length === 0) return false
    const diaNro = diaISO(dia)
    // Si hay un prestador específico, filtrar solo sus horarios
    const horariosFiltrados = idPrestadorActual
      ? horariosActivos.filter(h => h.id_prestador === idPrestadorActual)
      : horariosActivos
    if (horariosFiltrados.length === 0) return false
    return !horariosFiltrados.some(h => h.dia === diaNro && h.activo && h.hora_inicio && h.hora_fin)
  }

  /** Construye los bloques rojos para un día dado */
  function bloquesDelDia(dia: Date, iso: string): BloqueRojo[] {
    const bloques: BloqueRojo[] = []
    const diaNro = diaISO(dia)
    const nombreDiaISO = NOMBRES_DIA_ISO[diaNro - 1]

    // 1. Ausencias recurrentes (por día de semana, filtradas por prestador si aplica)
    const ausenciasFiltr = idPrestadorActual
      ? ausenciasRecurrentes.filter(a => a.id_prestador === idPrestadorActual)
      : ausenciasRecurrentes
    const ausDelDia = ausenciasFiltr.filter(a =>
      String(a.dia).trim().toUpperCase() === nombreDiaISO ||
      String(a.dia).trim() === String(diaNro)
    )
    for (const a of ausDelDia) {
      bloques.push({
        horaInicio: (a.hora_inicio ?? '00:00').slice(0, 5),
        horaFin:    (a.hora_fin   ?? '23:59').slice(0, 5),
        etiqueta:   'Ausencia',
        diaCom:     false,
      })
    }

    // 2. Días bloqueados (fecha específica)
    const bloqDelDia = diasBloqueados.filter(b => b.fecha === iso)
    for (const b of bloqDelDia) {
      const diaCom = !b.hora_inicio || !b.hora_fin
      bloques.push({
        horaInicio: diaCom ? '00:00' : b.hora_inicio!.slice(0, 5),
        horaFin:    diaCom ? '23:59' : b.hora_fin!.slice(0, 5),
        etiqueta:   b.descripcion ?? 'Bloqueado',
        diaCom,
      })
    }

    return bloques
  }

  /** True si el slot hora:00 está dentro de algún bloque bloqueado */
  function slotBloqueado(bloques: BloqueRojo[], hora: number): boolean {
    const slotMin = hora * 60
    return bloques.some(b => {
      if (b.diaCom) return true
      const ini = timeToMinutes(b.horaInicio)
      const fin = timeToMinutes(b.horaFin)
      return slotMin >= ini && slotMin < fin
    })
  }

  return (
    <div>
      <div className="week-mobile-nav">
        <button className="btn btn--ghost" onClick={() => setOffsetMobile(o => Math.max(0, o - 3))} disabled={!puedeAntes}>
          ← Ant
        </button>
        <span className="week-mobile-nav__label">
          {diasVisibles[0]
            ? `${diasVisibles[0].getDate()} – ${diasVisibles[diasVisibles.length - 1].getDate()} ${diasVisibles[0].toLocaleDateString('es-CL', { month: 'short' })}`
            : ''}
        </span>
        <button className="btn btn--ghost" onClick={() => setOffsetMobile(o => Math.min(dias.length - 3, o + 3))} disabled={!puedeDespues}>
          Sig →
        </button>
      </div>

      <div className="calendar">
        <div className="calendar__gutter">
          <div style={{ height: 49, borderBottom: '1px solid var(--color-border)' }} />
          {horas.map(h => (
            <div key={h} className="calendar__gutter-cell">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        <div
          className="calendar__days"
          style={{ gridTemplateColumns: `repeat(${diasVisibles.length}, 1fr)` }}
        >
          {diasVisibles.map(dia => {
            const iso    = toISODate(dia)
            const esHoy  = iso === hoyISO
            const diaNro = diaISO(dia)
            const citas  = (citasPorDia[iso] ?? []).filter(c => c.estado !== 'CANCELADA')
            const bloques = bloquesDelDia(dia, iso)
            const diaComBloquedo = bloques.some(b => b.diaCom)
            const noLaborable = diaNoLaborable(dia)

            return (
              <div key={iso}>
                <div className={`calendar__day-header ${esHoy ? 'calendar__day-header--today' : ''} ${diaComBloquedo ? 'calendar__day-header--bloqueado' : ''} ${noLaborable && !diaComBloquedo ? 'calendar__day-header--no-laborable' : ''}`}>
                  <div className="calendar__day-name">{NOMBRES_DIA[diaNro - 1]}</div>
                  <div className="calendar__day-number">{dia.getDate()}</div>
                </div>
                <div className="calendar__day-column" style={{ position: 'relative' }}>
                  {noLaborable && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'var(--color-primary-soft)',
                      borderTop: '2px solid var(--color-primary)',
                      zIndex: 1, pointerEvents: 'none',
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                      paddingTop: 8,
                      fontSize: 10, color: 'var(--color-primary)', fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>
                      No laborable
                    </div>
                  )}
                  {horas.map(h => {
                    const bloqueado = slotBloqueado(bloques, h) || noLaborable
                    return (
                      <div
                        key={h}
                        className="calendar__hour-line"
                        style={bloqueado ? { cursor: 'not-allowed', background: noLaborable ? 'var(--color-primary-soft)' : 'rgba(229,72,77,0.04)' } : {}}
                        onClick={() => {
                          if (!bloqueado) onSlotClick(iso, `${String(h).padStart(2, '0')}:00`)
                        }}
                      />
                    )
                  })}

                  {/* Bloques rojos de ausencias y días bloqueados */}
                  {bloques.map((b, i) => (
                    <BloqueAusencia key={i} bloque={b} horaInicioDia={horaInicio} totalHoras={horas.length} />
                  ))}

                  {/* Citas con columnas anti-solapamiento */}
                  {asignarColumnas(citas).map(({ cita, col, totalCols }) => (
                    <AppointmentBlock
                      key={cita.id_agendamiento}
                      cita={cita}
                      horaInicioDia={horaInicio}
                      col={col}
                      totalCols={totalCols}
                      onClick={onCitaClick}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
