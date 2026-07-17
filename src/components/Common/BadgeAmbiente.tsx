import { useEffect } from 'react'
import { AMBIENTE, esProd } from '../../config/ambiente'

/**
 * Banda de ambiente. En PROD no renderiza nada: la AUSENCIA de color es la
 * señal de que estás en producción. Si ves color, no lo estás.
 *
 * Montar una sola vez, lo más arriba posible (App.tsx), para que cubra tanto
 * el admin como las páginas públicas (/reservar, /cancelar).
 */
export function BadgeAmbiente() {
  useEffect(() => {
    const base = 'Nexus Booking'
    document.title = AMBIENTE.prefijoTitulo + base

    // Favicon teñido: un SVG data-URI, sin archivos extra que mantener.
    if (!esProd && AMBIENTE.color) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${AMBIENTE.color}"/></svg>`
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.type = 'image/svg+xml'
      link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`
    }

    // Empuja el layout hacia abajo para que la banda no tape nada.
    document.body.classList.toggle('con-badge-ambiente', !esProd)
    return () => document.body.classList.remove('con-badge-ambiente')
  }, [])

  if (esProd || !AMBIENTE.color) return null

  return (
    <div
      className="badge-ambiente"
      style={{ background: AMBIENTE.color }}
      role="status"
      aria-label={`Ambiente ${AMBIENTE.etiqueta}`}
    >
      {AMBIENTE.etiqueta}
    </div>
  )
}
