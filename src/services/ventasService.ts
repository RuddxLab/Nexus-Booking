import { supabase } from './supabaseClient'

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type TipoLinea = 'SERVICIO' | 'PRODUCTO'
export type MedioPago = 'EFECTIVO' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA' | 'GIFTCARD' | 'OTRO'

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
  /** Obligatorio cuando el medio es GIFTCARD. */
  id_gift_card?:    number | null
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

const CAMPOS_DESC =
  'id_descuento, nombre, tipo, valor, aplica_a, tope_monto, id_servicio, id_producto, nx_lleva, nx_paga, codigo'

/**
 * Promociones vigentes que se ofrecen en la lista del POS.
 * Los cupones quedan fuera a propósito: se ingresan por código.
 */
export async function listDescuentosVigentes(idEmpresa: number, hoy: string) {
  const { data, error } = await supabase
    .from('descuentos')
    .select(CAMPOS_DESC)
    .eq('id_empresa', idEmpresa)
    .eq('activo', true)
    .is('codigo', null)
    .or(`fecha_desde.is.null,fecha_desde.lte.${hoy}`)
    .or(`fecha_hasta.is.null,fecha_hasta.gte.${hoy}`)
    .order('nombre')
  if (error) throw error
  return (data ?? []) as unknown as DescuentoVigente[]
}

/** Busca un cupón por código. Devuelve null si no existe o está agotado. */
export async function buscarCupon(idEmpresa: number, codigo: string, hoy: string) {
  const c = codigo.trim().toUpperCase()
  if (!c) return null
  const { data, error } = await supabase
    .from('descuentos')
    .select(CAMPOS_DESC + ', max_usos, usos')
    .eq('id_empresa', idEmpresa)
    .eq('activo', true)
    .ilike('codigo', c)
    .or(`fecha_desde.is.null,fecha_desde.lte.${hoy}`)
    .or(`fecha_hasta.is.null,fecha_hasta.gte.${hoy}`)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const d = data as any
  if (d.max_usos != null && d.usos >= d.max_usos) return null   // agotado
  return d as DescuentoVigente
}

// ── Gift cards ───────────────────────────────────────────────────────────────
export interface GiftCardSaldo {
  id_gift_card: number; codigo: string; saldo: number; fecha_vencimiento: string | null
}

/** Busca una gift card por código y devuelve su saldo disponible. */
export async function buscarGiftCard(
  idEmpresa: number, codigo: string, hoy: string,
): Promise<GiftCardSaldo | null> {
  const c = codigo.trim().toUpperCase()
  if (!c) return null
  const { data, error } = await supabase
    .from('gift_cards')
    .select('id_gift_card, codigo, saldo, fecha_vencimiento')
    .eq('id_empresa', idEmpresa)
    .eq('activo', true)
    .ilike('codigo', c)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const g = data as GiftCardSaldo
  if (g.fecha_vencimiento && g.fecha_vencimiento < hoy) return null   // vencida
  return g
}

/** Emite una gift card (deja el movimiento de EMISIÓN registrado). */
export async function emitirGiftCard(
  idEmpresa: number, codigo: string, monto: number,
  opts: { idCliente?: number | null; vencimiento?: string | null; observaciones?: string | null } = {},
) {
  const { data, error } = await supabase.rpc('emitir_gift_card', {
    p_id_empresa: idEmpresa,
    p_codigo: codigo,
    p_monto: monto,
    p_id_cliente: opts.idCliente ?? null,
    p_vencimiento: opts.vencimiento ?? null,
    p_observaciones: opts.observaciones ?? null,
  })
  if (error) throw error
  return data as { id_gift_card: number; codigo: string; saldo: number }
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
  tipo: 'PORCENTAJE' | 'MONTO' | 'NXM'; valor: number
  aplica_a: 'TODO' | 'SERVICIOS' | 'PRODUCTOS'; tope_monto: number | null
  id_servicio: number | null; id_producto: number | null
  nx_lleva: number | null; nx_paga: number | null
  codigo?: string | null
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
    id_servicio: l.id_servicio,
    id_producto: l.id_producto,
    cantidad: l.cantidad,
    precio: l.precio_unitario_neto,
    neto: Math.round(l.precio_unitario_neto * l.cantidad - (l.descuento || 0)),
  }))

  const afecta = (f: { tipo: TipoLinea }) =>
    !descuento || descuento.aplica_a === 'TODO'
    || (descuento.aplica_a === 'SERVICIOS' && f.tipo === 'SERVICIO')
    || (descuento.aplica_a === 'PRODUCTOS' && f.tipo === 'PRODUCTO')

  let montoDesc = 0
  if (descuento?.tipo === 'NXM' && descuento.nx_lleva && descuento.nx_paga) {
    // 2x1 = lleva 2, paga 1 → por cada N unidades, (N−M) salen gratis
    filas.forEach(f => {
      const coincide = (descuento.id_servicio != null && f.id_servicio === descuento.id_servicio)
        || (descuento.id_producto != null && f.id_producto === descuento.id_producto)
      if (!coincide) return
      const gratis = Math.floor(f.cantidad / descuento.nx_lleva!) * (descuento.nx_lleva! - descuento.nx_paga!)
      const cuota = Math.round(gratis * f.precio)
      if (cuota > 0) { f.neto -= cuota; montoDesc += cuota }
    })
  } else if (descuento) {
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
