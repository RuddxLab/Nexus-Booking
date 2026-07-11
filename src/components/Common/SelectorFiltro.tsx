import type { Empresa, Sucursal } from '../../types'

interface Props {
  esAdmin:      boolean
  esSupervisor: boolean
  empresas:     Empresa[]
  sucursalesDeEmpresa: Sucursal[]
  empresaId:    number | null
  sucursalId:   number | null
  onEmpresaChange:  (id: number) => void
  onSucursalChange: (id: number) => void
  /** Si false, oculta el selector de sucursal aunque haya sucursales disponibles */
  mostrarSucursal?: boolean
}

const SEL: React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-ink)',
  fontSize: 13,
  cursor: 'pointer',
  minWidth: 180,
}

export function SelectorFiltro({
  esAdmin, esSupervisor,
  empresas, sucursalesDeEmpresa,
  empresaId, sucursalId,
  onEmpresaChange, onSucursalChange,
  mostrarSucursal = true,
}: Props) {
  const mostrarEmpresa  = esAdmin && empresas.length > 1
  const mostrarSucursalFinal = mostrarSucursal &&
    (esAdmin || esSupervisor) && sucursalesDeEmpresa.length > 1

  if (!mostrarEmpresa && !mostrarSucursalFinal) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      {mostrarEmpresa && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink-soft)', whiteSpace: 'nowrap' }}>
            Empresa:
          </label>
          <select
            value={empresaId ?? ''}
            onChange={e => onEmpresaChange(Number(e.target.value))}
            style={SEL}
          >
            {empresas.map(e => (
              <option key={e.id_empresa} value={e.id_empresa}>{e.nombre_empresa}</option>
            ))}
          </select>
        </div>
      )}

      {mostrarSucursalFinal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink-soft)', whiteSpace: 'nowrap' }}>
            Sucursal:
          </label>
          <select
            value={sucursalId ?? ''}
            onChange={e => onSucursalChange(Number(e.target.value))}
            style={SEL}
          >
            {sucursalesDeEmpresa.map(s => (
              <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre_sucursal}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
