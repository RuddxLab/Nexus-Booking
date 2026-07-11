import { CrudPage } from '../components/Common/CrudPage'
import { empresasService } from '../services/entityServices'
import type { Empresa } from '../types'

/** Convierte un nombre a slug URL-friendly: "Polish Nail Bar" → "polish-nail-bar" */
function nombreASlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function EmpresasPage() {
  return (
    <CrudPage<Empresa>
      titulo="Empresas"
      idKey="id_empresa"
      service={empresasService}
      orderBy="nombre_empresa"
      filtrarPorSucursal={false}
      defaults={{ activo: true } as any}
      transformPayload={(payload, esNuevo) => {
        // Auto-generar slug desde nombre_empresa al crear (nunca sobreescribir en edición)
        if (esNuevo && payload.nombre_empresa && !payload.slug) {
          return { ...payload, slug: nombreASlug(payload.nombre_empresa) }
        }
        return payload
      }}
      columnas={[
        { key: 'nombre_empresa', label: 'Nombre' },
        { key: 'rut_empresa',    label: 'RUT', type: 'rut' },
        { key: 'email_contacto', label: 'Correo de contacto', type: 'email' },
        { key: 'slug',           label: 'Slug (URL)' },
        { key: 'activo',         label: 'Activa', render: (r) => (r.activo ? 'Sí' : 'No') },
      ]}
      campos={[
        { key: 'nombre_empresa',    label: 'Nombre',            required: true, ancho: 'completo' },
        { key: 'rut_empresa',       label: 'RUT',               type: 'rut' },
        { key: 'email_contacto',    label: 'Correo de contacto', type: 'email' },
        { key: 'direccion_empresa', label: 'Dirección' },
        { key: 'slug', label: 'URL del negocio (ej: mi-salon)', soloEdicion: true },
        { key: 'activo',            label: 'Activa',            type: 'checkbox' },
      ]}
    />
  )
}
