import { supabase } from './supabaseClient'
import type { PrestadorHorario } from '../types'

export interface DiaHorarioForm {
  id_prestador_horario?: number
  dia: number
  activo: boolean
  hora_inicio: string
  hora_fin: string
}

/** Guarda un día de horario: actualiza si ya existía la fila, o la crea si no. */
export async function guardarDiaHorario(
  fila: DiaHorarioForm,
  contexto: { idPrestador: number; idEmpresa: number; idSucursal: number }
): Promise<void> {
  if (fila.id_prestador_horario) {
    const { error } = await supabase
      .from('prestador_horarios')
      .update({
        activo: fila.activo,
        hora_inicio: fila.activo ? fila.hora_inicio : null,
        hora_fin: fila.activo ? fila.hora_fin : null
      })
      .eq('id_prestador_horario', fila.id_prestador_horario)
    if (error) throw error
  } else {
    const { error } = await supabase.from('prestador_horarios').insert({
      id_prestador: contexto.idPrestador,
      id_empresa: contexto.idEmpresa,
      id_sucursal: contexto.idSucursal,
      dia: fila.dia,
      activo: fila.activo,
      hora_inicio: fila.activo ? fila.hora_inicio : null,
      hora_fin: fila.activo ? fila.hora_fin : null
    } as any)
    if (error) throw error
  }
}

export async function listHorariosPrestador(idPrestador: number): Promise<PrestadorHorario[]> {
  const { data, error } = await supabase
    .from('prestador_horarios')
    .select('*')
    .eq('id_prestador', idPrestador)
  if (error) throw error
  return (data ?? []) as PrestadorHorario[]
}
