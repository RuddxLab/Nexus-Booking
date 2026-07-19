import { CrudPage } from '../components/Common/CrudPage'
import { empresasService } from '../services/entityServices'
import type { Empresa } from '../types'

/** Genera un ID corto aleatorio de 8 caracteres en base36 (letras + números) */
function generarSlugAleatorio(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 8)
}

export function EmpresasPage() {
  return (
    <CrudPage<Empresa>
      titulo="Empresas"
      idKey="id_empresa"
      service={empresasService}
      orderBy="nombre_empresa"
      filtrarPorSucursal={false}
      defaults={{ activo: true, servicios_por_sucursal: true } as any}
      transformPayload={(payload, esNuevo) => {
        // Auto-generar slug aleatorio al crear — nunca modificable
        if (esNuevo && !payload.slug) {
          return { ...payload, slug: generarSlugAleatorio() }
        }
        return payload
      }}
      columnas={[
        { key: 'nombre_empresa', label: 'Nombre' },
        { key: 'rut_empresa',    label: 'RUT', type: 'rut' },
        { key: 'email_contacto', label: 'Correo de contacto', type: 'email' },
        { key: 'slug',           label: 'Slug (URL)' },
        { key: 'servicios_por_sucursal', label: 'Servicios', render: (r) => (r.servicios_por_sucursal ? 'Por sucursal' : 'Compartidos') },
        { key: 'activo',         label: 'Activa', render: (r) => (r.activo ? 'Sí' : 'No') },
      ]}
      campos={[
        { key: 'nombre_empresa',    label: 'Nombre',             required: true, ancho: 'completo' },
        { key: 'rut_empresa',       label: 'RUT',                type: 'rut' },
        { key: 'email_contacto',    label: 'Correo de contacto', type: 'email' },
        { key: 'direccion_empresa', label: 'Dirección' },
        { key: 'slug',              label: 'URL del negocio',    soloEdicion: true, soloLectura: true },
        { key: 'servicios_por_sucursal', label: 'Servicios por sucursal (desmarcar = compartidos entre sucursales)', type: 'checkbox' },
        { key: 'activo',            label: 'Activa',             type: 'checkbox' },
      ]}
    />
  )
}
