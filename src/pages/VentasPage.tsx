import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/Common/PageHeader'
import { SelectorFiltro } from '../components/Common/SelectorFiltro'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import { supabase } from '../services/supabaseClient'
import { formatearRut, validarRut, limpiarRut } from '../utils/validators'
import {
  listAgendaPendiente, listVentasRecientes, emitirVenta, anularVenta,
  calcularTotales, redondearEfectivo, buscarClientes, listDescuentosVigentes,
  buscarCupon, buscarGiftCard,
  type LineaVenta, type PagoInput, type MedioPago,
  type AgendaPendiente, type VentaResumen, type ResultadoVenta, type ClienteBusqueda,
  type DescuentoVigente, type GiftCardSaldo,
} from '../services/ventasService'

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')
const uid = () => Math.random().toString(36).slice(2, 10)
// Fecha de Chile (America/Santiago), independiente de la zona horaria del equipo.
// en-CA formatea como YYYY-MM-DD, que es lo que espera la BD.
const hoy = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

const MEDIOS: { value: MedioPago; label: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'DEBITO', label: 'Débito' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'GIFTCARD', label: 'Gift card' },
  { value: 'OTRO', label: 'Otro' },
]

type Origen = 'agenda' | 'servicios' | 'productos'

interface ItemCatalogo {
  id: number; nombre: string; valor: number; aplica_iva: boolean
}

