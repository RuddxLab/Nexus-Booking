import { supabase } from './supabaseClient'
import type { PrestadorAusencia, DiaBloqueado } from '../types'

// ── Ausencias recurrentes ─────────────────────────────────────────────────────

export async function listAusencias(idPrestador: number): Promise<PrestadorAusencia[]> {
  const { data, error } = await supabase
    .from('prestador_ausencias')
    .select('*')
    .eq('id_prestador', idPrestador)
    .order('dia')
  if (error) throw error
  return (data ?? []) as PrestadorAusencia[]
}

export async function crearAusencia(payload: Partial<PrestadorAusencia>): Promise<PrestadorAusencia> {
  const { data, error } = await supabase
    .from('prestador_ausencias')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as PrestadorAusencia
}

export async function eliminarAusencia(id: number): Promise<void> {
  const { error } = await supabase
    .from('prestador_ausencias')
    .delete()
    .eq('id_prestador_ausencia', id)
  if (error) throw error
}

// ── Días bloqueados ───────────────────────────────────────────────────────────

export async function listDiasBloqueados(idEmpresa: number): Promise<DiaBloqueado[]> {
  const { data, error } = await supabase
    .from('dias_bloqueados')
    .select('*')
    .eq('id_empresa', idEmpresa)
    .order('fecha', { ascending: true })
  if (error) throw error
  return (data ?? []) as DiaBloqueado[]
}

export async function crearDiaBloqueado(
  payload: Partial<DiaBloqueado>,
  idEmpresa: number,
  idSucursal: number
): Promise<DiaBloqueado> {
  const { data, error } = await supabase
    .from('dias_bloqueados')
    .insert({ ...payload, id_empresa: idEmpresa, id_sucursal: idSucursal })
    .select()
    .single()
  if (error) throw error
  return data as DiaBloqueado
}

export async function actualizarDiaBloqueado(id: number, payload: Partial<DiaBloqueado>): Promise<DiaBloqueado> {
  const { data, error } = await supabase
    .from('dias_bloqueados')
    .update(payload)
    .eq('id_dia_bloqueado', id)
    .select()
    .single()
  if (error) throw error
  return data as DiaBloqueado
}

export async function eliminarDiaBloqueado(id: number): Promise<void> {
  const { error } = await supabase
    .from('dias_bloqueados')
    .delete()
    .eq('id_dia_bloqueado', id)
  if (error) throw error
}

// ── Consultas para el calendario ─────────────────────────────────────────────

/** Días bloqueados en un rango de fechas, opcionalmente filtrados por prestador */
export async function listDiasBloqueadosPorRango(
  desde: string,
  hasta: string,
  idPrestador?: number | null
): Promise<DiaBloqueado[]> {
  let q = supabase
    .from('dias_bloqueados')
    .select('*')
    .gte('fecha', desde)
    .lte('fecha', hasta)

  if (idPrestador) {
    q = q.or(`id_prestador.is.null,id_prestador.eq.${idPrestador}`)
  }

  const { data, error } = await q.order('fecha')
  if (error) throw error
  return (data ?? []) as DiaBloqueado[]
}

/** Ausencias recurrentes de uno o varios prestadores */
export async function listAusenciasPorPrestadores(
  idsPrestadores: number[]
): Promise<PrestadorAusencia[]> {
  if (idsPrestadores.length === 0) return []
  const { data, error } = await supabase
    .from('prestador_ausencias')
    .select('*')
    .in('id_prestador', idsPrestadores)
  if (error) throw error
  return (data ?? []) as PrestadorAusencia[]
}
