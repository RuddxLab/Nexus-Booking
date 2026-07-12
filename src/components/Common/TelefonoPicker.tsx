import { useState, useRef, useEffect } from 'react'
import { PAISES_TELEFONO, separarTelefono, armarTelefono, validarTelefono } from '../../data/paisesTelefono'

interface Props {
  value: string           // formato "+56912345678"
  onChange: (val: string) => void
  disabled?: boolean
  style?: React.CSSProperties
}

/**
 * Selector de teléfono con bandera emoji visible.
 * Usa un dropdown custom en vez de <select> nativo para que los emojis
 * de bandera rendericen correctamente en todos los navegadores.
 */
export function TelefonoPicker({ value, onChange, disabled, style }: Props) {
  const { codigo, numero } = separarTelefono(value ?? '')
  const pais = PAISES_TELEFONO.find(p => p.codigo === codigo)
  const [abierto, setAbierto] = useState(false)
  const [busq,    setBusq]    = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!abierto) return
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false)
        setBusq('')
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [abierto])

  const filtrados = busq
    ? PAISES_TELEFONO.filter(p => p.pais.toLowerCase().includes(busq.toLowerCase()) || p.codigo.includes(busq))
    : PAISES_TELEFONO

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '6px 8px', borderRadius: 8, minWidth: 70,
    border: '1px solid var(--color-border)',
    background: disabled ? 'var(--color-surface-2)' : 'var(--color-surface)',
    color: 'var(--color-ink)', cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 16, fontFamily: 'inherit',
    opacity: disabled ? 0.6 : 1,
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <button
        type="button"
        style={btnStyle}
        disabled={disabled}
        onClick={() => !disabled && setAbierto(v => !v)}
        title={`${pais?.bandera} ${pais?.pais} (${codigo})`}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>{pais?.bandera ?? '🌐'}</span>
        <span style={{ fontSize: 11, color: 'var(--color-ink-soft)' }}>{codigo}</span>
        <span style={{ fontSize: 9, opacity: .5 }}>▾</span>
      </button>

      {abierto && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1000,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10, boxShadow: 'var(--shadow-elevated)',
          width: 220, marginTop: 4,
          maxHeight: 260, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)' }}>
            <input
              autoFocus
              value={busq}
              onChange={e => setBusq(e.target.value)}
              placeholder="Buscar país…"
              style={{
                width: '100%', padding: '5px 8px', borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-2)',
                color: 'var(--color-ink)', fontSize: 12,
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtrados.map(p => (
              <button
                key={p.codigo}
                type="button"
                onClick={() => {
                  onChange(armarTelefono(p.codigo, numero))
                  setAbierto(false)
                  setBusq('')
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '7px 12px',
                  background: p.codigo === codigo ? 'var(--color-primary-soft)' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: 13, color: 'var(--color-ink)',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (p.codigo !== codigo) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)' }}
                onMouseLeave={e => { if (p.codigo !== codigo) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ fontSize: 18, minWidth: 24 }}>{p.bandera}</span>
                <span style={{ flex: 1 }}>{p.pais}</span>
                <span style={{ fontSize: 11, color: 'var(--color-ink-soft)' }}>{p.codigo}</span>
              </button>
            ))}
            {filtrados.length === 0 && (
              <div style={{ padding: '12px', fontSize: 12, color: 'var(--color-ink-soft)', textAlign: 'center' }}>
                Sin resultados
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input del número */}
      <input
        value={numero}
        disabled={disabled}
        placeholder={`${pais?.digitos ?? ''} dígitos`}
        style={{
          display: 'none'  // el número lo maneja el padre
        }}
        onChange={e => {
          const n = e.target.value.replace(/\D/g, '').slice(0, pais?.digitos ?? 15)
          onChange(armarTelefono(codigo, n))
        }}
      />
    </div>
  )
}

// Helper para usar el número del teléfono
export { separarTelefono, armarTelefono, validarTelefono }
