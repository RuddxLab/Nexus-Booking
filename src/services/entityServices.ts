import { createCrudService } from './crudFactory'
import type { Cliente, Prestador, Servicio, Sucursal, Categoria, TipoCategoria, Empresa } from '../types'

export const clientesService        = createCrudService<Cliente>('clientes', 'id_cliente')
export const prestadoresService     = createCrudService<Prestador>('prestadores', 'id_prestador')
export const serviciosService       = createCrudService<Servicio>('servicios', 'id_servicio')
export const sucursalesService      = createCrudService<Sucursal>('sucursales', 'id_sucursal')
export const categoriasService      = createCrudService<Categoria>('categorias', 'id_categoria')
export const tipoCategoriasService  = createCrudService<TipoCategoria>('tipo_categorias', 'id_tipocategoria')
export const empresasService        = createCrudService<Empresa>('empresas', 'id_empresa')

// Funciones de lectura pública (para el flujo de reserva online)
import { supabase } from './supabaseClient'

export async function listPrestadoresPublico(idEmpresa?: number) {
  let q = supabase.from('v_prestadores_publico').select('*')
  if (idEmpresa) q = q.eq('id_empresa', idEmpresa) as any
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function listServiciosPublico(idEmpresa: number) {
  const { data, error } = await supabase
    .from('servicios').select('*')
    .eq('id_empresa', idEmpresa).eq('activo', true).order('nombre_servicio')
  if (error) throw error
  return data ?? []
}

export async function listCategoriasPublico(idEmpresa: number) {
  const { data, error } = await supabase
    .from('categorias').select('*')
    .eq('id_empresa', idEmpresa).eq('activo', true).order('nombre_categoria')
  if (error) throw error
  return data ?? []
}
