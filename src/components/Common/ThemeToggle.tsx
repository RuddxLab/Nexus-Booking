import { useTheme } from '../../hooks/useTheme'

interface Props {
  className?: string
  style?: React.CSSProperties
}

export function ThemeToggle({ className, style }: Props) {
  const { tema, alternarTema } = useTheme()
  const estaEnOscuro = tema === 'oscuro'

  return (
    <button
      onClick={alternarTema}
      className={className}
      style={{
        background: 'var(--rx-surf2)',
        border: '1px solid var(--rx-bdr)',
        borderRadius: 20,
        padding: '5px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--rx-muted)',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(.22,.61,.36,1)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        ...style,
      }}
      title={estaEnOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {/* Muestra el icono/texto del modo al que VA A CAMBIAR */}
      <span style={{ fontSize: 13, lineHeight: 1 }}>
        {estaEnOscuro ? '☀️' : '🌙'}
      </span>
      <span>{estaEnOscuro ? 'Claro' : 'Oscuro'}</span>
    </button>
  )
}
