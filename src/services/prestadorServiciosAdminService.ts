import { supabase } from './supabaseClient'

export async function vincularPrestadorServicio(
  idPrestador: number,
  idServicio: number,
  contexto: { idEmpresa: number; idSucursal: number }
): Promise<void> {
  const { error } = await supabase.from('prestador_servicios').insert({
    id_prestador: idPrestador,
    id_servicio: idServicio,
    id_empresa: contexto.idEmpresa,
    id_sucursal: contexto.idSucursal
  } as any)
  if (error) throw error
}

export async function desvincularPrestadorServicio(idPrestador: number, idServicio: number): Promise<void> {
  const { error } = await supabase
    .from('prestador_servicios')
    .delete()
    .eq('id_prestador', idPrestador)
    .eq('id_servicio', idServicio)
  if (error) throw error
}
