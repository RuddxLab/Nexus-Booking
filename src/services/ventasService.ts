import { supabase } from './supabaseClient'

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type TipoLinea = 'SERVICIO' | 'PRODUCTO'
export type MedioPago = 'EFECTIVO' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA' | 'OTRO'

/** Línea que se está armando en pantalla (aún no emitida). */
export interface LineaVenta {
  uid:            string          // clave local para React
  tipo:           TipoLinea
  id_servicio?:   number
  id_producto?:   number
  id_agendamiento?: number
  id_prestador?:  number
  nombre_prestador?: string
  descripcion:    string
  cantidad:       number
  precio_unitario_neto: number
  descuento:      number
  aplica_iva:     boolean
}

export interface PagoInput {
  medio:            MedioPago
  monto:            number
  referencia?:      string
  ajuste_redondeo?: number
}

export interface ResultadoVenta {
  id_venta:  number
  numero:    number
  neto:      number
  iva:       number
  total:     number
  descuento: number
  tasa_iva:  number
}

export interface AgendaPendiente {
  id_agendamiento: number
  id_servicio:     number
  id_prestador:    number
  nombre_cliente:  string
  fecha:           string
  hora_inicio:     string
  nombre_servicio: string
  valor:           number
  maneja_iva:      number
  nombre_prestador: string
}

export interface VentaResumen {
  id_venta:    number
  numero:      number | null
  fecha:       string
  estado:      string
  neto:        number
  iva:         number
  total:       number
  nombre_receptor: string | null
}

// ── Lectura ───────────────────────────────────────────────────────────────────

/**
 * Citas del día indicado que aún no se han cobrado.
 * RLS acota por empresa; la sucursal es filtro operativo.
 */
export async function listAgendaPendiente(
  idEmpresa: number, idSucursal: number | null, fecha: string,
): Promise<AgendaPendiente[]> {
  let q = supabase
    .from('agendamientos')
    .select('id_agendamiento, id_servicio, id_prestador, nombre_cliente, fecha, hora_inicio, servicios(nombre_servicio, valor, maneja_iva), prestadores(nombre_prestador)')
    .eq('id_empresa', idEmpresa)
    .eq('estado', 'AGENDADA')
    .eq('estado_pago', 'PENDIENTE')
    .eq('fecha', fecha)
    .order('hora_inicio', { ascending: true })
    .limit(50)
  if (idSucursal) q = q.eq('id_sucursal', idSucursal) as any

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((a: any) => ({
    id_agendamiento: a.id_agendamiento,
    id_servicio:     a.id_servicio,
    id_prestador:    a.id_prestador,
    nombre_cliente:  a.nombre_cliente,
    fecha:           a.fecha,
    hora_inicio:     a.hora_inicio,
    nombre_servicio: a.servicios?.nombre_servicio ?? 'Servicio',
    valor:           Number(a.servicios?.valor ?? 0),
    maneja_iva:      Number(a.servicios?.maneja_iva ?? 0),
    nombre_prestador: a.prestadores?.nombre_prestador ?? '—',
  }))
}

export async function listVentasRecientes(
  idEmpresa: number, idSucursal: number | null, fecha: string, limite = 30,
): Promise<VentaResumen[]> {
  let q = supabase
    .from('ventas')
    .select('id_venta, numero, fecha, estado, neto, iva, total, nombre_receptor')
    .eq('id_empresa', idEmpresa)
    .neq('estado', 'BORRADOR')
    .eq('fecha', fecha)
    .order('id_venta', { ascending: false })
    .limit(limite)
  if (idSucursal) q = q.eq('id_sucursal', idSucursal) as any
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as VentaResumen[]
}

// ── Búsqueda de clientes (para asociar la venta a un cliente existente) ───────
export interface ClienteBusqueda {
  id_cliente:     number
  nombre_cliente: string
  rut:            string | null
  email:          string | null
  telefono:       string | null
}

/** Busca clientes de la empresa por nombre, RUT, correo o teléfono. */
export async function buscarClientes(
  idEmpresa: number, texto: string,
): Promise<ClienteBusqueda[]> {
  // Se limpian comas y paréntesis: rompen la sintaxis del filtro .or() de PostgREST.
  const t = texto.trim().replace(/[(),]/g, '')
  if (t.length < 2) return []
  const patron = `%${t}%`
  const { data, error } = await supabase
    .from('clientes')
    .select('id_cliente, nombre_cliente, rut, email, telefono')
    .eq('id_empresa', idEmpresa)
    .eq('activo', true)
    .or(`nombre_cliente.ilike.${patron},rut.ilike.${patron},email.ilike.${patron},telefono.ilike.${patron}`)
    .order('nombre_cliente')
    .limit(8)
  if (error) throw error
  return (data ?? []) as ClienteBusqueda[]
}

// ── Escritura (siempre vía RPC, nunca insert directo) ─────────────────────────

