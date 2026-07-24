import { supabase } from './supabaseClient'

export interface ComisionPendiente {
  id_prestador:   number
  nombre_prestador: string
  cantidad_items: number
  total_comision: number
}

export interface Liquidacion {
  id_liquidacion:  number
  id_empresa:      number
  id_prestador:    number
  nombre_prestador: string
  fecha_desde:     string
  fecha_hasta:     string
  total_comision:  number
  cantidad_items:  number
  estado:          'GENERADA' | 'ANULADA'
  fecha_creacion:  string
}

/** Comisiones aún no liquidadas, agrupadas por prestador, en el rango. */
export async function previsualizarComisiones(
  idEmpresa: number, desde: string, hasta: string, idPrestador?: number | null,
): Promise<ComisionPendiente[]> {
  const { data, error } = await supabase.rpc('previsualizar_comisiones', {
    p_id_empresa: idEmpresa, p_desde: desde, p_hasta: hasta,
    p_id_prestador: idPrestador ?? null,
  })
  if (error) throw error
  return (data ?? []) as ComisionPendiente[]
}

/** Genera la liquidación de un prestador en el rango (bloquea reliquidar). */
export async function generarLiquidacion(
  idEmpresa: number, idPrestador: number, desde: string, hasta: string,
): Promise<{ id_liquidacion: number; total_comision: number; cantidad_items: number }> {
  const { data, error } = await supabase.rpc('generar_liquidacion', {
    p_id_empresa: idEmpresa, p_id_prestador: idPrestador, p_desde: desde, p_hasta: hasta,
  })
  if (error) throw error
  return data
}

/** Revierte (anula) una liquidación: libera sus ítems. Admin y supervisor. */
export async function revertirLiquidacion(idLiquidacion: number): Promise<void> {
  const { error } = await supabase.rpc('revertir_liquidacion', { p_id_liquidacion: idLiquidacion })
  if (error) throw error
}

/** Historial de liquidaciones de la empresa. */
export async function listLiquidaciones(idEmpresa: number, limite = 50): Promise<Liquidacion[]> {
  const { data, error } = await supabase
    .from('liquidaciones')
    .select('id_liquidacion, id_empresa, id_prestador, fecha_desde, fecha_hasta, total_comision, cantidad_items, estado, fecha_creacion, prestadores(nombre_prestador)')
    .eq('id_empresa', idEmpresa)
    .order('id_liquidacion', { ascending: false })
    .limit(limite)
  if (error) throw error
  return (data ?? []).map((l: any) => ({
    id_liquidacion: l.id_liquidacion,
    id_empresa:     l.id_empresa,
    id_prestador:   l.id_prestador,
    nombre_prestador: l.prestadores?.nombre_prestador ?? '—',
    fecha_desde:    l.fecha_desde,
    fecha_hasta:    l.fecha_hasta,
    total_comision: Number(l.total_comision),
    cantidad_items: l.cantidad_items,
    estado:         l.estado,
    fecha_creacion: l.fecha_creacion,
  })) as Liquidacion[]
}

export interface PrestadorOpcion { id_prestador: number; nombre_prestador: string }

export async function listPrestadoresEmpresa(idEmpresa: number): Promise<PrestadorOpcion[]> {
  const { data } = await supabase
    .from('prestadores')
    .select('id_prestador, nombre_prestador')
    .eq('id_empresa', idEmpresa)
    .eq('activo', true)
    .order('nombre_prestador')
  return (data ?? []) as PrestadorOpcion[]
}
