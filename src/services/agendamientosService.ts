import { supabase } from './supabaseClient'
import type { Agendamiento } from '../types'

// Código de error de Postgres cuando se viola una restricción EXCLUDE
// (usado aquí para bloquear el doble-agendamiento del mismo prestador).
const EXCLUSION_VIOLATION = '23P01'

export class DobleReservaError extends Error {
  constructor() {
    super('Ese prestador ya tiene una cita en ese horario.')
    this.name = 'DobleReservaError'
  }
}

export async function listAgendamientosPorRango(
  fechaInicio: string,
  fechaFin: string,
  idPrestador?: number | null,
  idEmpresa?: number | null
): Promise<Agendamiento[]> {
  // Si viene idPrestador (vista admin filtrando por prestador), usar función SECURITY DEFINER
  // que salta RLS y trae SOLO las citas de ese prestador
  if (idPrestador) {
    const { data, error } = await supabase.rpc('agendamientos_por_prestador', {
      p_id_prestador: idPrestador,
      p_fecha_inicio:  fechaInicio,
      p_fecha_fin:     fechaFin,
    })
    if (error) throw error
    return ((data ?? []) as any[]).map(r => ({
      ...r,
      servicios: r.nombre_servicio ? { nombre_servicio: r.nombre_servicio, duracion: r.duracion } : null
    })) as Agendamiento[]
  }

  // Sin filtro de prestador: RLS filtra por empresa del usuario autenticado.
  // idEmpresa se agrega como defensa adicional en frontend.
  let query = supabase
    .from('agendamientos')
    .select('*, servicios(nombre_servicio, duracion)')
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true })

  if (idEmpresa) query = query.eq('id_empresa', idEmpresa) as any

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Agendamiento[]
}

export async function crearAgendamiento(payload: Partial<Agendamiento>): Promise<Agendamiento> {
  const { data, error } = await supabase.from('agendamientos').insert(payload as any).select().single()

  if (error) {
    if (error.code === EXCLUSION_VIOLATION) throw new DobleReservaError()
    throw error
  }
  return data as Agendamiento
}

export async function actualizarAgendamiento(
  id: number,
  payload: Partial<Agendamiento>
): Promise<Agendamiento> {
  const { data, error } = await supabase
    .from('agendamientos')
    .update(payload as any)
    .eq('id_agendamiento', id)
    .select()
    .single()

  if (error) {
    if (error.code === EXCLUSION_VIOLATION) throw new DobleReservaError()
    throw error
  }
  return data as Agendamiento
}

export async function cancelarAgendamiento(id: number): Promise<Agendamiento> {
  return actualizarAgendamiento(id, { estado: 'CANCELADA' })
}
