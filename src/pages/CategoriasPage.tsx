import { CrudPage } from '../components/Common/CrudPage'
import { categoriasService } from '../services/entityServices'
import { useEmpresasSucursales } from '../hooks/useEmpresasSucursales'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import { supabase } from '../services/supabaseClient'
import { useEffect, useState } from 'react'
import type { Categoria, TipoCategoria } from '../types'

export function CategoriasPage() {
  // Usar empresaId del filtro activo (no el del rol del usuario)
  const { empresaId } = useFiltroEmpresa()
  const { opcionesEmpresa, opcionesSucursal, nombreEmpresa } = useEmpresasSucursales()
  const [tiposCat, setTiposCat] = useState<TipoCategoria[]>([])

  // Recargar tipos cuando cambia la empresa seleccionada en el filtro
  useEffect(() => {
    if (!empresaId) return
    supabase.from('tipo_categorias').select('*')
      .eq('id_empresa', empresaId).eq('activo', true).order('nombre_tipo_categoria')
      .then(({ data }) => setTiposCat((data ?? []) as TipoCategoria[]))
  }, [empresaId])

  const opcionesTipo = tiposCat.map(t => ({ value: t.id_tipocategoria, label: t.nombre_tipo_categoria }))
  const nombreTipo   = (id: number) => tiposCat.find(t => t.id_tipocategoria === id)?.nombre_tipo_categoria ?? String(id)

  return (
    <CrudPage<Categoria>
      titulo="Categorías"
      idKey="id_categoria"
      service={categoriasService}
      orderBy="nombre_categoria"
      sucursalPorFlagEmpresa
      busqueda={{ campos: ['nombre_categoria'], placeholder: 'Buscar categoría…' }}
      defaults={{ activo: true } as any}
      columnas={[
        { key: 'nombre_categoria', label: 'Nombre' },
        { key: 'id_tipocategoria', label: 'Tipo',    render: r => nombreTipo(r.id_tipocategoria) },
        { key: 'id_empresa',       label: 'Empresa', render: r => nombreEmpresa(r.id_empresa) },
        { key: 'activo',           label: 'Activo',  render: r => r.activo ? 'Sí' : 'No' },
      ]}
      campos={[
        { key: 'nombre_categoria', label: 'Nombre',            required: true, ancho: 'completo' },
        { key: 'id_tipocategoria', label: 'Tipo de categoría', type: 'select', required: true, options: opcionesTipo },
        { key: 'id_empresa',       label: 'Empresa',           type: 'select', required: true, options: opcionesEmpresa },
        { key: 'id_sucursal',      label: 'Sucursal',          type: 'select', required: true, options: opcionesSucursal },
        { key: 'activo',           label: 'Activo',            type: 'checkbox' },
      ]}
    />
  )
}
