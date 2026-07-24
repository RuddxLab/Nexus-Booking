import { useEffect, useState } from 'react'
import { CrudPage } from '../components/Common/CrudPage'
import { descuentosService } from '../services/entityServices'
import { useEmpresasSucursales } from '../hooks/useEmpresasSucursales'
import { useUserRole } from '../hooks/useUserRole'
import { supabase } from '../services/supabaseClient'
import type { Descuento } from '../types'

const OPCIONES_TIPO = [
  { value: 'PORCENTAJE', label: 'Porcentaje (%)' },
  { value: 'MONTO',      label: 'Monto fijo ($)' },
  { value: 'NXM',        label: 'Promo por cantidad (2x1, 3x2…)' },
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
  const { opcionesEmpresa } = useEmpresasSucursales()
  const { idEmpresa } = useUserRole()
  const [opcionesServicio, setOpcionesServicio] = useState<{ value: number; label: string }[]>([])
  const [opcionesProducto, setOpcionesProducto] = useState<{ value: number; label: string }[]>([])

  // El 2x1 se define sobre un ítem concreto, así que hay que ofrecerlos.
  useEffect(() => {
    if (!idEmpresa) return
    let vivo = true
    Promise.all([
      supabase.from('servicios').select('id_servicio, nombre_servicio')
        .eq('id_empresa', idEmpresa).eq('activo', true).order('nombre_servicio'),
      supabase.from('productos').select('id_producto, nombre')
        .eq('id_empresa', idEmpresa).eq('activo', true).order('nombre'),
    ]).then(([rs, rp]) => {
      if (!vivo) return
      setOpcionesServicio((rs.data ?? []).map((s: any) => ({ value: s.id_servicio, label: s.nombre_servicio })))
      setOpcionesProducto((rp.data ?? []).map((p: any) => ({ value: p.id_producto, label: p.nombre })))
    })
    return () => { vivo = false }
  }, [idEmpresa])

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
        {
          key: 'valor', label: 'Promoción',
          render: r => r.tipo === 'NXM' ? `${r.nx_lleva}x${r.nx_paga}`
            : r.tipo === 'PORCENTAJE' ? `${r.valor}%` : money(r.valor),
        },
        { key: 'codigo',     label: 'Cupón',    render: r => r.codigo || '—' },
        {
          key: 'usos', label: 'Usos',
          render: r => r.max_usos != null ? `${r.usos} / ${r.max_usos}` : String(r.usos ?? 0),
        },
        { key: 'aplica_a',   label: 'Aplica a', render: r => r.tipo === 'NXM' ? 'Ítem específico' : (OPCIONES_APLICA.find(o => o.value === r.aplica_a)?.label ?? r.aplica_a) },
        { key: 'tope_monto', label: 'Tope',     render: r => r.tope_monto ? money(r.tope_monto) : 'Sin tope' },
        {
          key: 'fecha_desde', label: 'Vigencia',
          render: r => !r.fecha_desde && !r.fecha_hasta
            ? 'Siempre'
            : `${r.fecha_desde ?? '…'} → ${r.fecha_hasta ?? '…'}`,
        },
        { key: 'activo',     label: 'Activo',  render: r => (r.activo ? 'Sí' : 'No') },
      ]}
      campos={[
        { key: 'nombre',      label: 'Nombre de la promoción', required: true, ancho: 'completo' },
        { key: 'tipo',        label: 'Tipo de descuento', type: 'select', required: true, options: OPCIONES_TIPO },
        { key: 'valor',       label: 'Valor (% o $) — dejar en 0 si es promo por cantidad', type: 'number' },
        { key: 'aplica_a',    label: 'Aplica a', type: 'select', required: true, options: OPCIONES_APLICA },
        { key: 'tope_monto',  label: 'Tope máximo en $ (opcional)', type: 'number' },
        // ── Solo para promo por cantidad (2x1, 3x2…) ──
        { key: 'nx_lleva',    label: 'Promo por cantidad: LLEVA', type: 'number' },
        { key: 'nx_paga',     label: 'Promo por cantidad: PAGA', type: 'number' },
        { key: 'id_servicio', label: 'Promo sobre este servicio', type: 'select', options: opcionesServicio },
        { key: 'id_producto', label: 'Promo sobre este producto', type: 'select', options: opcionesProducto },
        // ── Solo para cupones ──
        { key: 'codigo',      label: 'Código de cupón (si se deja vacío, aparece en la lista del POS)' },
        { key: 'max_usos',    label: 'Máximo de usos del cupón (vacío = ilimitado)', type: 'number' },
        { key: 'fecha_desde', label: 'Vigente desde (opcional)', type: 'date' },
        { key: 'fecha_hasta', label: 'Vigente hasta (opcional)', type: 'date' },
        { key: 'id_empresa',  label: 'Empresa', type: 'select', required: true, options: opcionesEmpresa },
        { key: 'activo',      label: 'Activo', type: 'checkbox' },
      ]}
    />
  )
}
