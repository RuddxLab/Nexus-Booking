import { CrudPage } from '../components/Common/CrudPage'
import { serviciosService } from '../services/entityServices'
import { useEmpresasSucursales } from '../hooks/useEmpresasSucursales'
import { useUserRole } from '../hooks/useUserRole'
import { PrestadoresDelServicio } from '../components/Servicios/PrestadoresDelServicio'
import type { Servicio } from '../types'

const OPCIONES_TIPO_COMISION = [
  { value: 'P', label: 'Porcentaje (%)' },
  { value: 'F', label: 'Monto fijo ($)' },
]
const OPCIONES_IVA = [
  { value: 0, label: 'Sin IVA' },
  { value: 1, label: 'Con IVA (19%)' },
]

export function ServiciosPage() {
  const { idEmpresa } = useUserRole()
  const { nombreEmpresa, nombreCategoria, opcionesEmpresa, opcionesSucursal, opcionesCategorias } = useEmpresasSucursales()

  return (
    <CrudPage<Servicio>
      titulo="Servicios"
      idKey="id_servicio"
      service={serviciosService}
      orderBy="nombre_servicio"
      busqueda={{ campos: ['nombre_servicio'], placeholder: 'Buscar servicio…' }}
      filaExpandible={s => <PrestadoresDelServicio servicio={s} />}
      defaults={{ activo: true, maneja_iva: 0, tipo_comision: 'P' } as any}
      columnas={[
        { key: 'nombre_servicio', label: 'Servicio' },
        { key: 'id_categoria',   label: 'Categoría', render: r => nombreCategoria(r.id_categoria) },
        { key: 'duracion',       label: 'Duración',  render: r => `${r.duracion} min` },
        { key: 'valor',          label: 'Valor',     render: r => `$${Number(r.valor).toLocaleString('es-CL')}` },
        { key: 'maneja_iva',     label: 'IVA',       render: r => Number(r.maneja_iva) === 1 ? 'Con IVA' : 'Sin IVA' },
        { key: 'comision',       label: 'Comisión',  render: r => r.comision != null ? `${r.comision}${r.tipo_comision === 'F' ? ' $' : '%'}` : '—' },
        { key: 'id_empresa',     label: 'Empresa',   render: r => nombreEmpresa(r.id_empresa) },
        { key: 'activo',         label: 'Activo',    render: r => r.activo ? 'Sí' : 'No' },
      ]}
      campos={[
        { key: 'nombre_servicio', label: 'Nombre del servicio', required: true, ancho: 'completo' },
        { key: 'descripcion',     label: 'Descripción',         ancho: 'completo' },
        { key: 'id_categoria',    label: 'Categoría',           type: 'select', required: true, options: opcionesCategorias(idEmpresa ?? undefined) },
        { key: 'duracion',        label: 'Duración (minutos)',  type: 'number', required: true },
        { key: 'valor',           label: 'Valor ($)',           type: 'number', required: true },
        { key: 'maneja_iva',      label: 'IVA',                type: 'select', options: OPCIONES_IVA },
        { key: 'tipo_comision',   label: 'Tipo de comisión',   type: 'select', options: OPCIONES_TIPO_COMISION },
        { key: 'comision',        label: 'Comisión (valor)',   type: 'number' },
        { key: 'id_empresa',      label: 'Empresa',            type: 'select', required: true, options: opcionesEmpresa },
        { key: 'id_sucursal',     label: 'Sucursal',           type: 'select', required: true, options: opcionesSucursal },
        { key: 'activo',          label: 'Activo',             type: 'checkbox' },
      ]}
    />
  )
}
