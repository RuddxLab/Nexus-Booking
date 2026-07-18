import { supabase } from './supabaseClient'

/**
 * Servicio de la relación N–N prestador ↔ sucursal (tabla puente
 * `prestador_sucursales`). Reemplaza a la antigua columna
 * prestadores.id_sucursal: un mismo prestador puede atender en varias
 * sucursales de su empresa. La seguridad real vive en RLS (solo
 * admin/supervisor de la empresa pueden gestionar).
 */

/** IDs de sucursal en las que el prestador está inscrito (activo). */
export async function listSucursalesDePrestador(idPrestador: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('prestador_sucursales')
    .select('id_sucursal')
    .eq('id_prestador', idPrestador)
    .eq('activo', true)
  if (error) throw error
  return (data ?? []).map((r: any) => r.id_sucursal)
}

/** IDs de prestador inscritos en una sucursal (activo). */
export async function listPrestadorIdsDeSucursal(idSucursal: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('prestador_sucursales')
    .select('id_prestador')
    .eq('id_sucursal', idSucursal)
    .eq('activo', true)
  if (error) throw error
  return (data ?? []).map((r: any) => r.id_prestador)
}

/** Inscribe (o reactiva) un prestador en una sucursal. Idempotente. */
export async function vincularPrestadorSucursal(
  idPrestador: number,
  idSucursal: number,
  idEmpresa: number,
): Promise<void> {
  const { error } = await supabase
    .from('prestador_sucursales')
    .upsert(
      { id_prestador: idPrestador, id_sucursal: idSucursal, id_empresa: idEmpresa, activo: true },
      { onConflict: 'id_prestador,id_sucursal' },
    )
  if (error) throw error
}

/** Da de baja la inscripción de un prestador en una sucursal. */
export async function desvincularPrestadorSucursal(
  idPrestador: number,
  idSucursal: number,
): Promise<void> {
  const { error } = await supabase
    .from('prestador_sucursales')
    .delete()
    .eq('id_prestador', idPrestador)
    .eq('id_sucursal', idSucursal)
  if (error) throw error
}
