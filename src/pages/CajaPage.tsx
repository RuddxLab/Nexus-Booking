import { useEffect, useState } from 'react'
import { PageHeader } from '../components/Common/PageHeader'
import { SelectorFiltro } from '../components/Common/SelectorFiltro'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import {
  sucursalUsaCaja, getCajaAbierta, getCualquierCajaAbierta, abrirCaja, cerrarCaja, resumenCaja, listCajas,
  type CajaAbierta, type TotalesCierre, type ResultadoCierre, type CajaHistorial,
} from '../services/cajaService'
import { enviarCorreoCierreCaja } from '../services/correoService'

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')
const fmt = (ts: string | null) => ts
  ? new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ts))
  : '—'

const MEDIOS: Record<string, string> = {
  EFECTIVO: 'Efectivo', DEBITO: 'Débito', CREDITO: 'Crédito',
  TRANSFERENCIA: 'Transferencia', GIFTCARD: 'Gift card', OTRO: 'Otro',
}

export function CajaPage() {
  const filtro = useFiltroEmpresa()
  const { empresaId, sucursalId } = filtro

  const [usaCaja, setUsaCaja]   = useState<boolean | null>(null)
  const [caja, setCaja]         = useState<CajaAbierta | null>(null)
  const [otraCaja, setOtraCaja] = useState<CajaAbierta | null>(null)
  const [hist, setHist]         = useState<CajaHistorial[]>([])
  const [cierre, setCierre]     = useState<ResultadoCierre | null>(null)
  // Resumen del día mostrado ANTES de confirmar el cierre.
  const [resumenPrevio, setResumenPrevio] = useState<TotalesCierre | null>(null)

  const [montoAp, setMontoAp] = useState<number>(0)
  const [obsAp, setObsAp]     = useState('')
  const [obsCierre, setObsCierre] = useState('')
  const [avisoCorreo, setAvisoCorreo] = useState<string | null>(null)

  const [error, setError]   = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = async () => {
    if (!empresaId || !sucursalId) return
    setError(null)
    const [u, c, otra, h] = await Promise.all([
      sucursalUsaCaja(sucursalId),
      getCajaAbierta(empresaId, sucursalId),
      getCualquierCajaAbierta(),
      listCajas(empresaId, sucursalId),
    ])
    setUsaCaja(u); setCaja(c)
    // "otra caja" = una abierta que NO es la de esta sucursal
    setOtraCaja(otra && (!c || otra.id_caja !== c.id_caja) ? otra : null)
    setHist(h)
    setCierre(null); setResumenPrevio(null); setAvisoCorreo(null); setObsCierre('')
  }
  useEffect(() => { cargar() }, [empresaId, sucursalId]) // eslint-disable-line

  const abrir = async () => {
    if (!empresaId || !sucursalId) return
    setOcupado(true); setError(null)
    try {
      await abrirCaja(empresaId, sucursalId, Math.round(montoAp), obsAp || null)
      setMontoAp(0); setObsAp('')
      await cargar()
    } catch (e: any) {
      setError(e.message ?? 'No se pudo abrir la caja')
    } finally { setOcupado(false) }
  }

  // Paso 1: mostrar el resumen del día por forma de pago (sin cerrar todavía).
  const verResumen = async () => {
    if (!caja) return
    setOcupado(true); setError(null)
    try {
      const t = await resumenCaja(caja.id_caja)
      setResumenPrevio(t)
    } catch (e: any) {
      setError(e.message ?? 'No se pudo calcular el resumen')
    } finally { setOcupado(false) }
  }

  // Paso 2: confirmar el cierre definitivo (calcula, marca CERRADA y envía correo).
  const confirmarCierre = async () => {
    if (!caja) return
    setOcupado(true); setError(null); setAvisoCorreo(null)
    try {
      const r = await cerrarCaja(caja.id_caja, obsCierre || null)
      setCierre(r); setCaja(null); setResumenPrevio(null)
      const correo = await enviarCorreoCierreCaja(r.id_caja)
      setAvisoCorreo(correo.ok
        ? `Correo de cierre enviado (${correo.enviados ?? 0} destinatario${(correo.enviados ?? 0) === 1 ? '' : 's'}).`
        : `No se pudo enviar el correo de cierre (${correo.error ?? 'error'}).`)
      const h = await listCajas(empresaId!, sucursalId!)
      setHist(h)
    } catch (e: any) {
      setError(e.message ?? 'No se pudo cerrar la caja')
    } finally { setOcupado(false) }
  }

  // Bloque de totales del día, reutilizado en la previsualización y en el cierre.
  const Totales = ({ t }: { t: TotalesCierre }) => (
    <div className="cj-tot">
      <div className="cj-tot-row"><span>Monto de apertura</span><b>{money(t.monto_apertura)}</b></div>
      <div className="cj-tot-sub">Vendido hoy por forma de pago</div>
      {Object.keys(MEDIOS).filter(k => t.por_medio?.[k]).length === 0
        ? <div className="cj-tot-empty">Sin pagos registrados</div>
        : Object.keys(MEDIOS).filter(k => t.por_medio?.[k]).map(k => (
          <div className="cj-tot-row" key={k}><span>{MEDIOS[k]}</span><b>{money(t.por_medio[k])}</b></div>
        ))}
      <div className="cj-tot-row"><span>Ventas ({t.cantidad_ventas})</span><b>{money(t.total_ventas)}</b></div>
      <div className="cj-tot-row cj-tot-big"><span>Efectivo esperado en caja</span><b>{money(t.efectivo_esperado)}</b></div>
    </div>
  )

  return (
    <div className="cjx">
      <style>{CSS}</style>
      <PageHeader titulo="Caja" />

      <SelectorFiltro
        esAdmin={filtro.esAdmin} esSupervisor={filtro.esSupervisor}
        empresas={filtro.empresas} sucursalesDeEmpresa={filtro.sucursalesDeEmpresa}
        empresaId={empresaId} sucursalId={sucursalId}
        onEmpresaChange={filtro.setEmpresaId} onSucursalChange={filtro.setSucursalId}
        mostrarSucursal={true}
      />

      {error && <div className="cj-error">{error}</div>}

      {usaCaja === false && (
        <div className="cj-info">
          Esta sucursal no usa control de caja. Puedes activarlo en <b>Sucursales → Usa caja</b>.
        </div>
      )}

      {usaCaja && (
        <>
          {/* Caja abierta */}
          {caja && (
            <section className="cj-card">
              <div className="cj-head">
                <span className="cj-pill ok">Caja abierta</span>
                <span className="cj-since">desde {fmt(caja.fecha_apertura)}</span>
              </div>
              <div className="cj-grid">
                <div><span className="cj-lbl">Monto de apertura</span><b>{money(caja.monto_apertura)}</b></div>
              </div>
              {caja.observacion_apertura && <p className="cj-obs">“{caja.observacion_apertura}”</p>}

              {!resumenPrevio ? (
                <button className="cj-btn cj-btn--primary" onClick={verResumen} disabled={ocupado}>
                  {ocupado ? 'Calculando…' : 'Ver resumen del día y cerrar'}
                </button>
              ) : (
                <div className="cj-cierre">
                  <div className="cj-sub">Revisa el resumen del día antes de confirmar el cierre.</div>
                  <Totales t={resumenPrevio} />
                  <label className="cj-field">Observación de cierre (opcional)
                    <input value={obsCierre} onChange={e => setObsCierre(e.target.value)} placeholder="Diferencias, notas…" />
                  </label>
                  <div className="cj-acciones">
                    <button className="cj-btn" onClick={() => setResumenPrevio(null)} disabled={ocupado}>Cancelar</button>
                    <button className="cj-btn cj-btn--danger" onClick={confirmarCierre} disabled={ocupado}>
                      {ocupado ? 'Cerrando…' : 'Confirmar cierre'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Sin caja en esta sucursal */}
          {!caja && !cierre && (
            otraCaja ? (
              <div className="cj-info">
                Ya tienes una caja abierta en otra sucursal (abierta {fmt(otraCaja.fecha_apertura)}).
                Debes cerrarla antes de abrir una nueva.
              </div>
            ) : (
              <section className="cj-card">
                <div className="cj-card-t">Abrir caja</div>
                <div className="cj-form">
                  <label>Monto en efectivo inicial (opcional)
                    <input type="number" min="0" step="1" value={montoAp || ''} onChange={e => setMontoAp(Number(e.target.value))} placeholder="0" />
                  </label>
                  <label>Observación (opcional)
                    <input value={obsAp} onChange={e => setObsAp(e.target.value)} />
                  </label>
                </div>
                <button className="cj-btn cj-btn--primary" onClick={abrir} disabled={ocupado || !sucursalId}>
                  {ocupado ? 'Abriendo…' : 'Abrir caja'}
                </button>
              </section>
            )
          )}

          {/* Resultado del cierre recién hecho */}
          {cierre && (
            <section className="cj-card">
              <div className="cj-head">
                <span className="cj-pill off">Caja cerrada</span>
              </div>
              <Totales t={cierre} />
              {avisoCorreo && <div className="cj-ok">{avisoCorreo}</div>}
            </section>
          )}
        </>
      )}

      {/* Historial */}
      {usaCaja && hist.length > 0 && (
        <section className="cj-card">
          <div className="cj-card-t">Historial de cajas</div>
          <div className="cj-tbl-wrap">
            <table className="cj-tbl">
              <thead><tr>
                <th>#</th><th>Apertura</th><th>Cierre</th><th className="r">Apertura $</th>
                <th className="r">Ventas $</th><th>Estado</th>
              </tr></thead>
              <tbody>
                {hist.map(h => (
                  <tr key={h.id_caja}>
                    <td>{h.id_caja}</td>
                    <td>{fmt(h.fecha_apertura)}</td>
                    <td>{fmt(h.fecha_cierre)}</td>
                    <td className="r">{money(h.monto_apertura)}</td>
                    <td className="r">{h.totales_cierre ? money(h.totales_cierre.total_ventas) : '—'}</td>
                    <td>{h.estado === 'ABIERTA'
                      ? <span className="cj-pill ok">Abierta</span>
                      : <span className="cj-pill off">Cerrada</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

const CSS = `
.cjx{--mono:ui-monospace,"Cascadia Code","Consolas",monospace;padding:28px 32px;max-width:1100px}
.cjx *{box-sizing:border-box}
.cj-card{background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);box-shadow:var(--shadow-card);padding:18px 20px;margin-bottom:16px}
.cj-card-t{font-size:14px;font-weight:700;color:var(--color-ink);margin-bottom:12px}
.cj-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.cj-since{font-size:12px;color:var(--color-ink-soft)}
.cj-grid{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:8px}
.cj-grid>div{display:flex;flex-direction:column;gap:2px}
.cj-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--color-ink-soft);font-weight:600}
.cj-grid b{font-size:18px;color:var(--color-ink);font-family:var(--mono)}
.cj-obs{font-size:12px;color:var(--color-ink-soft);font-style:italic;margin:4px 0 12px}
.cj-cierre{margin-top:6px}
.cj-sub{font-size:12px;color:var(--color-ink-soft);margin-bottom:10px}
.cj-acciones{display:flex;gap:8px;margin-top:12px}
.cj-acciones .cj-btn{flex:1}
.cj-form{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:14px}
@media(max-width:640px){.cj-form{grid-template-columns:1fr}}
.cj-field,.cj-form label{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600;color:var(--color-ink-soft);margin-bottom:12px}
.cj-field input,.cj-form input{padding:8px 11px;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-bg);color:var(--color-ink);font:inherit;font-size:13px}
.cj-btn{padding:10px 18px;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-ink);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.cj-btn--primary{background:var(--color-primary);color:var(--color-primary-ink);border-color:var(--color-primary)}
.cj-btn--danger{background:var(--color-danger);color:#fff;border-color:var(--color-danger)}
.cj-btn:disabled{opacity:.45;cursor:default}
.cj-error{background:var(--color-danger-soft);color:var(--color-danger);padding:10px 14px;border-radius:var(--radius-sm);font-size:12px;margin-bottom:12px}
.cj-ok{background:var(--color-success-soft);color:var(--color-success);padding:10px 14px;border-radius:var(--radius-sm);font-size:12px;font-weight:600;margin-top:12px}
.cj-info{background:var(--color-bg);border:1px dashed var(--color-border);color:var(--color-ink-soft);padding:12px 14px;border-radius:var(--radius-sm);font-size:12.5px;margin-bottom:16px;line-height:1.5}
.cj-pill{font-size:10px;font-weight:700;padding:3px 10px;border-radius:999px}
.cj-pill.ok{background:var(--color-success-soft);color:var(--color-success)}
.cj-pill.off{background:var(--color-bg);color:var(--color-ink-soft)}
.cj-tot{border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:12px 14px;background:var(--color-bg)}
.cj-tot-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:var(--color-ink)}
.cj-tot-row b{font-family:var(--mono)}
.cj-tot-sub{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--color-ink-soft);font-weight:700;margin-top:8px;padding-top:8px;border-top:1px solid var(--color-border)}
.cj-tot-empty{font-size:12px;color:var(--color-ink-soft);padding:6px 0}
.cj-tot-big{margin-top:6px;padding-top:10px;border-top:2px solid var(--color-border);font-weight:700}
.cj-tot-big b{font-size:17px;color:var(--color-primary)}
.cj-tbl-wrap{overflow-x:auto}
.cj-tbl{width:100%;border-collapse:collapse;font-size:12px}
.cj-tbl th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--color-ink-soft);font-weight:600;padding:0 9px 9px}
.cj-tbl th.r,.cj-tbl td.r{text-align:right;font-family:var(--mono)}
.cj-tbl td{padding:9px;border-top:1px solid var(--color-border);color:var(--color-ink)}
`
