import { supabase } from './supabaseClient'

export interface CajaAbierta {
  id_caja:        number
  id_empresa:     number
  id_sucursal:    number
  id_usuario:     string
  estado:         'ABIERTA' | 'CERRADA'
  monto_apertura: number
  fecha_apertura: string
  observacion_apertura: string | null
}

export interface TotalesCierre {
  monto_apertura:    number
  total_ventas:      number
  cantidad_ventas:   number
  por_medio:         Record<string, number>
  efectivo_esperado: number
}

export interface ResultadoCierre extends TotalesCierre {
  id_caja:    number
  estado:     'CERRADA'
  id_empresa: number
}

/** ¿La sucursal tiene activado el control de caja? */
export async function sucursalUsaCaja(idSucursal: number): Promise<boolean> {
  const { data } = await supabase
    .from('sucursales').select('usa_caja').eq('id_sucursal', idSucursal).maybeSingle()
  return !!data?.usa_caja
}

/** Caja abierta del usuario actual en la empresa/sucursal indicada (o null). */
export async function getCajaAbierta(idEmpresa: number, idSucursal: number): Promise<CajaAbierta | null> {
  const { data: sess } = await supabase.auth.getUser()
  const uid = sess.user?.id
  if (!uid) return null
  const { data } = await supabase
    .from('cajas')
    .select('id_caja, id_empresa, id_sucursal, id_usuario, estado, monto_apertura, fecha_apertura, observacion_apertura')
    .eq('id_empresa', idEmpresa)
    .eq('id_sucursal', idSucursal)
    .eq('id_usuario', uid)
    .eq('estado', 'ABIERTA')
    .maybeSingle()
  return (data ?? null) as CajaAbierta | null
}

/** ¿El usuario actual tiene ALGUNA caja abierta (en cualquier sucursal)? */
export async function getCualquierCajaAbierta(): Promise<CajaAbierta | null> {
  const { data: sess } = await supabase.auth.getUser()
  const uid = sess.user?.id
  if (!uid) return null
  const { data } = await supabase
    .from('cajas')
    .select('id_caja, id_empresa, id_sucursal, id_usuario, estado, monto_apertura, fecha_apertura, observacion_apertura')
    .eq('id_usuario', uid)
    .eq('estado', 'ABIERTA')
    .maybeSingle()
  return (data ?? null) as CajaAbierta | null
}

export async function abrirCaja(
  idEmpresa: number, idSucursal: number, montoApertura: number, observacion?: string | null,
): Promise<{ id_caja: number; estado: string; monto_apertura: number }> {
  const { data, error } = await supabase.rpc('abrir_caja', {
    p_id_empresa: idEmpresa,
    p_id_sucursal: idSucursal,
    p_monto_apertura: Math.round(montoApertura || 0),
    p_observacion: observacion ?? null,
  })
  if (error) throw error
  return data
}

export async function cerrarCaja(idCaja: number, observacion?: string | null): Promise<ResultadoCierre> {
  const { data, error } = await supabase.rpc('cerrar_caja', {
    p_id_caja: idCaja,
    p_observacion: observacion ?? null,
  })
  if (error) throw error
  return data as ResultadoCierre
}

export interface CajaHistorial {
  id_caja:        number
  id_sucursal:    number
  estado:         'ABIERTA' | 'CERRADA'
  monto_apertura: number
  fecha_apertura: string
  fecha_cierre:   string | null
  totales_cierre: TotalesCierre | null
}

/** Últimas cajas de la empresa/sucursal (para el historial). */
export async function listCajas(idEmpresa: number, idSucursal: number | null, limite = 20): Promise<CajaHistorial[]> {
  let q = supabase
    .from('cajas')
    .select('id_caja, id_sucursal, estado, monto_apertura, fecha_apertura, fecha_cierre, totales_cierre')
    .eq('id_empresa', idEmpresa)
    .order('id_caja', { ascending: false })
    .limit(limite)
  if (idSucursal) q = q.eq('id_sucursal', idSucursal) as any
  const { data } = await q
  return (data ?? []) as CajaHistorial[]
}
