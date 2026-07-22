import { useEffect, useState } from 'react'
import { CrudPage } from '../components/Common/CrudPage'
import { productosService } from '../services/entityServices'
import { useEmpresasSucursales } from '../hooks/useEmpresasSucursales'
import { useUserRole } from '../hooks/useUserRole'
import { supabase } from '../services/supabaseClient'
import type { Producto } from '../types'

/**
 * Catálogo de productos. Se rige por el mismo flag `catalogo_por_sucursal`
 * de la empresa que los servicios, así que reusa `sucursalPorFlagEmpresa`.
 *
 * Las categorías se filtran por el código del tipo de categoría (PROD),
 * no por su nombre: así renombrar "Producto" no rompe nada.
 */
export function ProductosPage() {
  const { idEmpresa } = useUserRole()
  const { nombreEmpresa, opcionesEmpresa, opcionesSucursal } = useEmpresasSucursales()
  const [opcionesCatProducto, setOpcionesCatProducto] = useState<{ value: number; label: string }[]>([])

  useEffect(() => {
    if (!idEmpresa) return
    let vivo = true
    const cargar = async () => {
      // 1 · tipos de categoría marcados como catálogo de productos
      const { data: tipos } = await supabase
        .from('tipo_categorias')
        .select('id_tipocategoria')
        .eq('id_empresa', idEmpresa)
        .eq('codigo', 'PROD')
      const ids = (tipos ?? []).map(t => t.id_tipocategoria)
      if (!vivo || ids.length === 0) { if (vivo) setOpcionesCatProducto([]); return }

      // 2 · categorías que cuelgan de esos tipos
      const { data: cats } = await supabase
        .from('categorias')
        .select('id_categoria, nombre_categoria')
        .eq('id_empresa', idEmpresa)
        .eq('activo', true)
        .in('id_tipocategoria', ids)
        .order('nombre_categoria')
      if (vivo) {
        setOpcionesCatProducto((cats ?? []).map(c => ({ value: c.id_categoria, label: c.nombre_categoria })))
      }
    }
    cargar()
    return () => { vivo = false }
  }, [idEmpresa])

  const money = (n: number | null) => `$${Number(n ?? 0).toLocaleString('es-CL')}`

  return (
    <CrudPage<Producto>
      titulo="Productos"
      idKey="id_producto"
      service={productosService}
      orderBy="nombre"
      sucursalPorFlagEmpresa
      busqueda={{ campos: ['nombre', 'sku'], placeholder: 'Buscar producto o SKU…' }}
      defaults={{ activo: true, precio_venta: 0, maneja_iva: true, maneja_stock: true } as any}
      columnas={[
        { key: 'nombre',        label: 'Producto' },
        { key: 'sku',           label: 'SKU',      render: r => r.sku || '—' },
        { key: 'precio_venta',  label: 'Precio neto', render: r => money(r.precio_venta) },
        { key: 'maneja_iva',    label: 'IVA',      render: r => (r.maneja_iva ? 'Con IVA' : 'Sin IVA') },
        { key: 'costo_promedio',label: 'Costo prom.', render: r => money(r.costo_promedio) },
        { key: 'maneja_stock',  label: 'Stock',    render: r => (r.maneja_stock ? 'Controla' : 'No controla') },
        { key: 'id_empresa',    label: 'Empresa',  render: r => nombreEmpresa(r.id_empresa) },
        { key: 'activo',        label: 'Activo',   render: r => (r.activo ? 'Sí' : 'No') },
      ]}
      campos={[
        { key: 'nombre',       label: 'Nombre del producto', required: true, ancho: 'completo' },
        { key: 'sku',          label: 'SKU / código' },
        { key: 'descripcion',  label: 'Descripción', ancho: 'completo' },
        {
          key: 'id_categoria',
          // Opcional a propósito: si la empresa aún no creó categorías de tipo
          // "Producto", igual debe poder cargar su catálogo.
          label: opcionesCatProducto.length
            ? 'Categoría'
            : 'Categoría (crea antes una categoría de tipo Producto)',
          type: 'select',
          options: opcionesCatProducto,
        },
        { key: 'precio_venta', label: 'Precio neto, sin IVA ($)', type: 'number', required: true },
        { key: 'maneja_iva',   label: 'Afecto a IVA (19%)', type: 'checkbox' },
        { key: 'maneja_stock', label: 'Controlar stock',    type: 'checkbox' },
        { key: 'id_empresa',   label: 'Empresa',  type: 'select', required: true, options: opcionesEmpresa },
        { key: 'id_sucursal',  label: 'Sucursal', type: 'select', required: true, options: opcionesSucursal },
        { key: 'activo',       label: 'Activo',   type: 'checkbox' },
      ]}
    />
  )
}
