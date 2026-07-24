import { useEffect, useState } from 'react'
import { PageHeader } from '../components/Common/PageHeader'
import { SelectorFiltro } from '../components/Common/SelectorFiltro'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import {
  previsualizarComisiones, generarLiquidacion, revertirLiquidacion,
  listLiquidaciones, listPrestadoresEmpresa,
  type ComisionPendiente, type Liquidacion, type PrestadorOpcion,
} from '../services/liquidacionService'

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')
const hoy = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

export function LiquidacionesPage() {
  const filtro = useFiltroEmpresa()
  const { empresaId } = filtro

  const [desde, setDesde] = useState(hoy())
  const [hasta, setHasta] = useState(hoy())
  const [idPrestador, setIdPrestador] = useState<number | null>(null)
  const [idSucursal, setIdSucursal] = useState<number | null>(null)
  const [prestadores, setPrestadores] = useState<PrestadorOpcion[]>([])

  const [pendientes, setPendientes] = useState<ComisionPendiente[] | null>(null)
  // Prestador elegido para liquidar, en espera de confirmación (muestra el resumen).
  const [porGenerar, setPorGenerar] = useState<ComisionPendiente | null>(null)
  const [hist, setHist] = useState<Liquidacion[]>([])

  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!empresaId) return
    listPrestadoresEmpresa(empresaId).then(setPrestadores).catch(() => setPrestadores([]))
    cargarHist()
    setPendientes(null); setAviso(null); setIdSucursal(null)
  }, [empresaId]) // eslint-disable-line

  const cargarHist = () => {
    if (!empresaId) return
    listLiquidaciones(empresaId).then(setHist).catch(() => setHist([]))
  }

  const previsualizar = async () => {
    if (!empresaId) return
    if (desde > hasta) { setError('El rango de fechas es inválido'); return }
    setOcupado(true); setError(null); setAviso(null); setPorGenerar(null)
    try {
      const r = await previsualizarComisiones(empresaId, desde, hasta, idPrestador, idSucursal)
      setPendientes(r)
    } catch (e: any) {
      setError(e.message ?? 'No se pudieron cargar las comisiones')
    } finally { setOcupado(false) }
  }

  // Paso 2: confirmar la generación del prestador elegido en `porGenerar`.
  const confirmarGenerar = async () => {
    if (!empresaId || !porGenerar) return
    const p = porGenerar
    setOcupado(true); setError(null); setAviso(null)
    try {
      const r = await generarLiquidacion(empresaId, p.id_prestador, desde, hasta, idSucursal)
      setAviso(`Liquidación #${r.id_liquidacion} generada para ${p.nombre_prestador}: ${money(r.total_comision)} (${r.cantidad_items} ítems).`)
      setPorGenerar(null)
      await previsualizar()
      cargarHist()
    } catch (e: any) {
      setError(e.message ?? 'No se pudo generar la liquidación')
    } finally { setOcupado(false) }
  }

  const revertir = async (l: Liquidacion) => {
    if (!window.confirm(`¿Revertir la liquidación #${l.id_liquidacion} de ${l.nombre_prestador}? Sus comisiones volverán a quedar pendientes.`)) return
    setOcupado(true); setError(null); setAviso(null)
    try {
      await revertirLiquidacion(l.id_liquidacion)
      setAviso(`Liquidación #${l.id_liquidacion} revertida.`)
      cargarHist()
      if (pendientes) previsualizar()
    } catch (e: any) {
      setError(e.message ?? 'No se pudo revertir')
    } finally { setOcupado(false) }
  }

  const totalPend = (pendientes ?? []).reduce((a, p) => a + p.total_comision, 0)
  const nombreSucursalSel = idSucursal
    ? (filtro.sucursalesDeEmpresa.find(s => s.id_sucursal === idSucursal)?.nombre_sucursal ?? '—')
    : 'Todas'

  return (
    <div className="lqx">
      <style>{CSS}</style>
      <PageHeader titulo="Liquidación de comisiones" />

      <SelectorFiltro
        esAdmin={filtro.esAdmin} esSupervisor={filtro.esSupervisor}
        empresas={filtro.empresas} sucursalesDeEmpresa={filtro.sucursalesDeEmpresa}
        empresaId={empresaId} sucursalId={filtro.sucursalId}
        onEmpresaChange={filtro.setEmpresaId} onSucursalChange={filtro.setSucursalId}
        mostrarSucursal={false}
      />

      {error && <div className="lq-error">{error}</div>}
      {aviso && <div className="lq-ok">{aviso}</div>}

      <section className="lq-card">
        <div className="lq-card-t">Comisiones pendientes</div>
        <div className="lq-form">
          <label>Desde
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </label>
          <label>Hasta
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </label>
          <label>Sucursal (opcional)
            <select value={idSucursal ?? ''} onChange={e => setIdSucursal(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Todas</option>
              {filtro.sucursalesDeEmpresa.map(s => <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre_sucursal}</option>)}
            </select>
          </label>
          <label>Prestador (opcional)
            <select value={idPrestador ?? ''} onChange={e => setIdPrestador(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Todos</option>
              {prestadores.map(p => <option key={p.id_prestador} value={p.id_prestador}>{p.nombre_prestador}</option>)}
            </select>
          </label>
          <div className="lq-form-actions">
            <button className="lq-btn" onClick={() => { setDesde(hoy()); setHasta(hoy()) }}>Hoy</button>
            <button className="lq-btn lq-btn--primary" onClick={previsualizar} disabled={ocupado || !empresaId}>
              {ocupado ? 'Cargando…' : 'Previsualizar'}
            </button>
          </div>
        </div>

        {pendientes && (
          pendientes.length === 0
            ? <p className="lq-vacio">No hay comisiones pendientes en el rango indicado.</p>
            : (
              <div className="lq-tbl-wrap">
                <table className="lq-tbl">
                  <thead><tr>
                    <th>Prestador</th><th className="r">Ítems</th><th className="r">Comisión</th><th />
                  </tr></thead>
                  <tbody>
                    {pendientes.map(p => (
                      <tr key={p.id_prestador}>
                        <td>{p.nombre_prestador}</td>
                        <td className="r">{p.cantidad_items}</td>
                        <td className="r"><b>{money(p.total_comision)}</b></td>
                        <td className="r">
                          <button className="lq-link" onClick={() => setPorGenerar(p)} disabled={ocupado}>Generar</button>
                        </td>
                      </tr>
                    ))}
                    <tr className="lq-total">
                      <td>Total</td><td /><td className="r"><b>{money(totalPend)}</b></td><td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )
        )}

        {porGenerar && (
          <div className="lq-confirm">
            <div className="lq-confirm-t">Revisa antes de generar la liquidación</div>
            <div className="lq-confirm-body">
              <div><span>Prestador</span><b>{porGenerar.nombre_prestador}</b></div>
              <div><span>Sucursal</span><b>{nombreSucursalSel}</b></div>
              <div><span>Período</span><b>{desde} → {hasta}</b></div>
              <div><span>Ítems</span><b>{porGenerar.cantidad_items}</b></div>
              <div><span>Comisión a liquidar</span><b>{money(porGenerar.total_comision)}</b></div>
            </div>
            <p className="lq-confirm-note">
              Al confirmar, estas comisiones quedan marcadas como liquidadas y no se vuelven a
              incluir en otra liquidación. Es reversible por admin o supervisor.
            </p>
            <div className="lq-confirm-actions">
              <button className="lq-btn" onClick={() => setPorGenerar(null)} disabled={ocupado}>Cancelar</button>
              <button className="lq-btn lq-btn--primary" onClick={confirmarGenerar} disabled={ocupado}>
                {ocupado ? 'Generando…' : 'Confirmar y generar'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="lq-card">
        <div className="lq-card-t">Liquidaciones generadas</div>
        {hist.length === 0
          ? <p className="lq-vacio">Todavía no hay liquidaciones.</p>
          : (
            <div className="lq-tbl-wrap">
              <table className="lq-tbl">
                <thead><tr>
                  <th>#</th><th>Prestador</th><th>Sucursal</th><th>Período</th><th className="r">Ítems</th>
                  <th className="r">Comisión</th><th>Estado</th><th />
                </tr></thead>
                <tbody>
                  {hist.map(l => (
                    <tr key={l.id_liquidacion} className={l.estado === 'ANULADA' ? 'lq-anulada' : ''}>
                      <td>{l.id_liquidacion}</td>
                      <td>{l.nombre_prestador}</td>
                      <td>{l.nombre_sucursal ?? 'Todas'}</td>
                      <td>{l.fecha_desde} → {l.fecha_hasta}</td>
                      <td className="r">{l.cantidad_items}</td>
                      <td className="r"><b>{money(l.total_comision)}</b></td>
                      <td>{l.estado === 'GENERADA'
                        ? <span className="lq-pill ok">Generada</span>
                        : <span className="lq-pill off">Anulada</span>}</td>
                      <td className="r">{l.estado === 'GENERADA' &&
                        <button className="lq-link danger" onClick={() => revertir(l)} disabled={ocupado}>Revertir</button>}</td>
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
.lqx{--mono:ui-monospace,"Cascadia Code","Consolas",monospace;padding:28px 32px;max-width:1200px}
.lqx *{box-sizing:border-box}
.lq-card{background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);box-shadow:var(--shadow-card);padding:18px 20px;margin-bottom:16px}
.lq-card-t{font-size:14px;font-weight:700;color:var(--color-ink);margin-bottom:12px}
.lq-form{display:grid;grid-template-columns:repeat(4,1fr) auto;gap:12px;align-items:end;margin-bottom:14px}
@media(max-width:900px){.lq-form{grid-template-columns:1fr 1fr}}
.lq-form label{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600;color:var(--color-ink-soft)}
.lq-form input,.lq-form select{padding:8px 11px;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-bg);color:var(--color-ink);font:inherit;font-size:13px}
.lq-form-actions{display:flex;gap:8px}
.lq-btn{padding:9px 16px;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-ink);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.lq-btn--primary{background:var(--color-primary);color:var(--color-primary-ink);border-color:var(--color-primary)}
.lq-btn:disabled{opacity:.45;cursor:default}
.lq-error{background:var(--color-danger-soft);color:var(--color-danger);padding:10px 14px;border-radius:var(--radius-sm);font-size:12px;margin-bottom:12px}
.lq-ok{background:var(--color-success-soft);color:var(--color-success);padding:10px 14px;border-radius:var(--radius-sm);font-size:12px;font-weight:600;margin-bottom:12px}
.lq-vacio{color:var(--color-ink-soft);font-size:12px;text-align:center;padding:20px;margin:0}
.lq-tbl-wrap{overflow-x:auto}
.lq-tbl{width:100%;border-collapse:collapse;font-size:12px}
.lq-tbl th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--color-ink-soft);font-weight:600;padding:0 9px 9px}
.lq-tbl th.r,.lq-tbl td.r{text-align:right;font-family:var(--mono)}
.lq-tbl td{padding:9px;border-top:1px solid var(--color-border);color:var(--color-ink)}
.lq-total td{border-top:2px solid var(--color-border);font-weight:700}
.lq-confirm{margin-top:16px;border:1px solid var(--color-primary);border-radius:var(--radius-sm);background:var(--color-bg);padding:14px 16px}
.lq-confirm-t{font-size:13px;font-weight:700;color:var(--color-ink);margin-bottom:10px}
.lq-confirm-body{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;margin-bottom:10px}
@media(max-width:560px){.lq-confirm-body{grid-template-columns:1fr}}
.lq-confirm-body>div{display:flex;justify-content:space-between;font-size:13px;color:var(--color-ink);border-bottom:1px solid var(--color-border);padding-bottom:6px}
.lq-confirm-body span{color:var(--color-ink-soft)}
.lq-confirm-body b{font-family:var(--mono)}
.lq-confirm-note{font-size:11.5px;color:var(--color-ink-soft);line-height:1.5;margin:0 0 12px}
.lq-confirm-actions{display:flex;gap:8px;justify-content:flex-end}
.lq-anulada{opacity:.5}
.lq-pill{font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px}
.lq-pill.ok{background:var(--color-success-soft);color:var(--color-success)}
.lq-pill.off{background:var(--color-bg);color:var(--color-ink-soft)}
.lq-link{border:0;background:transparent;color:var(--color-primary);font:inherit;font-size:11.5px;cursor:pointer;text-decoration:underline;font-weight:600}
.lq-link.danger{color:var(--color-danger)}
.lq-link:disabled{opacity:.45;cursor:default}
`
