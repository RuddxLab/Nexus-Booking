import { CrudPage } from '../components/Common/CrudPage'
import { empresasService } from '../services/entityServices'
import type { Empresa } from '../types'

// Si el servicio y el prestador tienen comisión, ambas se convierten a pesos
// y esta regla decide cuál se aplica.
const OPCIONES_REGLA_COMISION = [
  { value: 'MAYOR',     label: 'La mayor (más beneficio al prestador)' },
  { value: 'MENOR',     label: 'La menor' },
  { value: 'SERVICIO',  label: 'La del servicio (prestador como respaldo)' },
  { value: 'PRESTADOR', label: 'La del prestador (servicio como respaldo)' },
]

// Cambiarla después de emitir documentos hace que los reportes históricos
// dejen de reproducirse.
const OPCIONES_REGLA_REDONDEO = [
  { value: 'TOTAL', label: 'Sobre el total del documento (recomendado)' },
  { value: 'LINEA', label: 'Por cada línea' },
]

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
      defaults={{ activo: true, catalogo_por_sucursal: true, tasa_iva: 19, regla_comision: 'MAYOR', regla_redondeo: 'TOTAL', descuento_afecta_comision: true } as any}
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
        { key: 'catalogo_por_sucursal', label: 'Catálogo', render: (r) => (r.catalogo_por_sucursal ? 'Por sucursal' : 'Compartido') },
        { key: 'tasa_iva',       label: 'IVA', render: (r) => `${Number(r.tasa_iva ?? 19)}%` },
        { key: 'activo',         label: 'Activa', render: (r) => (r.activo ? 'Sí' : 'No') },
      ]}
      campos={[
        { key: 'nombre_empresa',    label: 'Nombre',             required: true, ancho: 'completo' },
        { key: 'rut_empresa',       label: 'RUT',                type: 'rut' },
        { key: 'email_contacto',    label: 'Correo de contacto', type: 'email' },
        { key: 'direccion_empresa', label: 'Dirección' },
        { key: 'slug',              label: 'URL del negocio',    soloEdicion: true, soloLectura: true },
        { key: 'catalogo_por_sucursal', label: 'Catálogo por sucursal — servicios y productos (desmarcar = compartido entre sucursales)', type: 'checkbox' },
        { key: 'tasa_iva',       label: 'Tasa de IVA (%)', type: 'number' },
        { key: 'regla_comision', label: 'Comisión: cuál gana si el servicio y el prestador tienen', type: 'select', options: OPCIONES_REGLA_COMISION },
        { key: 'descuento_afecta_comision', label: 'El descuento reduce la comisión del prestador (desmarcar = lo absorbe la empresa)', type: 'checkbox' },
        { key: 'regla_redondeo', label: 'Redondeo del IVA', type: 'select', options: OPCIONES_REGLA_REDONDEO },
        { key: 'activo',            label: 'Activa',             type: 'checkbox' },
      ]}
    />
  )
}
