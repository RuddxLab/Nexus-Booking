import { createCrudService } from './crudFactory'
import type { Cliente, Prestador, Servicio, Sucursal, Categoria, TipoCategoria, Empresa, Producto, PrestadorPublico, ServicioPublico } from '../types'

export const clientesService        = createCrudService<Cliente>('clientes', 'id_cliente')
export const productosService       = createCrudService<Producto>('productos', 'id_producto')
export const prestadoresService     = createCrudService<Prestador>('prestadores', 'id_prestador')
export const serviciosService       = createCrudService<Servicio>('servicios', 'id_servicio')
export const sucursalesService      = createCrudService<Sucursal>('sucursales', 'id_sucursal')
export const categoriasService      = createCrudService<Categoria>('categorias', 'id_categoria')
export const tipoCategoriasService  = createCrudService<TipoCategoria>('tipo_categorias', 'id_tipocategoria')
export const empresasService        = createCrudService<Empresa>('empresas', 'id_empresa')

// Funciones de lectura pública (para el flujo de reserva online)
import { supabase } from './supabaseClient'

// Lecturas del catálogo público.
//
// Van por RPC y no por vista/tabla a propósito: el filtro por empresa tiene que
// ocurrir en el servidor. Con `.from(vista).eq('id_empresa', X)` el filtro es
// del cliente, así que cualquiera con la anon key (que es pública) podía pedir
// el catálogo de TODAS las empresas de una sola vez.

export async function listPrestadoresPublico(idEmpresa: number): Promise<PrestadorPublico[]> {
  const { data, error } = await supabase.rpc('prestadores_publico', { p_id_empresa: idEmpresa })
  if (error) throw error
  return (data ?? []) as PrestadorPublico[]
}

export async function listServiciosPublico(idEmpresa: number): Promise<ServicioPublico[]> {
  const { data, error } = await supabase.rpc('servicios_publico', { p_id_empresa: idEmpresa })
  if (error) throw error
  return ((data ?? []) as ServicioPublico[])
    .sort((a, b) => a.nombre_servicio.localeCompare(b.nombre_servicio, 'es'))
}

export async function listCategoriasPublico(idEmpresa: number): Promise<Categoria[]> {
  const { data, error } = await supabase.rpc('categorias_publico', { p_id_empresa: idEmpresa })
  if (error) throw error
  return ((data ?? []) as Categoria[])
    .sort((a, b) => a.nombre_categoria.localeCompare(b.nombre_categoria, 'es'))
}
