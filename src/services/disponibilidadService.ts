import { supabase } from './supabaseClient'
import type { PrestadorHorario, PrestadorAusencia } from '../types'

const EXCLUSION_VIOLATION = '23P01'

export class DobleReservaError extends Error {
  constructor() {
    super('Ese prestador ya tiene una cita en ese horario.')
    this.name = 'DobleReservaError'
  }
}

// Todas estas lecturas van por RPC con id_empresa obligatorio. Antes leían la
// tabla directo y el filtro por empresa lo ponía el cliente, así que con la
// anon key se podían enumerar horarios y ausencias de cualquier tenant.

export async function listHorariosPrestador(
  idPrestador: number, idEmpresa: number,
): Promise<PrestadorHorario[]> {
  const { data, error } = await supabase.rpc('horarios_publico', {
    p_id_empresa: idEmpresa,
    p_ids_prestadores: [idPrestador],
  })
  if (error) throw error
  return (data ?? []) as PrestadorHorario[]
}

export async function listAusenciasPrestador(
  idPrestador: number, idEmpresa: number,
): Promise<PrestadorAusencia[]> {
  const { data, error } = await supabase.rpc('ausencias_publico', {
    p_id_empresa: idEmpresa,
    p_id_prestador: idPrestador,
  })
  if (error) throw error
  return (data ?? []) as PrestadorAusencia[]
}

export async function listHorasOcupadas(
  idPrestador: number,
  fecha: string,
  idEmpresa: number,
): Promise<{ hora_inicio: string; hora_fin: string }[]> {
  // RLS bloquea el SELECT anónimo sobre agendamientos (devolvería 0 filas en
  // silencio y el calendario ofrecería horas ya tomadas). La función expone
  // SOLO hora_inicio/hora_fin, y ahora valida que el prestador sea de la empresa.
  const { data, error } = await supabase.rpc('horas_ocupadas_publico', {
    p_id_prestador: idPrestador,
    p_fecha:        fecha,
    p_id_empresa:   idEmpresa,
  })
  if (error) throw error
  return (data ?? []) as { hora_inicio: string; hora_fin: string }[]
}

export async function listPrestadorIdsDeServicio(
  idServicio: number, idEmpresa: number,
): Promise<number[]> {
  const { data, error } = await supabase.rpc('prestador_servicios_publico', {
    p_id_empresa: idEmpresa,
    p_id_servicio: idServicio,
  })
  if (error) throw error
  return (data ?? []).map((r: any) => r.id_prestador as number)
}

export interface DatosReservaPublica {
  idEmpresa: number
  idSucursal: number
  idPrestador: number
  idServicio: number
  fecha: string
  horaInicio: string
  nombreCliente: string
  telefono: string
  email: string
  rut?: string | null
}

export interface ResultadoReserva {
  id: number
  token: string
  /** true si la reserva ya existía (reintento del mismo cliente) */
  yaExistia: boolean
}

/** Crea una reserva pública y devuelve { id, token } */
export async function crearReservaPublica(datos: DatosReservaPublica): Promise<ResultadoReserva> {
  const { data, error } = await supabase.rpc('crear_reserva_publica', {
    p_id_empresa:     datos.idEmpresa,
    p_id_sucursal:    datos.idSucursal,
    p_id_prestador:   datos.idPrestador,
    p_id_servicio:    datos.idServicio,
    p_fecha:          datos.fecha,
    p_hora_inicio:    datos.horaInicio,
    p_nombre_cliente: datos.nombreCliente,
    p_telefono:       datos.telefono,
    p_email:          datos.email,
    p_rut:            datos.rut ?? null
  })
  if (error) {
    if (error.code === EXCLUSION_VIOLATION) throw new DobleReservaError()
    throw error
  }
  // La RPC retorna JSON: { id, token, ya_existia }
  const row = data as { id: number; token: string; ya_existia?: boolean }
  return { id: Number(row.id), token: row.token ?? '', yaExistia: !!row.ya_existia }
}

/** Obtiene el email del prestador (vía función SECURITY DEFINER). */
export async function obtenerEmailPrestador(idPrestador: number): Promise<string | null> {
  const { data, error } = await supabase.rpc('email_prestador', { p_id_prestador: idPrestador })
  if (error) return null
  return data as string | null
}

/** Horarios de múltiples prestadores en una sola query */
export async function listHorariosPorPrestadores(
  idsPrestadores: number[], idEmpresa: number,
): Promise<PrestadorHorario[]> {
  if (idsPrestadores.length === 0) return []
  const { data, error } = await supabase.rpc('horarios_publico', {
    p_id_empresa: idEmpresa,
    p_ids_prestadores: idsPrestadores,
  })
  if (error) throw error
  return (data ?? []) as PrestadorHorario[]
}
