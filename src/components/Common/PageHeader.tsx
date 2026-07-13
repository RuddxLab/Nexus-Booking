import type { ReactNode } from 'react'

interface Props {
  titulo: string
  children?: ReactNode
}

export function PageHeader({ titulo, children }: Props) {
  return (
    <div className="main__header">
      <div>
        <h1 className="page-header__title">{titulo}</h1>
        <div className="page-header__eyebrow">Nexus Booking · Admin Core</div>
      </div>
      {children && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {children}
        </div>
      )}
    </div>
  )
}
