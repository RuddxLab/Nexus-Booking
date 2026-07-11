// Íconos SVG minimalistas (stroke-based) para reemplazar los botones de texto.
// Usan currentColor para heredar el color del botón que los contiene.

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

export function IconEditar() {
  return (
    <svg {...base}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function IconEliminar() {
  return (
    <svg {...base}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

export function IconNuevo() {
  return (
    <svg {...base}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

export function IconBuscar() {
  return (
    <svg {...base}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
