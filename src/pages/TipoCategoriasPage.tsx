import { CrudPage } from '../components/Common/CrudPage'
import { tipoCategoriasService } from '../services/entityServices'
import { useEmpresasSucursales } from '../hooks/useEmpresasSucursales'
import type { TipoCategoria } from '../types'

export function TipoCategoriasPage() {
  const { opcionesEmpresa, opcionesSucursal, nombreEmpresa } = useEmpresasSucursales()

  return (
    <CrudPage<TipoCategoria>
      titulo="Tipo de Categorías"
      idKey="id_tipocategoria"
      service={tipoCategoriasService}
      orderBy="nombre_tipo_categoria"
      sucursalPorFlagEmpresa
      busqueda={{ campos: ['nombre_tipo_categoria'], placeholder: 'Buscar tipo de categoría…' }}
      defaults={{ activo: true } as any}
      columnas={[
        { key: 'nombre_tipo_categoria', label: 'Nombre' },
        { key: 'id_empresa',            label: 'Empresa', render: r => nombreEmpresa(r.id_empresa) },
        { key: 'activo',                label: 'Activo',  render: r => r.activo ? 'Sí' : 'No' },
      ]}
      campos={[
        { key: 'nombre_tipo_categoria', label: 'Nombre',   required: true, ancho: 'completo' },
        { key: 'id_empresa',            label: 'Empresa',  type: 'select', required: true, options: opcionesEmpresa },
        { key: 'id_sucursal',           label: 'Sucursal', type: 'select', required: true, options: opcionesSucursal },
        { key: 'activo',                label: 'Activo',   type: 'checkbox' },
      ]}
    />
  )
}