export function VentasPage() {
  const filtro = useFiltroEmpresa()
  const { empresaId, sucursalId, empresas } = filtro

  const empresa = empresas.find(e => e.id_empresa === empresaId)
  const tasaIva = Number(empresa?.tasa_iva ?? 19)
  const reglaRedondeo = (empresa?.regla_redondeo ?? 'TOTAL') as 'LINEA' | 'TOTAL'
  const catalogoPorSucursal = empresa?.catalogo_por_sucursal ?? true

  const [origen, setOrigen] = useState<Origen>('agenda')
  const [agenda, setAgenda] = useState<AgendaPendiente[]>([])
  const [servicios, setServicios] = useState<ItemCatalogo[]>([])
  const [productos, setProductos] = useState<ItemCatalogo[]>([])
  const [prestadores, setPrestadores] = useState<{ id: number; nombre: string }[]>([])
  const [prestadorWalkin, setPrestadorWalkin] = useState<number | null>(null)
  const [buscar, setBuscar] = useState('')

  const [lineas, setLineas] = useState<LineaVenta[]>([])
  const [pagos, setPagos] = useState<PagoInput[]>([])
  const [medioNuevo, setMedioNuevo] = useState<MedioPago>('EFECTIVO')
  const [montoNuevo, setMontoNuevo] = useState(0)
  const [receptor, setReceptor] = useState('')
  const [rut, setRut] = useState('')
  const [idCliente, setIdCliente] = useState<number | null>(null)
  const [clienteQuery, setClienteQuery] = useState('')
  const [clienteResultados, setClienteResultados] = useState<ClienteBusqueda[]>([])

  const [ventas, setVentas] = useState<VentaResumen[]>([])
  // Comprobante del popup: se congela lo pagado al emitir, porque los pagos
  // se limpian para dejar la pantalla lista para la venta siguiente.
  const [emitida, setEmitida] = useState<
    { res: ResultadoVenta; pagos: PagoInput[]; pagado: number; vuelto: number } | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [descuentos, setDescuentos] = useState<DescuentoVigente[]>([])
  const [idDescuento, setIdDescuento] = useState<number | null>(null)
  // Un cupón no aparece en la lista: se ingresa por código y, una vez validado,
  // ocupa el mismo cupo de descuento que la promoción elegida en el combo.
  const [cuponTexto, setCuponTexto] = useState('')
  const [cupon, setCupon] = useState<DescuentoVigente | null>(null)
  // Gift card en curso de cobro (solo cuando el medio elegido es GIFTCARD).
  const [gcTexto, setGcTexto] = useState('')
  const [gc, setGc] = useState<GiftCardSaldo | null>(null)
  // Códigos de las tarjetas ya cargadas, solo para mostrarlos en la lista de
  // pagos: el PagoInput que viaja al RPC lleva el id, no el código.
  const [gcCodigos, setGcCodigos] = useState<Record<number, string>>({})
  // Venta en proceso de anulación y su motivo (obligatorio).
  const [anulando, setAnulando] = useState<VentaResumen | null>(null)
  const [motivoAnular, setMotivoAnular] = useState('')
  const [ocupado, setOcupado] = useState(false)

  // ── Carga de catálogos ──────────────────────────────────────────────────
  useEffect(() => {
    if (!empresaId) return
    let vivo = true

    const cargar = async () => {
      const filtroSuc = catalogoPorSucursal && sucursalId ? sucursalId : null

      let qs = supabase.from('servicios')
        .select('id_servicio, nombre_servicio, valor, maneja_iva')
        .eq('id_empresa', empresaId).eq('activo', true).order('nombre_servicio')
      if (filtroSuc) qs = qs.eq('id_sucursal', filtroSuc) as any

      let qp = supabase.from('productos')
        .select('id_producto, nombre, precio_venta, maneja_iva')
        .eq('id_empresa', empresaId).eq('activo', true).order('nombre')
      if (filtroSuc) qp = qp.eq('id_sucursal', filtroSuc) as any

      let qpr = supabase.from('prestadores')
        .select('id_prestador, nombre_prestador')
        .eq('id_empresa', empresaId).eq('activo', true).order('nombre_prestador')
      if (sucursalId) qpr = qpr.eq('id_sucursal', sucursalId) as any

      const [rs, rp, rpr] = await Promise.all([qs, qp, qpr])
      if (!vivo) return
      setServicios((rs.data ?? []).map((s: any) => ({
        id: s.id_servicio, nombre: s.nombre_servicio,
        valor: Number(s.valor ?? 0), aplica_iva: Number(s.maneja_iva ?? 0) !== 0,
      })))
      setProductos((rp.data ?? []).map((p: any) => ({
        id: p.id_producto, nombre: p.nombre,
        valor: Number(p.precio_venta ?? 0), aplica_iva: !!p.maneja_iva,
      })))
      setPrestadores((rpr.data ?? []).map((p: any) => ({ id: p.id_prestador, nombre: p.nombre_prestador })))
    }

    cargar().catch(e => vivo && setError(e.message))
    return () => { vivo = false }
  }, [empresaId, sucursalId, catalogoPorSucursal])

  const recargarAgendaYVentas = () => {
    if (!empresaId) return
    // Solo el día actual, en ambos listados.
    listAgendaPendiente(empresaId, sucursalId, hoy()).then(setAgenda).catch(() => setAgenda([]))
    listVentasRecientes(empresaId, sucursalId, hoy()).then(setVentas).catch(() => setVentas([]))
    listDescuentosVigentes(empresaId, hoy()).then(setDescuentos).catch(() => setDescuentos([]))
  }
  useEffect(recargarAgendaYVentas, [empresaId, sucursalId]) // eslint-disable-line

  // ── Búsqueda de clientes (debounced) ────────────────────────────────────
  useEffect(() => {
    const t = clienteQuery.trim()
    if (!empresaId || t.length < 2) { setClienteResultados([]); return }
    let vivo = true
    const id = setTimeout(() => {
      buscarClientes(empresaId, t).then(r => { if (vivo) setClienteResultados(r) }).catch(() => {})
    }, 250)
    return () => { vivo = false; clearTimeout(id) }
  }, [clienteQuery, empresaId])

  // ── Totales (vista previa; el RPC recalcula y manda) ────────────────────
  const descuentoSel = cupon ?? descuentos.find(d => d.id_descuento === idDescuento) ?? null
  const totales = useMemo(
    () => calcularTotales(lineas, tasaIva, reglaRedondeo, descuentoSel),
    [lineas, tasaIva, reglaRedondeo, descuentoSel],
  )
  const pagado = pagos.reduce((a, p) => a + p.monto, 0)
  // El ajuste de la Ley 20.956 no es pago de más ni de menos: se descuenta
  // antes de comparar contra el total.
  const pagadoNeto = pagos.reduce((a, p) => a + p.monto - (p.ajuste_redondeo ?? 0), 0)
  const saldo = totales.total - pagadoNeto
  // Solo el efectivo admite vuelto. Con cualquier otro medio —o mezclando
  // medios— el monto tiene que ser exacto. Esto también se valida en el RPC.
  const soloEfectivo = pagos.length > 0 && pagos.every(p => p.medio === 'EFECTIVO')
  const cubierto = lineas.length > 0 && (
    soloEfectivo ? pagadoNeto + 0.5 >= totales.total : Math.abs(saldo) < 0.5
  )
  const vuelto = soloEfectivo ? Math.max(0, pagadoNeto - totales.total) : 0

  // Un medio no se repite: si el cliente paga dos veces en efectivo, es un
  // solo pago en efectivo por la suma. Los ya usados salen de la lista.
  // Las gift cards son la excepción: cada tarjeta tiene su propio saldo, así
  // que el cliente puede traer varias. Lo que no se puede es cargar dos veces
  // la misma (eso se valida al agregar el pago).
  const mediosDisponibles = MEDIOS.filter(
    m => m.value === 'GIFTCARD' || !pagos.some(p => p.medio === m.value),
  )

  // El monto sugerido para el siguiente pago es lo que falta.
  useEffect(() => { setMontoNuevo(Math.max(0, Math.round(saldo))) }, [saldo])

  // Si el medio elegido acaba de usarse, saltar al primero que quede libre.
  useEffect(() => {
    if (mediosDisponibles.length > 0 && !mediosDisponibles.some(m => m.value === medioNuevo)) {
      setMedioNuevo(mediosDisponibles[0].value)
      setGc(null); setGcTexto('')
    }
  }, [pagos]) // eslint-disable-line

  // ── Acciones sobre líneas ──────────────────────────────────────────────
  const agregarDesdeAgenda = (a: AgendaPendiente) => {
    if (lineas.some(l => l.id_agendamiento === a.id_agendamiento)) return
    setLineas(ls => [...ls, {
      uid: uid(), tipo: 'SERVICIO',
      id_servicio: a.id_servicio, id_agendamiento: a.id_agendamiento,
      id_prestador: a.id_prestador, nombre_prestador: a.nombre_prestador,
      descripcion: a.nombre_servicio, cantidad: 1,
      precio_unitario_neto: a.valor, descuento: 0, aplica_iva: a.maneja_iva !== 0,
    }])
  }

  const agregarServicio = (s: ItemCatalogo) => {
    if (!prestadorWalkin) { setError('Elige el prestador que atendió antes de agregar un servicio'); return }
    // No se repite el mismo servicio del mismo prestador: si quiere más de uno,
    // ajusta la cantidad en el detalle.
    if (lineas.some(l => l.tipo === 'SERVICIO' && l.id_servicio === s.id && l.id_prestador === prestadorWalkin)) {
      setAviso(`"${s.nombre}" ya está en el detalle. Ajusta la cantidad ahí mismo.`)
      return
    }
    setError(null); setAviso(null)
    const pr = prestadores.find(p => p.id === prestadorWalkin)
    setLineas(ls => [...ls, {
      uid: uid(), tipo: 'SERVICIO', id_servicio: s.id, id_prestador: prestadorWalkin,
      nombre_prestador: pr?.nombre, descripcion: s.nombre, cantidad: 1,
      precio_unitario_neto: s.valor, descuento: 0, aplica_iva: s.aplica_iva,
    }])
    // Limpiar la búsqueda y el prestador tras seleccionar.
    setBuscar(''); setPrestadorWalkin(null)
  }

  const agregarProducto = (p: ItemCatalogo) => {
    // No se incrementa desde el catálogo: si ya está, se avisa y el usuario
    // cambia la cantidad directamente en el detalle.
    if (lineas.some(l => l.tipo === 'PRODUCTO' && l.id_producto === p.id)) {
      setAviso(`"${p.nombre}" ya está en el detalle. Ajusta la cantidad ahí mismo.`)
      return
    }
    setError(null); setAviso(null)
    setLineas(ls => [...ls, {
      uid: uid(), tipo: 'PRODUCTO', id_producto: p.id, descripcion: p.nombre,
      cantidad: 1, precio_unitario_neto: p.valor, descuento: 0, aplica_iva: p.aplica_iva,
    }])
    setBuscar('')
  }

  const cambiarCantidad = (u: string, d: number) =>
    setLineas(ls => ls.flatMap(l => {
      if (l.uid !== u) return [l]
      const c = l.cantidad + d
      if (c <= 0) return []
      // Una línea que viene de la agenda representa UNA cita: no se multiplica.
      if (l.id_agendamiento) return [l]
      return [{ ...l, cantidad: c }]
    }))

  const quitarLinea = (u: string) => setLineas(ls => ls.filter(l => l.uid !== u))

  const limpiar = () => {
    setLineas([]); setPagos([]); setReceptor(''); setRut(''); setIdCliente(null)
    setClienteQuery(''); setClienteResultados([]); setEmitida(null); setError(null); setAviso(null); setIdDescuento(null)
    setCupon(null); setCuponTexto(''); setGc(null); setGcTexto(''); setGcCodigos({})
  }

  const seleccionarCliente = (c: ClienteBusqueda) => {
    setReceptor(c.nombre_cliente || '')
    setRut(c.rut ? formatearRut(c.rut) : '')
    setIdCliente(c.id_cliente)
    setClienteQuery(''); setClienteResultados([])
  }

  // ── Cupones ─────────────────────────────────────────────────────────────
  const aplicarCupon = async () => {
    if (!empresaId || !cuponTexto.trim()) return
    setError(null); setAviso(null)
    try {
      const c = await buscarCupon(empresaId, cuponTexto, hoy())
      if (!c) { setError('Ese cupón no existe, ya venció o se agotó.'); return }
      setCupon(c)
      setIdDescuento(null)           // el cupón manda sobre la promo del combo
      setAviso(`Cupón ${cuponTexto.trim().toUpperCase()} aplicado.`)
    } catch (e: any) { setError(e.message ?? 'No se pudo validar el cupón') }
  }

  const quitarCupon = () => { setCupon(null); setCuponTexto(''); setAviso(null) }

  // ── Pagos ───────────────────────────────────────────────────────────────
  // Varias modalidades por venta: el cajero ingresa el monto de cada pago.
  //
  // Regla de caja: el vuelto es privilegio exclusivo del efectivo. Si el pago
  // mezcla medios —o es de un medio distinto al efectivo— el monto tiene que
  // calzar exacto con el total, porque no hay nada que devolver.
  const agregarPago = () => {
    const monto = Math.round(montoNuevo)
    if (!monto || monto <= 0) return
    if (medioNuevo !== 'GIFTCARD' && pagos.some(p => p.medio === medioNuevo)) {
      const etiqueta = MEDIOS.find(m => m.value === medioNuevo)?.label ?? medioNuevo
      setError(`${etiqueta} ya está en esta venta: usa un solo pago por medio, por el total de ese medio.`)
      return
    }
    if (medioNuevo === 'GIFTCARD' && gc && pagos.some(p => p.id_gift_card === gc.id_gift_card)) {
      setError(`La gift card ${gc.codigo} ya está cargada en esta venta: usa un solo cobro por tarjeta.`)
      return
    }

    let nuevo: PagoInput
    if (medioNuevo === 'GIFTCARD') {
      if (!gc) { setError('Ingresa el código de la gift card y valídalo antes de cobrar.'); return }
      if (monto > gc.saldo) {
        setError(`La gift card ${gc.codigo} solo tiene ${money(gc.saldo)} disponibles.`)
        return
      }
      setGcCodigos(m => ({ ...m, [gc.id_gift_card]: gc.codigo }))
      nuevo = { medio: 'GIFTCARD', monto, id_gift_card: gc.id_gift_card }
    } else if (medioNuevo === 'EFECTIVO') {
      const { redondeado, ajuste } = redondearEfectivo(monto)
      nuevo = { medio: 'EFECTIVO', monto: redondeado, ajuste_redondeo: ajuste }
    } else {
      nuevo = { medio: medioNuevo, monto }
    }

    const resultante = [...pagos, nuevo]
    const netoResultante = resultante.reduce((a, p) => a + p.monto - (p.ajuste_redondeo ?? 0), 0)
    const todoEfectivo = resultante.every(p => p.medio === 'EFECTIVO')
    if (!todoEfectivo && netoResultante - totales.total > 0.5) {
      const etiqueta = MEDIOS.find(m => m.value === nuevo.medio)?.label ?? nuevo.medio
      setError(
        pagos.length === 0
          ? `${etiqueta} no admite vuelto: cobra exactamente ${money(totales.total)}.`
          : saldo <= 0
            ? 'Ya hay efectivo de más. Al sumar otro medio de pago no se puede dar vuelto: ajusta primero el monto en efectivo.'
            : `Al combinar medios de pago no se puede dar vuelto: este pago no debe superar ${money(saldo)}.`,
      )
      return
    }

    setError(null)
    setPagos(resultante)
    if (nuevo.medio === 'GIFTCARD') { setGc(null); setGcTexto('') }
  }

  const validarGiftCard = async () => {
    if (!empresaId || !gcTexto.trim()) return
    setError(null)
    try {
      const g = await buscarGiftCard(empresaId, gcTexto, hoy())
      if (!g) { setError('Esa gift card no existe, está desactivada o venció.'); setGc(null); return }
      if (g.saldo <= 0) { setError('Esa gift card ya no tiene saldo.'); setGc(null); return }
      if (pagos.some(p => p.id_gift_card === g.id_gift_card)) {
        setError(`La gift card ${g.codigo} ya está cargada en esta venta.`); setGc(null); return
      }
      setGc(g)
      // Sugerir lo menor entre el saldo y lo que falta por pagar.
      setMontoNuevo(Math.min(g.saldo, Math.max(0, Math.round(saldo))))
    } catch (e: any) { setError(e.message ?? 'No se pudo validar la gift card') }
  }

  // ── Emitir ──────────────────────────────────────────────────────────────
  const emitir = async () => {
    if (!empresaId || !sucursalId || lineas.length === 0) return
    if (rut && !validarRut(rut)) { setError('El RUT del cliente no es válido.'); return }
    if (!cubierto) {
      setError(soloEfectivo
        ? 'Los pagos deben cubrir el total de la venta.'
        : 'Con medios distintos al efectivo el monto pagado debe ser exacto: no se puede dar vuelto.')
      return
    }
    setOcupado(true); setError(null)
    try {
      const res = await emitirVenta(empresaId, sucursalId, lineas, {
        idCliente,
        rutReceptor: rut ? limpiarRut(rut) : null,
        nombreReceptor: receptor || null,
        pagos,
        idDescuento: descuentoSel?.id_descuento ?? null,
      })
      setEmitida({ res, pagos: [...pagos], pagado, vuelto: soloEfectivo ? Math.max(0, pagadoNeto - res.total) : 0 })
      setLineas([]); setPagos([]); setReceptor(''); setRut(''); setIdCliente(null); setClienteQuery(''); setAviso(null); setIdDescuento(null)
      setCupon(null); setCuponTexto(''); setGc(null); setGcTexto(''); setGcCodigos({})
      recargarAgendaYVentas()
    } catch (e: any) {
      setError(e.message ?? 'No se pudo emitir la venta')
    } finally { setOcupado(false) }
  }

  // ── Anulación ───────────────────────────────────────────────────────────
  // Queda registrado quién anuló, cuándo y por qué: el motivo es obligatorio
  // y el RPC lo exige aunque alguien se salte esta pantalla.
  const confirmarAnulacion = async () => {
    if (!anulando || motivoAnular.trim().length < 5) return
    setOcupado(true)
    try {
      await anularVenta(anulando.id_venta, motivoAnular.trim())
      setAnulando(null); setMotivoAnular(''); setError(null)
      recargarAgendaYVentas()
    } catch (e: any) {
      setError(e.message ?? 'No se pudo anular')
    } finally { setOcupado(false) }
  }

  // ── Filtrado de catálogo ────────────────────────────────────────────────
  const q = buscar.trim().toLowerCase()
  const filtrar = (items: ItemCatalogo[]) =>
    q ? items.filter(i => i.nombre.toLowerCase().includes(q)) : items

  return (
    <div className="pos">
      <style>{CSS}</style>
      <PageHeader titulo="Punto de venta" />

      <SelectorFiltro
        esAdmin={filtro.esAdmin} esSupervisor={filtro.esSupervisor}
        empresas={filtro.empresas} sucursalesDeEmpresa={filtro.sucursalesDeEmpresa}
        empresaId={empresaId} sucursalId={sucursalId}
        onEmpresaChange={filtro.setEmpresaId} onSucursalChange={filtro.setSucursalId}
        forzarSucursal
      />

      {error && <div className="pos-error">{error}</div>}
      {aviso && <div className="pos-aviso">{aviso}</div>}

      {/* ── Cliente (opcional) — encima del detalle de la venta ── */}
      <section className="pos-card pos-cliente-card">
        <div className="pos-card-t">Cliente <span className="pos-opt">· opcional</span></div>
        <div className="pos-cliente">
          <div className="pos-cli-search">
            <input className="pos-input" placeholder="Buscar cliente por nombre, RUT, correo o teléfono"
              value={clienteQuery} onChange={e => setClienteQuery(e.target.value)} />
            {clienteResultados.length > 0 && (
              <div className="pos-cli-drop">
                {clienteResultados.map(c => (
                  <button key={c.id_cliente} className="pos-cli-op" onClick={() => seleccionarCliente(c)}>
                    <span className="pos-cli-nom">{c.nombre_cliente}</span>
                    <span className="pos-cli-meta">{[c.rut, c.telefono, c.email].filter(Boolean).join(' · ') || '—'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="pos-cli-row">
            <input className="pos-input" placeholder="Nombre del cliente"
              value={receptor} onChange={e => { setReceptor(e.target.value); setIdCliente(null) }} />
            <input className="pos-input" placeholder="RUT"
              value={rut} onChange={e => { setRut(formatearRut(e.target.value)); setIdCliente(null) }} />
          </div>
          {rut.length > 0 && !validarRut(rut) && <div className="pos-cli-warn">RUT inválido</div>}
        </div>
      </section>

      {emitida && (
        <div className="pos-modal-bg" role="dialog" aria-modal="true">
          <div className="pos-modal">
            <div className="pos-modal-hd">
              <div className="pos-modal-check">✓</div>
              <div>
                <div className="pos-modal-t">Venta N° {emitida.res.numero} emitida</div>
                <div className="pos-modal-s">{new Date().toLocaleString('es-CL')}</div>
              </div>
            </div>

            <div className="pos-modal-body">
              {emitida.res.descuento > 0 && (
                <div className="pos-dt pos-dt-desc"><span>Descuento aplicado</span><b>−{money(emitida.res.descuento)}</b></div>
              )}
              <div className="pos-dt"><span>Neto</span><b>{money(emitida.res.neto)}</b></div>
              <div className="pos-dt"><span>IVA ({emitida.res.tasa_iva}%)</span><b>{money(emitida.res.iva)}</b></div>
              <div className="pos-dt pos-dt-total"><span>Total</span><b>{money(emitida.res.total)}</b></div>

              <div className="pos-modal-sep">Pagos</div>
              {emitida.pagos.length === 0
                ? <div className="pos-dt"><span>Sin pagos registrados</span><b>—</b></div>
                : emitida.pagos.map((p, i) => (
                  <div className="pos-dt" key={i}>
                    <span>{MEDIOS.find(m => m.value === p.medio)?.label}
                      {!!p.ajuste_redondeo && <em className="pos-dt-aj"> (redondeo {p.ajuste_redondeo > 0 ? '+' : ''}{p.ajuste_redondeo})</em>}
                    </span>
                    <b>{money(p.monto)}</b>
                  </div>
                ))}
              <div className="pos-dt"><span>Total pagado</span><b>{money(emitida.pagado)}</b></div>

              <div className="pos-vuelto">
                <span>Vuelto</span>
                <strong>{money(emitida.vuelto)}</strong>
              </div>
            </div>

            <div className="pos-modal-ft">
              <button className="pos-btn" onClick={() => window.print()}>Imprimir</button>
              <button className="pos-btn pos-btn--primary" onClick={() => setEmitida(null)} autoFocus>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Anulación: el motivo queda registrado con nombre y hora ── */}
      {anulando && (
        <div className="pos-modal-bg" role="dialog" aria-modal="true">
          <div className="pos-modal">
            <div className="pos-modal-hd pos-modal-hd--peligro">
              <div className="pos-modal-check pos-modal-check--peligro">!</div>
              <div>
                <div className="pos-modal-t">Anular venta N° {anulando.numero}</div>
                <div className="pos-modal-s">{money(anulando.total)} · {anulando.nombre_receptor || 'sin receptor'}</div>
              </div>
            </div>
            <div className="pos-modal-body">
              <p className="pos-modal-aviso">
                La anulación queda registrada con tu nombre y la hora. Si la venta
                se pagó con gift card, el saldo vuelve a la tarjeta, y la cita
                asociada queda pendiente de cobro otra vez.
              </p>
              <label className="pos-modal-lbl">
                Motivo de la anulación
                <textarea className="pos-modal-txt" rows={3} autoFocus
                  placeholder="Ej: cobro duplicado, el cliente se arrepintió del servicio…"
                  value={motivoAnular} onChange={e => setMotivoAnular(e.target.value)} />
              </label>
              {motivoAnular.trim().length > 0 && motivoAnular.trim().length < 5 && (
                <div className="pos-nota-exacto">Explica brevemente qué pasó.</div>
              )}
            </div>
            <div className="pos-modal-ft">
              <button className="pos-btn" onClick={() => { setAnulando(null); setMotivoAnular('') }}>Cancelar</button>
              <button className="pos-btn pos-btn--peligro" onClick={confirmarAnulacion}
                disabled={ocupado || motivoAnular.trim().length < 5}>
                {ocupado ? 'Anulando…' : 'Anular venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pos-grid">
        {/* ── Origen de las líneas ── */}
        <section className="pos-card">
          <div className="pos-tabs">
            {([['agenda', `Agenda de hoy (${agenda.length})`], ['servicios', 'Servicios'], ['productos', 'Productos']] as [Origen, string][])
              .map(([id, label]) => (
                <button key={id} className={origen === id ? 'on' : ''} onClick={() => setOrigen(id)}>{label}</button>
              ))}
          </div>

          {origen !== 'agenda' && (
            <input className="pos-input" placeholder="Buscar…" value={buscar} onChange={e => setBuscar(e.target.value)} />
          )}

          {origen === 'servicios' && (
            <select className="pos-input" value={prestadorWalkin ?? ''}
              onChange={e => setPrestadorWalkin(e.target.value ? Number(e.target.value) : null)}>
              <option value="">¿Quién atendió? (obligatorio)</option>
              {prestadores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          )}

          <div className="pos-lista">
            {origen === 'agenda' && (agenda.length === 0
              ? <p className="pos-vacio">No hay citas pendientes de cobro</p>
              : agenda.map(a => {
                const ya = lineas.some(l => l.id_agendamiento === a.id_agendamiento)
                return (
                  <button key={a.id_agendamiento} className="pos-item" disabled={ya} onClick={() => agregarDesdeAgenda(a)}>
                    <span className="pos-item-nom">{a.nombre_cliente}
                      <span className="pos-item-sub">{a.nombre_servicio} · {a.nombre_prestador} · {a.fecha} {a.hora_inicio?.slice(0, 5)}</span>
                    </span>
                    <span className="pos-item-val">{ya ? '✓' : money(a.valor)}</span>
                  </button>
                )
              }))}

            {origen === 'servicios' && (filtrar(servicios).length === 0
              ? <p className="pos-vacio">Sin servicios en este catálogo</p>
              : filtrar(servicios).map(s => (
                <button key={s.id} className="pos-item" onClick={() => agregarServicio(s)}>
                  <span className="pos-item-nom">{s.nombre}</span>
                  <span className="pos-item-val">{money(s.valor)}</span>
                </button>
              )))}

            {origen === 'productos' && (filtrar(productos).length === 0
              ? <p className="pos-vacio">Aún no hay productos cargados</p>
              : filtrar(productos).map(p => (
                <button key={p.id} className="pos-item" onClick={() => agregarProducto(p)}>
                  <span className="pos-item-nom">{p.nombre}</span>
                  <span className="pos-item-val">{money(p.valor)}</span>
                </button>
              )))}
          </div>
        </section>

        {/* ── Ticket ── */}
        <section className="pos-card pos-ticket">
          <div className="pos-card-t">Detalle</div>

          {lineas.length === 0
            ? <p className="pos-vacio">Agrega servicios o productos desde la izquierda</p>
            : (
              <div className="pos-lineas">
                {lineas.map(l => (
                  <div className="pos-linea" key={l.uid}>
                    <div className="pos-linea-info">
                      <div className="pos-linea-nom">{l.descripcion}</div>
                      <div className="pos-linea-sub">
                        {l.nombre_prestador && <>{l.nombre_prestador} · </>}
                        {money(l.precio_unitario_neto)} neto{!l.aplica_iva && ' · exento'}
                        {l.id_agendamiento && ' · desde agenda'}
                      </div>
                    </div>
                    <div className="pos-qty">
                      <button onClick={() => cambiarCantidad(l.uid, -1)} disabled={!!l.id_agendamiento}>−</button>
                      <span>{l.cantidad}</span>
                      <button onClick={() => cambiarCantidad(l.uid, +1)} disabled={!!l.id_agendamiento}>+</button>
                    </div>
                    <div className="pos-linea-tot">{money(l.precio_unitario_neto * l.cantidad)}</div>
                    <button className="pos-x" onClick={() => quitarLinea(l.uid)} aria-label="Quitar">×</button>
                  </div>
                ))}
              </div>
            )}

          {descuentos.length > 0 && (
            <select className="pos-input pos-desc-sel" value={idDescuento ?? ''} disabled={!!cupon}
              title={cupon ? 'Hay un cupón aplicado' : undefined}
              onChange={e => setIdDescuento(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Sin descuento</option>
              {descuentos.map(d => (
                <option key={d.id_descuento} value={d.id_descuento}>
                  {d.nombre} · {d.tipo === 'NXM' ? `${d.nx_lleva}x${d.nx_paga}`
                    : d.tipo === 'PORCENTAJE' ? `${d.valor}%` : money(d.valor)}
                  {d.tipo !== 'NXM' && d.aplica_a !== 'TODO' ? ` (solo ${d.aplica_a.toLowerCase()})` : ''}
                </option>
              ))}
            </select>
          )}

          {/* Cupón: no se lista, se ingresa a mano */}
          {cupon ? (
            <div className="pos-cupon-on">
              <span>🎟 {cupon.nombre} · {cupon.tipo === 'PORCENTAJE' ? `${cupon.valor}%` : money(cupon.valor)}</span>
              <button className="pos-x" onClick={quitarCupon} aria-label="Quitar cupón">×</button>
            </div>
          ) : (
            <div className="pos-cupon">
              <input className="pos-input" placeholder="Código de cupón" value={cuponTexto}
                onChange={e => setCuponTexto(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') aplicarCupon() }} />
              <button className="pos-btn" onClick={aplicarCupon} disabled={!cuponTexto.trim()}>Aplicar</button>
            </div>
          )}

          <div className="pos-tot">
            <div><span>Neto</span><b>{money(totales.neto)}</b></div>
            {totales.descuento > 0 && (
              <div className="pos-tot-desc"><span>Descuento</span><b>−{money(totales.descuento)}</b></div>
            )}
            <div><span>IVA ({tasaIva}%)</span><b>{money(totales.iva)}</b></div>
            <div className="pos-tot-g"><span>Total</span><b>{money(totales.total)}</b></div>
          </div>

          {/* Pagos */}
          <div className="pos-pagos">
            {pagos.map((p, i) => (
              <div className="pos-pago" key={i}>
                <span>
                  {MEDIOS.find(m => m.value === p.medio)?.label}
                  {p.id_gift_card && gcCodigos[p.id_gift_card] && ` ${gcCodigos[p.id_gift_card]}`}
                </span>
                <b>{money(p.monto)}</b>
                {!!p.ajuste_redondeo && <em title="Ley 20.956: efectivo al múltiplo de $10">
                  {p.ajuste_redondeo > 0 ? '+' : ''}{p.ajuste_redondeo}</em>}
                <button className="pos-x" onClick={() => setPagos(ps => ps.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            {lineas.length > 0 && saldo > 0 && mediosDisponibles.length > 0 && (
              <>
                <div className="pos-pago-add">
                  <select value={medioNuevo} onChange={e => {
                    setMedioNuevo(e.target.value as MedioPago); setGc(null); setGcTexto('')
                  }}>
                    {mediosDisponibles.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <input className="pos-pago-monto" type="number" min="0" step="1"
                    value={montoNuevo || ''} onChange={e => setMontoNuevo(Number(e.target.value))} />
                  <button className="pos-btn" onClick={agregarPago}
                    disabled={medioNuevo === 'GIFTCARD' && !gc}>Agregar</button>
                </div>
                {medioNuevo === 'GIFTCARD' && (
                  <div className="pos-gc">
                    <input className="pos-input" placeholder="Código de la gift card" value={gcTexto}
                      onChange={e => { setGcTexto(e.target.value.toUpperCase()); setGc(null) }}
                      onKeyDown={e => { if (e.key === 'Enter') validarGiftCard() }} />
                    <button className="pos-btn" onClick={validarGiftCard} disabled={!gcTexto.trim()}>Validar</button>
                    {gc && <span className="pos-gc-saldo">Saldo {money(gc.saldo)}</span>}
                  </div>
                )}
              </>
            )}
            {lineas.length > 0 && saldo !== 0 && pagos.length > 0 && (
              <div className="pos-saldo">
                {saldo > 0 ? `Falta por pagar ${money(saldo)}`
                  : soloEfectivo ? `Vuelto ${money(-saldo)}`
                  : `Sobran ${money(-saldo)}: sin efectivo el monto debe ser exacto`}
              </div>
            )}
            {lineas.length > 0 && saldo > 0 && pagos.length === 0 && medioNuevo !== 'EFECTIVO' && (
              <div className="pos-nota-exacto">Solo el efectivo admite vuelto: cobra exactamente {money(totales.total)}.</div>
            )}
            {lineas.length > 0 && saldo > 0 && mediosDisponibles.length === 0 && (
              <div className="pos-nota-exacto">
                Ya usaste todos los medios de pago. Corrige el monto de alguno para completar {money(saldo)}.
              </div>
            )}
            {lineas.length > 0 && cubierto && <div className="pos-cubierto">Pago completo ✓</div>}
          </div>

          <div className="pos-acciones">
            <button className="pos-btn" onClick={limpiar} disabled={lineas.length === 0}>Limpiar</button>
            <button className="pos-btn pos-btn--primary" onClick={emitir}
              disabled={ocupado || lineas.length === 0 || !sucursalId || !cubierto}
              title={!cubierto ? 'Los pagos deben cubrir el total' : undefined}>
              {ocupado ? 'Emitiendo…' : `Emitir venta ${money(totales.total)}`}
            </button>
          </div>
        </section>
      </div>

      {/* ── Últimas ventas ── */}
      <section className="pos-card">
        <div className="pos-card-t">Ventas de hoy</div>
        {ventas.length === 0
          ? <p className="pos-vacio">No hay ventas registradas hoy</p>
          : (
            <div className="pos-tbl-wrap">
              <table className="pos-tbl">
                <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th className="r">Neto</th><th className="r">IVA</th><th className="r">Total</th><th>Estado</th><th /></tr></thead>
                <tbody>
                  {ventas.map(v => (
                    <tr key={v.id_venta} className={v.estado === 'ANULADA' ? 'anulada' : ''}>
                      <td>{v.numero ?? '—'}</td>
                      <td>{v.fecha}</td>
                      <td>{v.nombre_receptor || '—'}</td>
                      <td className="r">{money(v.neto)}</td>
                      <td className="r">{money(v.iva)}</td>
                      <td className="r"><b>{money(v.total)}</b></td>
                      <td>
                        <span className={'pos-pill ' + (v.estado === 'ANULADA' ? 'ca' : 'ok')}>{v.estado}</span>
                        {v.estado === 'ANULADA' && v.motivo_anulacion && (
                          <div className="pos-motivo" title={v.motivo_anulacion}>{v.motivo_anulacion}</div>
                        )}
                      </td>
                      <td>{v.estado === 'EMITIDA' &&
                        <button className="pos-link" onClick={() => { setAnulando(v); setMotivoAnular('') }}>Anular</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  )
}

const CSS = `
.pos{--mono:ui-monospace,"Cascadia Code","Consolas",monospace}
.pos *{box-sizing:border-box}
.pos-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
@media(max-width:960px){.pos-grid{grid-template-columns:1fr}}
.pos-card{background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);box-shadow:var(--shadow-card);padding:16px 18px;margin-bottom:16px}
.pos-card-t{font-size:12px;font-weight:700;color:var(--color-ink);margin-bottom:12px}
.pos-tabs{display:flex;gap:2px;border-bottom:1px solid var(--color-border);margin-bottom:12px;overflow-x:auto}
.pos-tabs button{border:0;background:transparent;font:inherit;font-size:11px;font-weight:600;color:var(--color-ink-soft);padding:9px 12px;cursor:pointer;white-space:nowrap;position:relative}
.pos-tabs button.on{color:var(--color-ink)}
.pos-tabs button.on::after{content:"";position:absolute;left:8px;right:8px;bottom:-1px;height:2.5px;border-radius:2px;background:var(--color-accent)}
.pos-input{width:100%;padding:8px 11px;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-bg);color:var(--color-ink);font:inherit;font-size:11px;margin-bottom:10px}
.pos-lista{max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:6px}
.pos-item{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;padding:9px 11px;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-ink);font:inherit;cursor:pointer;transition:.15s}
.pos-item:hover:not(:disabled){border-color:var(--color-accent);background:var(--color-bg)}
.pos-item:disabled{opacity:.45;cursor:default}
.pos-item-nom{font-size:11px;font-weight:600;display:flex;flex-direction:column;min-width:0}
.pos-item-sub{font-size:9px;font-weight:400;color:var(--color-ink-soft);margin-top:2px}
.pos-item-val{font-family:var(--mono);font-size:11px;font-weight:700;white-space:nowrap}
.pos-vacio{color:var(--color-ink-soft);font-size:11px;text-align:center;padding:22px 8px;margin:0}
.pos-lineas{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;max-height:300px;overflow-y:auto}
.pos-linea{display:grid;grid-template-columns:1fr auto auto auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--color-border);border-radius:var(--radius-sm)}
.pos-linea-nom{font-size:11px;font-weight:600}
.pos-linea-sub{font-size:9px;color:var(--color-ink-soft);margin-top:2px}
.pos-qty{display:flex;align-items:center;gap:6px}
.pos-qty button{width:24px;height:24px;border:1px solid var(--color-border);border-radius:6px;background:var(--color-surface);color:var(--color-ink);cursor:pointer;font-size:12px;line-height:1}
.pos-qty button:disabled{opacity:.3;cursor:default}
.pos-qty span{font-family:var(--mono);font-size:11px;min-width:18px;text-align:center}
.pos-linea-tot{font-family:var(--mono);font-size:11px;font-weight:700;white-space:nowrap}
.pos-x{border:0;background:transparent;color:var(--color-ink-soft);cursor:pointer;font-size:15px;line-height:1;padding:0 3px}
.pos-x:hover{color:var(--color-danger)}
.pos-tot{border-top:1px solid var(--color-border);padding-top:10px;display:flex;flex-direction:column;gap:5px}
.pos-tot div{display:flex;justify-content:space-between;font-size:11px;color:var(--color-ink-soft)}
.pos-tot b{font-family:var(--mono);color:var(--color-ink)}
.pos-tot-g{border-top:1px solid var(--color-border);padding-top:8px;margin-top:3px;font-size:13px!important;color:var(--color-ink)!important;font-weight:700}
.pos-tot-g b{font-size:17px}
.pos-pagos{margin-top:12px;display:flex;flex-direction:column;gap:6px}
.pos-pago{display:flex;align-items:center;gap:8px;font-size:11px;padding:6px 10px;background:var(--color-bg);border-radius:var(--radius-sm)}
.pos-pago b{margin-left:auto;font-family:var(--mono)}
.pos-pago em{font-style:normal;font-size:9px;color:var(--color-ink-soft);font-family:var(--mono)}
.pos-pago-add{display:flex;gap:8px}
.pos-pago-add select{flex:1;padding:7px 10px;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-ink);font:inherit;font-size:11px}
.pos-pago-monto{width:96px;padding:7px 10px;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-ink);font:inherit;font-size:11px;font-family:var(--mono);text-align:right}
.pos-cupon{display:flex;gap:8px;margin-bottom:10px}
.pos-cupon .pos-input{flex:1;text-transform:uppercase;font-family:var(--mono)}
.pos-cupon-on{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:7px 10px;border-radius:var(--radius-sm);background:var(--color-success-soft);color:var(--color-success);font-size:11.5px;font-weight:700}
.pos-cupon-on span{flex:1}
.pos-gc{display:flex;align-items:center;gap:8px;margin-top:6px}
.pos-gc .pos-input{flex:1;text-transform:uppercase;font-family:var(--mono);font-size:11px;padding:7px 10px}
.pos-gc-saldo{font-size:11px;font-weight:700;color:var(--color-success);white-space:nowrap;font-family:var(--mono)}
.pos-saldo{font-size:10px;color:var(--color-warning);font-weight:600}
.pos-nota-exacto{font-size:10px;color:var(--color-ink-soft)}
.pos-modal-hd--peligro{background:var(--color-danger-soft)}
.pos-modal-check--peligro{background:var(--color-danger)}
.pos-modal-aviso{font-size:12px;color:var(--color-ink-soft);line-height:1.55;margin:0 0 14px;max-width:60ch}
.pos-modal-lbl{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:600;color:var(--color-ink-soft)}
.pos-modal-txt{padding:9px 11px;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-bg);color:var(--color-ink);font:inherit;font-size:13px;resize:vertical}
.pos-btn--peligro{background:var(--color-danger);color:#fff;border-color:var(--color-danger)}
.pos-motivo{font-size:10px;color:var(--color-ink-soft);margin-top:3px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pos-cubierto{font-size:10px;color:var(--color-success);font-weight:700}
.pos-cliente{margin-bottom:10px}
.pos-cli-search{position:relative}
.pos-cli-drop{position:absolute;top:100%;left:0;right:0;z-index:30;margin-top:-6px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-sm);box-shadow:var(--shadow-elevated);max-height:220px;overflow-y:auto}
.pos-cli-op{display:flex;flex-direction:column;gap:1px;width:100%;text-align:left;border:0;border-bottom:1px solid var(--color-border);background:transparent;padding:8px 11px;cursor:pointer}
.pos-cli-op:hover{background:var(--color-bg)}
.pos-cli-nom{font-size:11px;font-weight:600;color:var(--color-ink)}
.pos-cli-meta{font-size:9px;color:var(--color-ink-soft)}
.pos-cli-row{display:flex;gap:8px}
.pos-cli-warn{font-size:9px;color:var(--color-danger);margin:-6px 0 4px;font-weight:600}
.pos-acciones{display:flex;gap:8px;margin-top:14px}
.pos-btn{flex:1;padding:10px 14px;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-ink);font:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:.15s}
.pos-btn:hover:not(:disabled){border-color:var(--color-ink-soft)}
.pos-btn:disabled{opacity:.45;cursor:default}
.pos-btn--primary{background:var(--color-primary);color:var(--color-primary-ink);border-color:var(--color-primary);flex:2}
.pos-btn--primary:hover:not(:disabled){background:var(--color-primary-hover)}
.pos-error{background:var(--color-danger-soft);color:var(--color-danger);padding:10px 14px;border-radius:var(--radius-sm);font-size:11px;margin-bottom:14px}
.pos-aviso{background:var(--color-warning-soft);color:var(--color-warning);padding:10px 14px;border-radius:var(--radius-sm);font-size:11px;font-weight:600;margin-bottom:14px}
.pos-cliente-card{margin-bottom:16px}
.pos-opt{font-weight:500;color:var(--color-ink-soft);font-size:9.5px;text-transform:none;letter-spacing:0}
/* ── Comprobante emitido (modal grande) ── */
.pos-modal-bg{position:fixed;inset:0;z-index:1000;background:rgba(20,20,18,.55);backdrop-filter:blur(3px);display:grid;place-items:center;padding:20px;animation:posFade .18s ease}
@keyframes posFade{from{opacity:0}to{opacity:1}}
.pos-modal{width:100%;max-width:520px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);box-shadow:var(--shadow-elevated);overflow:hidden;animation:posUp .22s cubic-bezier(.2,.8,.3,1)}
@keyframes posUp{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}
.pos-modal-hd{display:flex;align-items:center;gap:14px;padding:20px 24px;border-bottom:1px solid var(--color-border);background:var(--color-success-soft)}
.pos-modal-check{width:38px;height:38px;border-radius:50%;background:var(--color-success);color:#fff;display:grid;place-items:center;font-size:20px;font-weight:700;flex:none}
.pos-modal-t{font-size:17px;font-weight:800;color:var(--color-ink)}
.pos-modal-s{font-size:11px;color:var(--color-ink-soft);margin-top:2px}
.pos-modal-body{padding:18px 24px}
.pos-dt{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:6px 0;font-size:14px;color:var(--color-ink-soft)}
.pos-dt b{font-family:var(--mono);font-size:15px;color:var(--color-ink);font-weight:700}
.pos-dt-aj{font-style:normal;font-size:11px;color:var(--color-ink-soft)}
.pos-dt-total{border-top:1px solid var(--color-border);margin-top:6px;padding-top:10px;color:var(--color-ink);font-weight:700;font-size:16px}
.pos-dt-total b{font-size:20px}
.pos-modal-sep{margin:14px 0 4px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--color-ink-soft)}
/* El vuelto es el dato que el cajero necesita ver de un vistazo */
.pos-vuelto{margin-top:16px;padding:16px 20px;border-radius:var(--radius-md);background:var(--color-warning-soft);border:2px solid var(--color-warning);display:flex;align-items:center;justify-content:space-between;gap:12px}
.pos-vuelto span{font-size:15px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--color-warning)}
.pos-vuelto strong{font-family:var(--mono);font-size:38px;line-height:1;font-weight:800;color:var(--color-warning)}
.pos-modal-ft{display:flex;gap:10px;padding:16px 24px;border-top:1px solid var(--color-border);background:var(--color-bg)}
.pos-tbl-wrap{overflow-x:auto}
.pos-tbl{width:100%;border-collapse:collapse;font-size:11px}
.pos-tbl th{text-align:left;font-size:8.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--color-ink-soft);font-weight:600;padding:0 9px 9px}
.pos-tbl th.r,.pos-tbl td.r{text-align:right;font-family:var(--mono)}
.pos-tbl td{padding:9px;border-top:1px solid var(--color-border);color:var(--color-ink)}
.pos-tbl tr.anulada{opacity:.55;text-decoration:line-through}
.pos-pill{font-size:8.5px;font-weight:700;padding:2px 8px;border-radius:999px}
.pos-pill.ok{background:var(--color-success-soft);color:var(--color-success)}
.pos-pill.ca{background:var(--color-danger-soft);color:var(--color-danger)}
.pos-link{border:0;background:transparent;color:var(--color-danger);font:inherit;font-size:10.5px;cursor:pointer;text-decoration:underline}
`
