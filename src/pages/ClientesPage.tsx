import { CrudPage } from '../components/Common/CrudPage'
import { clientesService } from '../services/entityServices'
import { useEmpresasSucursales } from '../hooks/useEmpresasSucursales'
import { useUserRole } from '../hooks/useUserRole'
import type { Cliente } from '../types'

export function ClientesPage() {
  const { idEmpresa } = useUserRole()
  const { opcionesEmpresa, nombreEmpresa } = useEmpresasSucursales()

  return (
    <CrudPage<Cliente>
      titulo="Clientes"
      idKey="id_cliente"
      service={clientesService}
      orderBy="nombre_cliente"
      filtrarPorSucursal={false}
      campoFecha="created_at"
      busqueda={{ campos: ['nombre_cliente', 'rut', 'telefono', 'email'], placeholder: 'Buscar por nombre, RUT, teléfono o correo…' }}
      defaults={{ activo: true } as any}
      columnas={[
        { key: 'nombre_cliente', label: 'Nombre' },
        { key: 'id_empresa',    label: 'Empresa',  render: r => nombreEmpresa(r.id_empresa) },
        { key: 'telefono',      label: 'Teléfono' },
        { key: 'email',         label: 'Correo' },
        { key: 'genero',        label: 'Género',   render: r => r.genero === 'M' ? 'Masculino' : r.genero === 'F' ? 'Femenino' : '' },
        { key: 'activo',        label: 'Activo',   render: r => r.activo ? 'Sí' : 'No' },
      ]}
      campos={[
        { key: 'nombre_cliente',   label: 'Nombre',              required: true, ancho: 'completo' },
        { key: 'id_empresa',       label: 'Empresa',             type: 'select', required: true, options: opcionesEmpresa },
        { key: 'telefono',         label: 'Teléfono',            type: 'telefono', required: true },
        { key: 'email',            label: 'Correo',              type: 'email' },
        { key: 'rut',              label: 'RUT',                 type: 'rut' },
        { key: 'genero',           label: 'Género',              type: 'select', options: [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }] },
        { key: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date' },
        { key: 'ciudad',           label: 'Región',              type: 'region' },
        { key: 'comuna',           label: 'Comuna',              type: 'comuna', dependsOn: 'ciudad' },
        { key: 'direccion',        label: 'Dirección',           ancho: 'completo' },
        { key: 'notas',            label: 'Notas',               ancho: 'completo' },
        { key: 'activo',           label: 'Activo',              type: 'checkbox' },
      ]}
    />
  )
}
