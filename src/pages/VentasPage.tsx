import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/Common/PageHeader'
import { SelectorFiltro } from '../components/Common/SelectorFiltro'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import { supabase } from '../services/supabaseClient'
import { formatearRut, validarRut, limpiarRut } from '../utils/validators'
import {
  listAgendaPendiente, listVentasRecientes, emitirVenta, anularVenta,
  calcularTotales, redondearEfectivo, buscarClientes,
  type LineaVenta, type PagoInput, type MedioPago,
  type AgendaPendiente, type VentaResumen, type ResultadoVenta, type ClienteBusqueda,
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
  const [emitida, setEmitida] = useState<ResultadoVenta | null>(null)
  const [error, setError] = useState<string | null>(null)
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
  const totales = useMemo(
    () => calcularTotales(lineas, tasaIva, reglaRedondeo),
    [lineas, tasaIva, reglaRedondeo],
  )
  const pagado = pagos.reduce((a, p) => a + p.monto, 0)
  const saldo = totales.total - pagado
  // Los pagos deben cubrir el total para poder emitir (efectivo puede dar vuelto).
  const cubierto = lineas.length > 0 && pagado + 0.5 >= totales.total

  // El monto sugerido para el siguiente pago es lo que falta.
  useEffect(() => { setMontoNuevo(Math.max(0, Math.round(saldo))) }, [saldo])

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
    setError(null)
    const pr = prestadores.find(p => p.id === prestadorWalkin)
    setLineas(ls => [...ls, {
      uid: uid(), tipo: 'SERVICIO', id_servicio: s.id, id_prestador: prestadorWalkin,
      nombre_prestador: pr?.nombre, descripcion: s.nombre, cantidad: 1,
      precio_unitario_neto: s.valor, descuento: 0, aplica_iva: s.aplica_iva,
    }])
  }

  const agregarProducto = (p: ItemCatalogo) => {
    setLineas(ls => {
      const ya = ls.find(l => l.tipo === 'PRODUCTO' && l.id_producto === p.id)
      if (ya) return ls.map(l => l === ya ? { ...l, cantidad: l.cantidad + 1 } : l)
      return [...ls, {
        uid: uid(), tipo: 'PRODUCTO', id_producto: p.id, descripcion: p.nombre,
        cantidad: 1, precio_unitario_neto: p.valor, descuento: 0, aplica_iva: p.aplica_iva,
      }]
    })
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
    setClienteQuery(''); setClienteResultados([]); setEmitida(null); setError(null)
  }

  const seleccionarCliente = (c: ClienteBusqueda) => {
    setReceptor(c.nombre_cliente || '')
    setRut(c.rut ? formatearRut(c.rut) : '')
    setIdCliente(c.id_cliente)
    setClienteQuery(''); setClienteResultados([])
  }

  // ── Pagos ───────────────────────────────────────────────────────────────
  // Varias modalidades por venta: el cajero ingresa el monto de cada pago.
  const agregarPago = () => {
    const monto = Math.round(montoNuevo)
    if (!monto || monto <= 0) return
    if (medioNuevo === 'EFECTIVO') {
      const { redondeado, ajuste } = redondearEfectivo(monto)
      setPagos(ps => [...ps, { medio: 'EFECTIVO', monto: redondeado, ajuste_redondeo: ajuste }])
    } else {
      setPagos(ps => [...ps, { medio: medioNuevo, monto }])
    }
  }

  // ── Emitir ──────────────────────────────────────────────────────────────
  const emitir = async () => {
    if (!empresaId || !sucursalId || lineas.length === 0) return
    if (rut && !validarRut(rut)) { setError('El RUT del cliente no es válido.'); return }
    if (!cubierto) { setError('Los pagos deben cubrir el total de la venta.'); return }
    setOcupado(true); setError(null)
    try {
      const res = await emitirVenta(empresaId, sucursalId, lineas, {
        idCliente,
        rutReceptor: rut ? limpiarRut(rut) : null,
        nombreReceptor: receptor || null,
        pagos,
      })
      setEmitida(res)
      setLineas([]); setPagos([]); setReceptor(''); setRut(''); setIdCliente(null); setClienteQuery('')
      recargarAgendaYVentas()
    } catch (e: any) {
      setError(e.message ?? 'No se pudo emitir la venta')
    } finally { setOcupado(false) }
  }

  const anular = async (v: VentaResumen) => {
    const motivo = window.prompt(`Anular la venta N° ${v.numero} por ${money(v.total)}.\nMotivo:`)
    if (motivo === null) return
    try {
      await anularVenta(v.id_venta, motivo || undefined)
      recargarAgendaYVentas()
    } catch (e: any) { setError(e.message ?? 'No se pudo anular') }
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

      {emitida && (
        <div className="pos-ok">
          <div>
            <strong>Venta N° {emitida.numero} emitida</strong>
            <div className="pos-ok-sub">
              Neto {money(emitida.neto)} · IVA ({emitida.tasa_iva}%) {money(emitida.iva)} · Total <b>{money(emitida.total)}</b>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pos-btn" onClick={() => window.print()}>Imprimir</button>
            <button className="pos-btn pos-btn--primary" onClick={() => setEmitida(null)}>Nueva venta</button>
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
              <input className="pos-input" placeholder="Nombre del cliente (opcional)"
                value={receptor} onChange={e => { setReceptor(e.target.value); setIdCliente(null) }} />
              <input className="pos-input" placeholder="RUT (opcional)"
                value={rut} onChange={e => { setRut(formatearRut(e.target.value)); setIdCliente(null) }} />
            </div>
            {rut.length > 0 && !validarRut(rut) && <div className="pos-cli-warn">RUT inválido</div>}
          </div>

          <div className="pos-tot">
            <div><span>Neto</span><b>{money(totales.neto)}</b></div>
            <div><span>IVA ({tasaIva}%)</span><b>{money(totales.iva)}</b></div>
            <div className="pos-tot-g"><span>Total</span><b>{money(totales.total)}</b></div>
          </div>

          {/* Pagos */}
          <div className="pos-pagos">
            {pagos.map((p, i) => (
              <div className="pos-pago" key={i}>
                <span>{MEDIOS.find(m => m.value === p.medio)?.label}</span>
                <b>{money(p.monto)}</b>
                {!!p.ajuste_redondeo && <em title="Ley 20.956: efectivo al múltiplo de $10">
                  {p.ajuste_redondeo > 0 ? '+' : ''}{p.ajuste_redondeo}</em>}
                <button className="pos-x" onClick={() => setPagos(ps => ps.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            {lineas.length > 0 && saldo > 0 && (
              <div className="pos-pago-add">
                <select value={medioNuevo} onChange={e => setMedioNuevo(e.target.value as MedioPago)}>
                  {MEDIOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input className="pos-pago-monto" type="number" min="0" step="1"
                  value={montoNuevo || ''} onChange={e => setMontoNuevo(Number(e.target.value))} />
                <button className="pos-btn" onClick={agregarPago}>Agregar</button>
              </div>
            )}
            {lineas.length > 0 && saldo !== 0 && pagos.length > 0 && (
              <div className="pos-saldo">{saldo > 0 ? `Falta por pagar ${money(saldo)}` : `Vuelto ${money(-saldo)}`}</div>
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
                      <td><span className={'pos-pill ' + (v.estado === 'ANULADA' ? 'ca' : 'ok')}>{v.estado}</span></td>
                      <td>{v.estado === 'EMITIDA' &&
                        <button className="pos-link" onClick={() => anular(v)}>Anular</button>}</td>
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
.pos-saldo{font-size:10px;color:var(--color-warning);font-weight:600}
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
.pos-ok{background:var(--color-success-soft);border:1px solid var(--color-success);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.pos-ok strong{color:var(--color-success)}
.pos-ok-sub{font-size:10.5px;color:var(--color-ink-soft);margin-top:2px}
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
