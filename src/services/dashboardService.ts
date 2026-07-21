import { supabase } from './supabaseClient'

// ── Tipos del RPC dashboard_resumen ───────────────────────────────────────────
export interface DashKpis {
  agendamientos:   number
  agendadas:       number
  canceladas:      number
  ingresos:        number
  ticket_promedio: number
  tasa_cancelacion:number
  clientes:        number
  nuevos:          number
  recurrentes:     number
}
export interface SeriePunto   { fecha: string; agendadas: number; canceladas: number }
export interface PorPrestador { id: number; nombre: string; agendadas: number; ingresos: number }
export interface PorSucursal  { id: number; nombre: string; agendamientos: number; agendadas: number; canceladas: number; ingresos: number }
export interface PorServicio  { id: number; nombre: string; cantidad: number; ingresos: number }
export interface PorEmpresa   { id: number; nombre: string; agendadas: number; ingresos: number }
export interface HeatCelda    { dow: number; hora: number; n: number }
export interface Proximo      { nombre_cliente: string; servicio: string | null; prestador: string | null; sucursal: string | null; fecha: string; hora_inicio: string; estado: string }

export interface DashboardResumen {
  empresas_visibles: number
  kpis:          DashKpis
  serie:         SeriePunto[]
  por_prestador: PorPrestador[]
  por_sucursal:  PorSucursal[]
  por_servicio:  PorServicio[]
  por_empresa:   PorEmpresa[]
  heatmap:       HeatCelda[]
  proximos:      Proximo[]
}

/**
 * Trae el resumen del panel. TODO el filtrado de empresa ocurre en el RPC
 * (SECURITY DEFINER + usuario_tiene_rol con auth.uid()); el cliente no puede
 * ver empresas donde no tiene rol admin/supervisor, aunque pase otro id.
 */
export async function getDashboardResumen(
  desde: string,
  hasta: string,
  idEmpresa: number | null,   // null = consolidado (todas las del usuario)
): Promise<DashboardResumen> {
  const { data, error } = await supabase.rpc('dashboard_resumen', {
    p_desde: desde,
    p_hasta: hasta,
    p_id_empresa: idEmpresa,
  })
  if (error) throw error
  return data as DashboardResumen
}