export async function emitirVenta(
  idEmpresa: number,
  idSucursal: number,
  lineas: LineaVenta[],
  opts: {
    idCliente?: number | null
    rutReceptor?: string | null
    nombreReceptor?: string | null
    pagos?: PagoInput[]
    observaciones?: string | null
    /** Descuento del catálogo. El servidor lo valida y lo reparte por línea. */
    idDescuento?: number | null
  } = {},
): Promise<ResultadoVenta> {
  const items = lineas.map(l => ({
    tipo: l.tipo,
    id_servicio: l.id_servicio ?? null,
    id_producto: l.id_producto ?? null,
    id_agendamiento: l.id_agendamiento ?? null,
    id_prestador: l.id_prestador ?? null,
    cantidad: l.cantidad,
    descuento: l.descuento || 0,
    // Si el usuario editó el precio en pantalla, se respeta; si no, manda el catálogo.
    precio_unitario_neto: l.precio_unitario_neto,
  }))

  const { data, error } = await supabase.rpc('emitir_venta', {
    p_id_empresa: idEmpresa,
    p_id_sucursal: idSucursal,
    p_items: items,
    p_id_cliente: opts.idCliente ?? null,
    p_rut_receptor: opts.rutReceptor ?? null,
    p_nombre_receptor: opts.nombreReceptor ?? null,
    p_pagos: opts.pagos ?? [],
    p_observaciones: opts.observaciones ?? null,
    p_id_descuento: opts.idDescuento ?? null,
  })
  if (error) throw error
  return data as ResultadoVenta
}

/** Descuentos vigentes de la empresa, para ofrecerlos en el punto de venta. */
export async function listDescuentosVigentes(idEmpresa: number, hoy: string) {
  const { data, error } = await supabase
    .from('descuentos')
    .select('id_descuento, nombre, tipo, valor, aplica_a, tope_monto')
    .eq('id_empresa', idEmpresa)
    .eq('activo', true)
    .or(`fecha_desde.is.null,fecha_desde.lte.${hoy}`)
    .or(`fecha_hasta.is.null,fecha_hasta.gte.${hoy}`)
    .order('nombre')
  if (error) throw error
  return (data ?? []) as {
    id_descuento: number; nombre: string
    tipo: 'PORCENTAJE' | 'MONTO'; valor: number
    aplica_a: 'TODO' | 'SERVICIOS' | 'PRODUCTOS'; tope_monto: number | null
  }[]
}

export async function anularVenta(idVenta: number, motivo?: string) {
  const { data, error } = await supabase.rpc('anular_venta', {
    p_id_venta: idVenta,
    p_motivo: motivo ?? null,
  })
  if (error) throw error
  return data
}

// ── Cálculo de totales (solo vista previa; el servidor es la autoridad) ───────

export interface DescuentoVigente {
  id_descuento: number; nombre: string
  tipo: 'PORCENTAJE' | 'MONTO'; valor: number
  aplica_a: 'TODO' | 'SERVICIOS' | 'PRODUCTOS'; tope_monto: number | null
}

/**
 * Vista previa de los totales. Replica paso a paso lo que hace emitir_venta
 * (incluido el reparto proporcional del descuento) para que lo que ve el
 * cajero coincida con lo que el servidor termina guardando.
 */
export function calcularTotales(
  lineas: LineaVenta[], tasaIva: number, reglaRedondeo: 'LINEA' | 'TOTAL',
  descuento?: DescuentoVigente | null,
) {
  const filas = lineas.map(l => ({
    aplica_iva: l.aplica_iva,
    tipo: l.tipo,
    neto: Math.round(l.precio_unitario_neto * l.cantidad - (l.descuento || 0)),
  }))

  const afecta = (f: { tipo: TipoLinea }) =>
    !descuento || descuento.aplica_a === 'TODO'
    || (descuento.aplica_a === 'SERVICIOS' && f.tipo === 'SERVICIO')
    || (descuento.aplica_a === 'PRODUCTOS' && f.tipo === 'PRODUCTO')

  let montoDesc = 0
  if (descuento) {
    const afectadas = filas.filter(afecta)
    const base = afectadas.reduce((a, f) => a + f.neto, 0)
    if (base > 0) {
      montoDesc = descuento.tipo === 'PORCENTAJE'
        ? Math.round(base * descuento.valor / 100)
        : descuento.valor
      if (descuento.tope_monto != null) montoDesc = Math.min(montoDesc, descuento.tope_monto)
      montoDesc = Math.min(montoDesc, base)

      // Reparto proporcional; el resto cae en la última línea (igual que el RPC)
      let acum = 0
      afectadas.forEach((f, i) => {
        const cuota = i === afectadas.length - 1
          ? montoDesc - acum
          : Math.round(montoDesc * f.neto / base)
        if (i < afectadas.length - 1) acum += cuota
        f.neto -= cuota
      })
    }
  }

  const neto = filas.reduce((a, f) => a + f.neto, 0)
  const netoAfecto = filas.filter(f => f.aplica_iva).reduce((a, f) => a + f.neto, 0)
  const iva = reglaRedondeo === 'LINEA'
    ? filas.filter(f => f.aplica_iva).reduce((a, f) => a + Math.round(f.neto * tasaIva / 100), 0)
    : Math.round(netoAfecto * tasaIva / 100)

  return { neto, iva, total: neto + iva, descuento: montoDesc }
}

/** Ley 20.956: el efectivo se redondea al múltiplo de $10 más cercano. */
export function redondearEfectivo(monto: number) {
  const redondeado = Math.round(monto / 10) * 10
  return { redondeado, ajuste: redondeado - monto }
}
