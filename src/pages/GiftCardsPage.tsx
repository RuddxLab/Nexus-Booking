import { useEffect, useState } from 'react'
import { PageHeader } from '../components/Common/PageHeader'
import { SelectorFiltro } from '../components/Common/SelectorFiltro'
import { useFiltroEmpresa } from '../hooks/useFiltroEmpresa'
import { supabase } from '../services/supabaseClient'
import { emitirGiftCard } from '../services/ventasService'
import { enviarCorreoGiftCard } from '../services/correoService'
import type { GiftCard } from '../types'

const emailValido = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')
const hoy = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

/** Sugiere un código legible y difícil de repetir. */
function codigoSugerido() {
  const s = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `GC-${s}`
}

export function GiftCardsPage() {
  const filtro = useFiltroEmpresa()
  const { empresaId } = filtro

  const [cards, setCards] = useState<GiftCard[]>([])
  const [codigo, setCodigo] = useState(codigoSugerido())
  const [monto, setMonto] = useState<number>(0)
  const [vence, setVence] = useState('')
  const [obs, setObs] = useState('')
  const [remitente, setRemitente] = useState('')
  const [correo, setCorreo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = () => {
    if (!empresaId) return
    supabase.from('gift_cards')
      .select('id_gift_card, id_empresa, codigo, saldo_inicial, saldo, id_cliente, fecha_vencimiento, activo, observaciones')
      .eq('id_empresa', empresaId)
      .order('id_gift_card', { ascending: false })
      .limit(100)
      .then(({ data }) => setCards((data ?? []) as GiftCard[]))
  }
  useEffect(cargar, [empresaId]) // eslint-disable-line

  const emitir = async () => {
    if (!empresaId) return
    if (!codigo.trim()) { setError('La gift card necesita un código'); return }
    if (!monto || monto <= 0) { setError('El monto debe ser mayor a cero'); return }
    if (!remitente.trim()) { setError('Indica el nombre de quien envía'); return }
    if (!correo.trim() || !emailValido(correo)) { setError('Ingresa un correo válido del destinatario'); return }
    setOcupado(true); setError(null); setAviso(null)
    try {
      const r = await emitirGiftCard(empresaId, codigo.trim(), Math.round(monto), {
        vencimiento: vence || null,
        observaciones: obs || null,
        correoDestinatario: correo.trim(),
        nombreRemitente: remitente.trim(),
      })
      // Envío del correo al destinatario (no bloquea la emisión si falla).
      const nombreEmpresa = filtro.empresas.find(e => e.id_empresa === empresaId)?.nombre_empresa
      const correoRes = await enviarCorreoGiftCard({
        email: correo.trim(),
        nombre_remitente: remitente.trim(),
        valor: r.saldo,
        codigo: r.codigo,
        observaciones: obs || null,
        fecha_vencimiento: vence || null,
        nombre_empresa: nombreEmpresa,
      })
      setAviso(correoRes.ok
        ? `Gift card ${r.codigo} emitida por ${money(r.saldo)}. Correo enviado a ${correo.trim()}.`
        : `Gift card ${r.codigo} emitida por ${money(r.saldo)}, pero no se pudo enviar el correo (${correoRes.error ?? 'error'}).`)
      setCodigo(codigoSugerido()); setMonto(0); setVence(''); setObs(''); setRemitente(''); setCorreo('')
      cargar()
    } catch (e: any) {
      setError(e.message ?? 'No se pudo emitir la gift card')
    } finally { setOcupado(false) }
  }

  const desactivar = async (g: GiftCard) => {
    if (!window.confirm(`¿Desactivar la gift card ${g.codigo}? Su saldo de ${money(g.saldo)} dejará de poder usarse.`)) return
    await supabase.from('gift_cards').update({ activo: false }).eq('id_gift_card', g.id_gift_card)
    cargar()
  }

  const vencida = (g: GiftCard) => !!g.fecha_vencimiento && g.fecha_vencimiento < hoy()

  return (
    <div className="gcx">
      <style>{CSS}</style>
      <PageHeader titulo="Gift Cards" />

      <SelectorFiltro
        esAdmin={filtro.esAdmin} esSupervisor={filtro.esSupervisor}
        empresas={filtro.empresas} sucursalesDeEmpresa={filtro.sucursalesDeEmpresa}
        empresaId={empresaId} sucursalId={filtro.sucursalId}
        onEmpresaChange={filtro.setEmpresaId} onSucursalChange={filtro.setSucursalId}
        mostrarSucursal={false}
      />

      {error && <div className="gc-error">{error}</div>}
      {aviso && <div className="gc-ok">{aviso}</div>}

      <section className="gc-card">
        <div className="gc-card-t">Emitir gift card</div>
        <p className="gc-nota">
          Una gift card es saldo prepagado: el dinero entra al emitirla y queda como
          deuda con el cliente hasta que la usa. En el punto de venta se cobra como
          medio de pago, no como descuento.
        </p>
        <div className="gc-form">
          <label>Código
            <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} />
          </label>
          <label>Monto
            <input type="number" min="0" step="1" value={monto || ''} onChange={e => setMonto(Number(e.target.value))} />
          </label>
          <label>Vence (opcional)
            <input type="date" value={vence} onChange={e => setVence(e.target.value)} />
          </label>
          <label>Quien envía
            <input value={remitente} onChange={e => setRemitente(e.target.value)} placeholder="Nombre del remitente" />
          </label>
          <label>Correo del destinatario
            <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="destinatario@correo.com" />
          </label>
          <label className="gc-wide">Observaciones (opcional)
            <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Mensaje que verá el destinatario" />
          </label>
        </div>
        <button className="gc-btn gc-btn--primary" onClick={emitir} disabled={ocupado || !empresaId}>
          {ocupado ? 'Emitiendo…' : `Emitir por ${money(monto)}`}
        </button>
      </section>

      <section className="gc-card">
        <div className="gc-card-t">Gift cards emitidas</div>
        {cards.length === 0
          ? <p className="gc-vacio">Todavía no hay gift cards emitidas</p>
          : (
            <div className="gc-tbl-wrap">
              <table className="gc-tbl">
                <thead><tr>
                  <th>Código</th><th className="r">Emitida por</th><th className="r">Saldo</th>
                  <th>Vence</th><th>Estado</th><th />
                </tr></thead>
                <tbody>
                  {cards.map(g => (
                    <tr key={g.id_gift_card} className={!g.activo || vencida(g) ? 'gc-inactiva' : ''}>
                      <td className="gc-cod">{g.codigo}</td>
                      <td className="r">{money(g.saldo_inicial)}</td>
                      <td className="r"><b>{money(g.saldo)}</b></td>
                      <td>{g.fecha_vencimiento ?? '—'}</td>
                      <td>
                        {!g.activo ? <span className="gc-pill off">Desactivada</span>
                          : vencida(g) ? <span className="gc-pill off">Vencida</span>
                          : g.saldo <= 0 ? <span className="gc-pill usada">Sin saldo</span>
                          : <span className="gc-pill ok">Disponible</span>}
                      </td>
                      <td>{g.activo && <button className="gc-link" onClick={() => desactivar(g)}>Desactivar</button>}</td>
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
.gcx{--mono:ui-monospace,"Cascadia Code","Consolas",monospace;padding:28px 32px;max-width:1400px}
.gcx *{box-sizing:border-box}
.gc-card{background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);box-shadow:var(--shadow-card);padding:18px 20px;margin-bottom:16px}
.gc-card-t{font-size:14px;font-weight:700;color:var(--color-ink);margin-bottom:8px}
.gc-nota{font-size:12px;color:var(--color-ink-soft);margin:0 0 14px;max-width:70ch;line-height:1.5}
.gc-form{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}
.gc-wide{grid-column:1 / -1}
@media(max-width:760px){.gc-form{grid-template-columns:1fr}}
.gc-form label{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600;color:var(--color-ink-soft)}
.gc-form input{padding:8px 11px;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-bg);color:var(--color-ink);font:inherit;font-size:13px}
.gc-btn{padding:10px 18px;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-ink);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.gc-btn--primary{background:var(--color-primary);color:var(--color-primary-ink);border-color:var(--color-primary)}
.gc-btn:disabled{opacity:.45;cursor:default}
.gc-error{background:var(--color-danger-soft);color:var(--color-danger);padding:10px 14px;border-radius:var(--radius-sm);font-size:12px;margin-bottom:12px}
.gc-ok{background:var(--color-success-soft);color:var(--color-success);padding:10px 14px;border-radius:var(--radius-sm);font-size:12px;font-weight:600;margin-bottom:12px}
.gc-vacio{color:var(--color-ink-soft);font-size:12px;text-align:center;padding:24px;margin:0}
.gc-tbl-wrap{overflow-x:auto}
.gc-tbl{width:100%;border-collapse:collapse;font-size:12px}
.gc-tbl th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--color-ink-soft);font-weight:600;padding:0 9px 9px}
.gc-tbl th.r,.gc-tbl td.r{text-align:right;font-family:var(--mono)}
.gc-tbl td{padding:9px;border-top:1px solid var(--color-border);color:var(--color-ink)}
.gc-cod{font-family:var(--mono);font-weight:700}
.gc-inactiva{opacity:.5}
.gc-pill{font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px}
.gc-pill.ok{background:var(--color-success-soft);color:var(--color-success)}
.gc-pill.off{background:var(--color-danger-soft);color:var(--color-danger)}
.gc-pill.usada{background:var(--color-bg);color:var(--color-ink-soft)}
.gc-link{border:0;background:transparent;color:var(--color-danger);font:inherit;font-size:11.5px;cursor:pointer;text-decoration:underline}
`
