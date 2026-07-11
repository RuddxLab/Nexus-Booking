import type { EstadoAgendamiento } from '../../types'

const ESTILOS: Record<EstadoAgendamiento, { bg: string; fg: string; label: string }> = {
  AGENDADA: { bg: 'var(--color-primary-soft)', fg: 'var(--color-primary)', label: 'Agendada' },
  CONFIRMADA: { bg: '#E4EEF6', fg: '#2F6699', label: 'Confirmada' },
  PAGADA: { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)', label: 'Pagada' },
  COMPLETADA: { bg: 'var(--color-success-soft)', fg: 'var(--color-success)', label: 'Completada' },
  CANCELADA: { bg: '#F1F0EC', fg: '#8A8681', label: 'Cancelada' },
  NO_ASISTIO: { bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)', label: 'No asistió' }
}

export function EstadoBadge({ estado }: { estado: EstadoAgendamiento }) {
  const s = ESTILOS[estado]
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  )
}
