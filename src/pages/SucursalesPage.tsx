import { CrudPage } from '../components/Common/CrudPage'
import { sucursalesService } from '../services/entityServices'
import { useEmpresasSucursales } from '../hooks/useEmpresasSucursales'
import { useUserRole } from '../hooks/useUserRole'
import type { Sucursal } from '../types'

export function SucursalesPage() {
  const { idEmpresa } = useUserRole()
  const { opcionesEmpresa, nombreEmpresa } = useEmpresasSucursales()

  return (
    <CrudPage<Sucursal>
      titulo="Sucursales"
      idKey="id_sucursal"
      service={sucursalesService}
      orderBy="nombre_sucursal"
      defaults={{ activo: true } as any}
      columnas={[
        { key: 'nombre_sucursal', label: 'Nombre' },
        { key: 'id_empresa',      label: 'Empresa', render: r => nombreEmpresa(r.id_empresa) },
        { key: 'ciudad',          label: 'Región' },
        { key: 'comuna',          label: 'Comuna' },
        { key: 'telefono1',       label: 'Teléfono' },
        { key: 'activo',          label: 'Activa',  render: r => r.activo ? 'Sí' : 'No' },
      ]}
      campos={[
        { key: 'nombre_sucursal', label: 'Nombre',     required: true, ancho: 'completo' },
        { key: 'id_empresa',      label: 'Empresa',    type: 'select', required: true, options: opcionesEmpresa },
        { key: 'direccion',       label: 'Dirección',  ancho: 'completo' },
        { key: 'ciudad',          label: 'Región',     type: 'region' },
        { key: 'comuna',          label: 'Comuna',     type: 'comuna', dependsOn: 'ciudad' },
        { key: 'telefono1',       label: 'Teléfono 1', type: 'telefono', required: true },
        { key: 'telefono2',       label: 'Teléfono 2', type: 'telefono' },
        { key: 'activo',          label: 'Activa',     type: 'checkbox' },
      ]}
    />
  )
}
