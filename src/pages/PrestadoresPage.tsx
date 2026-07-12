import { CrudPage } from '../components/Common/CrudPage'
import { prestadoresService } from '../services/entityServices'
import { useEmpresasSucursales } from '../hooks/useEmpresasSucursales'
import { useUserRole } from '../hooks/useUserRole'
import type { Prestador } from '../types'

export function PrestadoresPage() {
  const { idEmpresa } = useUserRole()
  const { nombreEmpresa, nombreSucursal, opcionesEmpresa, opcionesSucursal } = useEmpresasSucursales()

  return (
    <CrudPage<Prestador>
      titulo="Prestadores"
      idKey="id_prestador"
      service={prestadoresService}
      orderBy="nombre_prestador"
      busqueda={{ campos: ['nombre_prestador', 'rut'], placeholder: 'Buscar por nombre o RUT…' }}
      campoFecha="created_at"
      defaults={{ activo: true, reserva_online: 1, buffer_min: 0, dias_agenda: 30 } as any}
      columnas={[
        { key: 'nombre_prestador', label: 'Nombre' },
        { key: 'id_empresa',       label: 'Empresa',        render: r => nombreEmpresa(r.id_empresa) },
        { key: 'id_sucursal',      label: 'Sucursal',       render: r => nombreSucursal(r.id_sucursal) },
        { key: 'telefono',         label: 'Teléfono' },
        { key: 'reserva_online',   label: 'Reserva online', render: r => Number(r.reserva_online) === 1 ? 'Sí' : 'No' },
        { key: 'activo',           label: 'Activo',         render: r => r.activo ? 'Sí' : 'No' },
      ]}
      campos={[
        { key: 'nombre_prestador', label: 'Nombre',         required: true, ancho: 'completo' },
        { key: 'id_empresa',       label: 'Empresa',        type: 'select', required: true, options: opcionesEmpresa },
        { key: 'id_sucursal',      label: 'Sucursal',       type: 'select', required: true, options: opcionesSucursal },
        { key: 'rut',              label: 'RUT',            type: 'rut' },
        { key: 'email',            label: 'Correo',         type: 'email' },
        { key: 'telefono',         label: 'Teléfono',       type: 'telefono', required: true },
        { key: 'direccion',        label: 'Dirección',      ancho: 'completo' },
        { key: 'ciudad',           label: 'Región',         type: 'region' },
        { key: 'comuna',           label: 'Comuna',         type: 'comuna', dependsOn: 'ciudad' },
        { key: 'comision',         label: 'Comisión (%)',   type: 'number' },
        { key: 'reserva_online',   label: 'Reserva online',    type: 'sino' },
        { key: 'paso_agenda',      label: 'Paso agenda (min)', type: 'number' },
        { key: 'buffer_min',       label: 'Buffer entre citas (min)', type: 'number' },
        { key: 'dias_agenda',      label: 'Días hacia adelante', type: 'number' },
        { key: 'activo',           label: 'Activo',            type: 'checkbox' },
      ]}
    />
  )
}
