import { CrudPage } from '../components/Common/CrudPage'
import { sucursalesService } from '../services/entityServices'
import { useEmpresasSucursales } from '../hooks/useEmpresasSucursales'
import { useUserRole } from '../hooks/useUserRole'
import type { Sucursal } from '../types'

/** Genera un ID corto aleatorio de 8 caracteres en base36 */
function generarSlugAleatorio(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 8)
}

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
      transformPayload={(payload, esNuevo) => {
        // Auto-generar slug aleatorio al crear — nunca modificable
        if (esNuevo && !payload.slug) {
          return { ...payload, slug: generarSlugAleatorio() }
        }
        return payload
      }}
      columnas={[
        { key: 'nombre_sucursal', label: 'Nombre' },
        { key: 'id_empresa',      label: 'Empresa', render: r => nombreEmpresa(r.id_empresa) },
        { key: 'slug',            label: 'Slug (URL)' },
        { key: 'ciudad',          label: 'Región' },
        { key: 'activo',          label: 'Activa',  render: r => r.activo ? 'Sí' : 'No' },
      ]}
      campos={[
        { key: 'nombre_sucursal', label: 'Nombre',       required: true, ancho: 'completo' },
        { key: 'id_empresa',      label: 'Empresa',       type: 'select', required: true, options: opcionesEmpresa },
        { key: 'slug',            label: 'URL sucursal',  soloEdicion: true, soloLectura: true },
        { key: 'direccion',       label: 'Dirección',     ancho: 'completo' },
        { key: 'ciudad',          label: 'Región',        type: 'region' },
        { key: 'comuna',          label: 'Comuna',        type: 'comuna', dependsOn: 'ciudad' },
        { key: 'telefono1',       label: 'Teléfono 1',   type: 'telefono', required: true },
        { key: 'telefono2',       label: 'Teléfono 2',   type: 'telefono' },
        { key: 'activo',          label: 'Activa',        type: 'checkbox' },
      ]}
    />
  )
}
