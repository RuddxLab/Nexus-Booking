import { CrudPage } from '../components/Common/CrudPage'
import { descuentosService } from '../services/entityServices'
import { useEmpresasSucursales } from '../hooks/useEmpresasSucursales'
import type { Descuento } from '../types'

const OPCIONES_TIPO = [
  { value: 'PORCENTAJE', label: 'Porcentaje (%)' },
  { value: 'MONTO',      label: 'Monto fijo ($)' },
]

const OPCIONES_APLICA = [
  { value: 'TODO',      label: 'Toda la venta' },
  { value: 'SERVICIOS', label: 'Solo servicios' },
  { value: 'PRODUCTOS', label: 'Solo productos' },
]

const money = (n: number | null) => `$${Number(n ?? 0).toLocaleString('es-CL')}`

/**
 * Catálogo de descuentos y promociones, a nivel de empresa.
 * El descuento se aplica en el punto de venta; el servidor lo reparte
 * proporcionalmente entre las líneas para que IVA y comisión cuadren.
 */
export function DescuentosPage() {
  const { nombreEmpresa, opcionesEmpresa } = useEmpresasSucursales()

  return (
    <CrudPage<Descuento>
      titulo="Descuentos y promociones"
      idKey="id_descuento"
      service={descuentosService}
      orderBy="nombre"
      filtrarPorSucursal={false}
      busqueda={{ campos: ['nombre'], placeholder: 'Buscar descuento…' }}
      defaults={{ activo: true, tipo: 'PORCENTAJE', aplica_a: 'TODO', valor: 0 } as any}
      columnas={[
        { key: 'nombre',     label: 'Nombre' },
        { key: 'valor',      label: 'Descuento', render: r => r.tipo === 'PORCENTAJE' ? `${r.valor}%` : money(r.valor) },
        { key: 'aplica_a',   label: 'Aplica a',  render: r => OPCIONES_APLICA.find(o => o.value === r.aplica_a)?.label ?? r.aplica_a },
        { key: 'tope_monto', label: 'Tope',      render: r => r.tope_monto ? money(r.tope_monto) : 'Sin tope' },
        {
          key: 'fecha_desde', label: 'Vigencia',
          render: r => !r.fecha_desde && !r.fecha_hasta
            ? 'Siempre'
            : `${r.fecha_desde ?? '…'} → ${r.fecha_hasta ?? '…'}`,
        },
        { key: 'id_empresa', label: 'Empresa', render: r => nombreEmpresa(r.id_empresa) },
        { key: 'activo',     label: 'Activo',  render: r => (r.activo ? 'Sí' : 'No') },
      ]}
      campos={[
        { key: 'nombre',      label: 'Nombre de la promoción', required: true, ancho: 'completo' },
        { key: 'tipo',        label: 'Tipo de descuento', type: 'select', required: true, options: OPCIONES_TIPO },
        { key: 'valor',       label: 'Valor (% o $ según el tipo)', type: 'number', required: true },
        { key: 'aplica_a',    label: 'Aplica a', type: 'select', required: true, options: OPCIONES_APLICA },
        { key: 'tope_monto',  label: 'Tope máximo en $ (opcional)', type: 'number' },
        { key: 'fecha_desde', label: 'Vigente desde (opcional)', type: 'date' },
        { key: 'fecha_hasta', label: 'Vigente hasta (opcional)', type: 'date' },
        { key: 'id_empresa',  label: 'Empresa', type: 'select', required: true, options: opcionesEmpresa },
        { key: 'activo',      label: 'Activo', type: 'checkbox' },
      ]}
    />
  )
}
