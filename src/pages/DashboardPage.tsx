import { useEffect, useMemo, useRef, useState } from 'react'
import { useUserRole } from '../hooks/useUserRole'
import { useEmpresasSucursales } from '../hooks/useEmpresasSucursales'
import { getDashboardResumen, type DashboardResumen } from '../services/dashboardService'

// ── Helpers ───────────────────────────────────────────────────────────────────
const REDUCE = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion:reduce)').matches

const fmt   = (n: number) => Math.round(n || 0).toLocaleString('es-CL')
const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')
const moneyK = (n: number) => (n >= 1_000_000 ? '$' + (n / 1e6).toFixed(1).replace('.', ',') + 'M'
  : n >= 1000 ? '$' + Math.round(n / 1000) + 'K' : '$' + Math.round(n || 0))

function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function rangoFechas(dias: number): { desde: string; hasta: string } {
  const hasta = new Date()
  const desde = new Date(); desde.setDate(hasta.getDate() - (dias - 1))
  return { desde: isoLocal(desde), hasta: isoLocal(hasta) }
}
function fechaCorta(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

// ── Animación de números ──────────────────────────────────────────────────────
function useCountUp(value: number, fmtFn: (n: number) => string) {
  const [txt, setTxt] = useState(() => fmtFn(value))
  const prev = useRef(value)
  useEffect(() => {
    if (REDUCE) { setTxt(fmtFn(value)); prev.current = value; return }
    const from = prev.current, to = value, t0 = performance.now(), dur = 700
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3)
      setTxt(fmtFn(from + (to - from) * e))
      if (p < 1) raf = requestAnimationFrame(step)
      else prev.current = to
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value]) // eslint-disable-line
  return txt
}

function Stat({ label, value, fmtFn, tone, sub }: {
  label: string; value: number; fmtFn: (n: number) => string
  tone: 'accent' | 'success' | 'danger' | 'warning' | 'ink'; sub?: string
}) {
  const txt = useCountUp(value, fmtFn)
  const col = tone === 'ink' ? 'var(--color-ink)' : `var(--color-${tone})`
  const bg  = tone === 'ink' ? 'var(--color-accent-soft)' : `var(--color-${tone}-soft)`
  return (
    <div className="dx-kpi">
      <div className="dx-kpi-top">
        <span className="dx-kpi-label">{label}</span>
        <span className="dx-kpi-dot" style={{ background: bg, color: col }} />
      </div>
      <div className="dx-kpi-val">{txt}</div>
      {sub && <div className="dx-kpi-sub">{sub}</div>}
    </div>
  )
}

// ── Barras horizontales ───────────────────────────────────────────────────────
function Bars({ items }: { items: { name: string; sub?: string; disp: string; frac: number; color?: string }[] }) {
  if (!items.length) return <Vacio texto="Sin datos en este período" />
  return (
    <div className="dx-bars">
      {items.map((it, i) => (
        <div className="dx-bar-row" key={i}>
          <div className="dx-bar-top">
            <span className="dx-bar-name">{it.name}{it.sub && <span className="dx-bar-sub">{it.sub}</span>}</span>
            <span className="dx-bar-val">{it.disp}</span>
          </div>
          <div className="dx-track">
            <div className="dx-fill" style={{
              width: REDUCE ? `${(it.frac * 100).toFixed(1)}%` : 0,
              background: it.color || 'var(--color-accent)',
              animation: REDUCE ? undefined : `dxgrow .9s cubic-bezier(.3,.8,.3,1) ${.05 * i}s forwards`,
              // @ts-ignore CSS var para el keyframe
              '--w': `${(it.frac * 100).toFixed(1)}%`,
            } as React.CSSProperties} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Donut ─────────────────────────────────────────────────────────────────────
const DONUT_COLORS = ['var(--color-accent)', 'var(--color-primary)', '#9A7BB0', '#C97F5A', '#5E93A8', '#B36A78']
function Donut({ segs, centro, sub }: { segs: { n: string; v: number; c?: string }[]; centro: string; sub: string }) {
  const total = segs.reduce((a, s) => a + s.v, 0)
  const [draw, setDraw] = useState(REDUCE)
  useEffect(() => { const t = setTimeout(() => setDraw(true), 40); return () => clearTimeout(t) }, [segs])
  const C = 2 * Math.PI * 62
  let off = 0
  if (total === 0) return <Vacio texto="Sin datos en este período" />
  return (
    <div className="dx-donut-row">
      <div className="dx-donut">
        <svg viewBox="0 0 150 150">
          {segs.map((s, i) => {
            const f = s.v / total, node = (
              <circle key={i} cx="75" cy="75" r="62" fill="none" strokeWidth="16" strokeLinecap="round"
                stroke={s.c || DONUT_COLORS[i % DONUT_COLORS.length]}
                strokeDasharray={draw ? `${(f * C - 4).toFixed(1)} ${C}` : `0 ${C}`}
                strokeDashoffset={(-off * C).toFixed(1)}
                style={{ transition: 'stroke-dasharray 1s cubic-bezier(.3,.8,.3,1)' }} />
            )
            off += f
            return node
          })}
        </svg>
        <div className="dx-donut-center"><div className="dx-donut-n">{centro}</div><div className="dx-donut-t">{sub}</div></div>
      </div>
      <div className="dx-legend">
        {segs.map((s, i) => (
          <div className="dx-lg" key={i}>
            <span className="dx-sw" style={{ background: s.c || DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span className="dx-lg-nm">{s.n}</span>
            <span className="dx-lg-ct">{fmt(s.v)}</span>
            <span className="dx-lg-pc">{Math.round(s.v / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Gráfico de área (tendencia) ───────────────────────────────────────────────
function Tendencia({ serie, desde, hasta }: { serie: DashboardResumen['serie']; desde: string; hasta: string }) {
  const puntos = useMemo(() => {
    const map = new Map(serie.map(s => [s.fecha, s]))
    const out: { fecha: string; ag: number; can: number }[] = []
    const [y0, m0, d0] = desde.split('-').map(Number)
    const [y1, m1, d1] = hasta.split('-').map(Number)
    const cur = new Date(y0, m0 - 1, d0), fin = new Date(y1, m1 - 1, d1)
    while (cur <= fin) {
      const iso = isoLocal(cur), r = map.get(iso)
      out.push({ fecha: iso, ag: r?.agendadas ?? 0, can: r?.canceladas ?? 0 })
      cur.setDate(cur.getDate() + 1)
    }
    return out
  }, [serie, desde, hasta])

  const pathRef = useRef<SVGPathElement>(null)
  useEffect(() => {
    const p = pathRef.current; if (!p || REDUCE) return
    const len = p.getTotalLength()
    p.style.transition = 'none'; p.style.strokeDasharray = String(len); p.style.strokeDashoffset = String(len)
    p.getBoundingClientRect()
    p.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.3,.8,.3,1)'; p.style.strokeDashoffset = '0'
  }, [puntos])

  if (!puntos.length || puntos.every(p => p.ag === 0 && p.can === 0)) return <Vacio texto="Sin agendamientos en este período" />
  const W = 640, H = 180, pad = 14
  const max = Math.max(1, ...puntos.map(p => Math.max(p.ag, p.can)))
  const x = (i: number) => pad + i / Math.max(1, puntos.length - 1) * (W - pad * 2)
  const y = (v: number) => H - 22 - v / max * (H - 40)
  const line = (key: 'ag' | 'can') => puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')
  const area = `${line('ag')} L${x(puntos.length - 1)},${H - 6} L${x(0)},${H - 6} Z`
  const every = Math.max(1, Math.floor(puntos.length / 6))
  return (
    <div>
      <svg className="dx-chart" viewBox="0 0 640 180" preserveAspectRatio="none">
        <defs><linearGradient id="dxArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity=".26" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient></defs>
        {[0, 1, 2, 3].map(g => <line key={g} x1={pad} x2={W - pad} y1={10 + g * (H - 30) / 3} y2={10 + g * (H - 30) / 3} stroke="var(--color-border)" opacity={g === 3 ? 0 : .6} />)}
        <path d={area} fill="url(#dxArea)" />
        <path d={line('can')} fill="none" stroke="var(--color-danger)" strokeWidth="1.6" strokeDasharray="4 4" opacity=".7" />
        <path ref={pathRef} d={line('ag')} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {puntos.map((p, i) => i % every === 0 && (
          <text key={i} x={x(i)} y={H - 3} textAnchor="middle" fontSize="10" fill="var(--color-ink-soft)" fontFamily="ui-monospace,monospace">{fechaCorta(p.fecha)}</text>
        ))}
      </svg>
      <div className="dx-chart-leg">
        <span><i style={{ borderTop: '2.5px solid var(--color-accent)' }} />Agendadas</span>
        <span><i style={{ borderTop: '2px dashed var(--color-danger)' }} />Canceladas</span>
      </div>
    </div>
  )
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function Heatmap({ celdas }: { celdas: DashboardResumen['heatmap'] }) {
  if (!celdas.length) return <Vacio texto="Sin datos de demanda en este período" />
  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const horas = Array.from(new Set(celdas.map(c => c.hora))).sort((a, b) => a - b)
  const hMin = Math.min(...horas), hMax = Math.max(...horas)
  const cols: number[] = []; for (let h = hMin; h <= hMax; h++) cols.push(h)
  const max = Math.max(1, ...celdas.map(c => c.n))
  const get = (dow: number, h: number) => celdas.find(c => c.dow === dow && c.hora === h)?.n ?? 0
  return (
    <div>
      <div className="dx-heat" style={{ gridTemplateColumns: `30px repeat(${cols.length}, 1fr)` }}>
        <span />{cols.map(h => <span key={h} className="dx-h-col">{String(h).padStart(2, '0')}</span>)}
        {dias.map((d, di) => (
          <span key={d} style={{ display: 'contents' }}>
            <span className="dx-h-lab">{d}</span>
            {cols.map((h, hi) => {
              const v = get(di + 1, h), a = v === 0 ? 0.05 : 0.12 + (v / max) * 0.88
              return <div key={h} className="dx-cell" title={`${d} ${String(h).padStart(2, '0')}:00 · ${v} reservas`}
                style={{ background: `rgba(200,164,106,${a.toFixed(2)})`, animation: REDUCE ? undefined : `dxfade .4s ease ${(di * cols.length + hi) * 0.006}s both` }} />
            })}
          </span>
        ))}
      </div>
      <div className="dx-heat-leg">Menos
        <span className="dx-scale">{[.12, .34, .56, .78, 1].map((o, i) => <i key={i} style={{ background: `rgba(200,164,106,${o})` }} />)}</span>Más</div>
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <div className="dx-vacio">{texto}</div>
}

// ── Página ────────────────────────────────────────────────────────────────────
type Tab = 'resumen' | 'ingresos' | 'prestadores' | 'sucursales' | 'clientes'
const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' }, { id: 'ingresos', label: 'Ingresos' },
  { id: 'prestadores', label: 'Prestadores' }, { id: 'sucursales', label: 'Sucursales' }, { id: 'clientes', label: 'Clientes' },
]
const CONSOLIDADO = -1

export function DashboardPage() {
  const { rol, idEmpresa, loading: loadingRol } = useUserRole()
  const { empresas } = useEmpresasSucursales()
  const esAdmin = rol === 'admin'

  const [tab, setTab] = useState<Tab>('resumen')
  const [dias, setDias] = useState(30)
  // scope: admin arranca en consolidado; supervisor/otros fijos a su empresa
  const [scope, setScope] = useState<number>(CONSOLIDADO)
  const [data, setData] = useState<DashboardResumen | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (!esAdmin && idEmpresa) setScope(idEmpresa) }, [esAdmin, idEmpresa])

  const { desde, hasta } = useMemo(() => rangoFechas(dias), [dias])

  useEffect(() => {
    if (loadingRol) return
    let vivo = true
    setCargando(true); setError(null)
    const idEmp = scope === CONSOLIDADO ? null : scope
    getDashboardResumen(desde, hasta, idEmp)
      .then(d => { if (vivo) setData(d) })
      .catch(e => { if (vivo) setError(e.message || 'Error al cargar') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [desde, hasta, scope, loadingRol])

  const k = data?.kpis
  const consolidado = scope === CONSOLIDADO && esAdmin
  const nombreEmpresa = empresas.find(e => e.id_empresa === scope)?.nombre_empresa

  const maxPrest = Math.max(1, ...(data?.por_prestador.map(p => p.agendadas) ?? [1]))
  const maxServ  = Math.max(1, ...(data?.por_servicio.map(s => s.cantidad) ?? [1]))
  const maxIngServ = Math.max(1, ...(data?.por_servicio.map(s => s.ingresos) ?? [1]))
  const maxIngSuc  = Math.max(1, ...(data?.por_sucursal.map(s => s.ingresos) ?? [1]))
  const maxEmp   = Math.max(1, ...(data?.por_empresa.map(e => e.agendadas) ?? [1]))

  return (
    <div className="dashx">
      <style>{CSS}</style>

      {/* Header */}
      <div className="dx-head">
        <div>
          <h1 className="dx-title">Panel</h1>
          <div className="dx-ctx">
            <span className="dx-live" />
            {consolidado ? `Consolidado · ${data?.empresas_visibles ?? 0} empresa(s)` : (nombreEmpresa || 'Tu empresa')}
            {' · '}{fechaCorta(desde)} – {fechaCorta(hasta)}
          </div>
        </div>
        <div className="dx-controls">
          {esAdmin && (
            <select className="dx-select" value={scope} onChange={e => setScope(Number(e.target.value))}>
              <option value={CONSOLIDADO}>Consolidado · todas</option>
              {empresas.map(e => <option key={e.id_empresa} value={e.id_empresa}>{e.nombre_empresa}</option>)}
            </select>
          )}
          <div className="dx-seg">
            {[7, 30, 90].map(d => (
              <button key={d} className={dias === d ? 'on' : ''} onClick={() => setDias(d)}>{d}d</button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dx-tabs">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {error && <div className="dx-error">No se pudo cargar el panel: {error}</div>}
      {cargando && !data && <div className="dx-loading">Cargando datos…</div>}

      {data && (
        <div className="dx-body" style={{ opacity: cargando ? .5 : 1 }}>
          {/* ── RESUMEN ── */}
          {tab === 'resumen' && (
            <>
              <div className="dx-kpis dx-c5">
                <Stat label="Agendamientos" value={k!.agendamientos} fmtFn={fmt} tone="accent" />
                <Stat label="Agendadas" value={k!.agendadas} fmtFn={fmt} tone="success" />
                <Stat label="Canceladas" value={k!.canceladas} fmtFn={fmt} tone="danger" />
                <Stat label="Tasa cancelación" value={k!.tasa_cancelacion} fmtFn={n => `${n.toFixed(1)}%`} tone="warning" />
                <Stat label="Ingresos est." value={k!.ingresos} fmtFn={money} tone="ink" />
              </div>
              <div className="dx-grid2">
                <Panel titulo="Agendamientos en el tiempo" sub={`Últimos ${dias} días`}>
                  <Tendencia serie={data.serie} desde={desde} hasta={hasta} />
                </Panel>
                {consolidado ? (
                  <Panel titulo="Ranking de empresas" sub="Comparativa">
                    <Bars items={data.por_empresa.map(e => ({ name: e.nombre, disp: fmt(e.agendadas), frac: e.agendadas / maxEmp, sub: moneyK(e.ingresos) }))} />
                  </Panel>
                ) : (
                  <Panel titulo="Estado de las citas" sub="Distribución del período">
                    <Bars items={[
                      { name: 'Agendadas', disp: fmt(k!.agendadas), frac: k!.agendamientos ? k!.agendadas / k!.agendamientos : 0, color: 'var(--color-success)' },
                      { name: 'Canceladas', disp: fmt(k!.canceladas), frac: k!.agendamientos ? k!.canceladas / k!.agendamientos : 0, color: 'var(--color-danger)' },
                    ]} />
                  </Panel>
                )}
              </div>
              <Panel titulo="Próximos agendamientos" sub="Actividad reciente">
                {data.proximos.length ? (
                  <div className="dx-tbl-wrap">
                    <table className="dx-tbl">
                      <thead><tr><th>Cliente</th><th>Servicio</th><th className="dx-hide">Prestador</th><th className="dx-hide">Sucursal</th><th>Cuándo</th></tr></thead>
                      <tbody>
                        {data.proximos.map((p, i) => (
                          <tr key={i}>
                            <td className="dx-nm">{p.nombre_cliente}</td>
                            <td className="dx-muted">{p.servicio || '—'}</td>
                            <td className="dx-hide">{p.prestador || '—'}</td>
                            <td className="dx-hide dx-muted">{p.sucursal || '—'}</td>
                            <td className="dx-when">{fechaCorta(p.fecha)} {p.hora_inicio?.slice(0, 5)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <Vacio texto="No hay próximos agendamientos" />}
              </Panel>
            </>
          )}

          {/* ── INGRESOS ── */}
          {tab === 'ingresos' && (
            <>
              <div className="dx-kpis dx-c3">
                <Stat label="Ingresos estimados" value={k!.ingresos} fmtFn={money} tone="success" sub="Solo citas agendadas" />
                <Stat label="Ticket promedio" value={k!.ticket_promedio} fmtFn={money} tone="ink" />
                <Stat label="Agendadas" value={k!.agendadas} fmtFn={fmt} tone="accent" />
              </div>
              <Panel titulo="Ingresos por servicio" sub="Qué genera más">
                <Bars items={[...data.por_servicio].sort((a, b) => b.ingresos - a.ingresos).map(s => ({ name: s.nombre || '—', disp: money(s.ingresos), frac: s.ingresos / maxIngServ }))} />
              </Panel>
              <Panel titulo="Ingresos por sucursal" sub="Aporte de cada local">
                <Bars items={[...data.por_sucursal].sort((a, b) => b.ingresos - a.ingresos).map(s => ({ name: s.nombre, disp: money(s.ingresos), frac: s.ingresos / maxIngSuc, color: 'var(--color-primary)' }))} />
              </Panel>
            </>
          )}

          {/* ── PRESTADORES ── */}
          {tab === 'prestadores' && (
            <>
              <div className="dx-kpis dx-c3">
                <Stat label="Prestadores con citas" value={data.por_prestador.length} fmtFn={fmt} tone="accent" />
                <Stat label="Top prestador" value={data.por_prestador[0]?.agendadas ?? 0} fmtFn={fmt} tone="success" sub={data.por_prestador[0]?.nombre} />
                <Stat label="Servicios distintos" value={data.por_servicio.length} fmtFn={fmt} tone="ink" />
              </div>
              <div className="dx-grid2">
                <Panel titulo="Ranking por agendamientos" sub="Citas atendidas">
                  <Bars items={data.por_prestador.map((p, i) => ({ name: `#${i + 1}  ${p.nombre}`, disp: fmt(p.agendadas), frac: p.agendadas / maxPrest, sub: moneyK(p.ingresos) }))} />
                </Panel>
                <Panel titulo="Servicios más solicitados" sub="Volumen por servicio">
                  <Bars items={[...data.por_servicio].sort((a, b) => b.cantidad - a.cantidad).map(s => ({ name: s.nombre || '—', disp: fmt(s.cantidad), frac: s.cantidad / maxServ }))} />
                </Panel>
              </div>
            </>
          )}

          {/* ── SUCURSALES ── */}
          {tab === 'sucursales' && (
            <>
              <div className="dx-grid2">
                <Panel titulo="Distribución" sub="Agendadas por sucursal">
                  <Donut segs={data.por_sucursal.map(s => ({ n: s.nombre, v: s.agendadas }))} centro={fmt(k!.agendadas)} sub="Agendadas" />
                </Panel>
                <Panel titulo="Comparativa de sucursales" sub="Rendimiento lado a lado">
                  {data.por_sucursal.length ? (
                    <div className="dx-tbl-wrap">
                      <table className="dx-tbl">
                        <thead><tr><th>Sucursal</th><th className="dx-r">Agendadas</th><th className="dx-r">Cancel.</th><th className="dx-r">Ingresos</th></tr></thead>
                        <tbody>
                          {data.por_sucursal.map(s => (
                            <tr key={s.id}>
                              <td className="dx-nm">{s.nombre}</td>
                              <td className="dx-r">{fmt(s.agendadas)}</td>
                              <td className="dx-r dx-muted">{fmt(s.canceladas)}</td>
                              <td className="dx-r">{moneyK(s.ingresos)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <Vacio texto="Sin datos" />}
                </Panel>
              </div>
              <Panel titulo="Demanda por hora" sub="Reservas por día y franja horaria">
                <Heatmap celdas={data.heatmap} />
              </Panel>
            </>
          )}

          {/* ── CLIENTES ── */}
          {tab === 'clientes' && (
            <>
              <div className="dx-kpis dx-c3">
                <Stat label="Clientes atendidos" value={k!.clientes} fmtFn={fmt} tone="accent" />
                <Stat label="Nuevos" value={k!.nuevos} fmtFn={fmt} tone="success" />
                <Stat label="Recurrentes" value={k!.recurrentes} fmtFn={fmt} tone="ink" />
              </div>
              <div className="dx-grid2">
                <Panel titulo="Nuevos vs. recurrentes" sub="Captación y retención">
                  <Donut segs={[{ n: 'Nuevos', v: k!.nuevos, c: 'var(--color-success)' }, { n: 'Recurrentes', v: k!.recurrentes, c: 'var(--color-accent)' }]}
                    centro={fmt(k!.clientes)} sub="Clientes" />
                </Panel>
                <Panel titulo="Distribución por sucursal" sub="Dónde reservan">
                  <Bars items={data.por_sucursal.map(s => ({ name: s.nombre, disp: fmt(s.agendadas), frac: s.agendadas / Math.max(1, ...data.por_sucursal.map(x => x.agendadas)), color: 'var(--color-primary)' }))} />
                </Panel>
              </div>
              <div className="dx-note">Nota: “nuevos” = clientes cuya primera cita cae dentro del período; “recurrentes” = ya tenían citas antes.</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Panel({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="dx-panel">
      <div className="dx-panel-hd"><div className="dx-panel-t">{titulo}</div>{sub && <div className="dx-panel-s">{sub}</div>}</div>
      {children}
    </section>
  )
}

// ── CSS (scoped a .dashx) ─────────────────────────────────────────────────────
const CSS = `
.dashx{--mono:ui-monospace,"Cascadia Code","Consolas",monospace}
.dashx *{box-sizing:border-box}
.dx-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.dx-title{margin:0;font-size:24px;font-weight:800;letter-spacing:-.03em;color:var(--color-ink)}
.dx-ctx{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--color-ink-soft);margin-top:3px}
.dx-live{width:7px;height:7px;border-radius:50%;background:var(--color-success);animation:dxpulse 2.4s infinite}
@keyframes dxpulse{0%{box-shadow:0 0 0 0 rgba(74,139,98,.4)}70%{box-shadow:0 0 0 7px rgba(74,139,98,0)}100%{box-shadow:0 0 0 0 rgba(74,139,98,0)}}
.dx-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dx-select{appearance:none;font:inherit;font-size:13px;font-weight:600;color:var(--color-ink);background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:8px 30px 8px 12px;cursor:pointer;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237A776E' stroke-width='2.4'><path d='M6 9l6 6 6-6'/></svg>");background-repeat:no-repeat;background-position:right 10px center}
.dx-seg{display:inline-flex;background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:3px}
.dx-seg button{border:0;background:transparent;color:var(--color-ink-soft);font:inherit;font-size:12.5px;font-weight:700;padding:6px 12px;border-radius:6px;cursor:pointer;transition:.15s}
.dx-seg button.on{background:var(--color-surface);color:var(--color-ink);box-shadow:var(--shadow-card)}
.dx-tabs{display:flex;gap:2px;border-bottom:1px solid var(--color-border);margin-bottom:20px;overflow-x:auto}
.dx-tabs button{position:relative;border:0;background:transparent;font:inherit;font-size:13.5px;font-weight:600;color:var(--color-ink-soft);padding:11px 15px;cursor:pointer;white-space:nowrap;transition:color .15s}
.dx-tabs button:hover{color:var(--color-ink)}
.dx-tabs button.on{color:var(--color-ink)}
.dx-tabs button.on::after{content:"";position:absolute;left:12px;right:12px;bottom:-1px;height:2.5px;border-radius:2px;background:var(--color-accent)}
.dx-body{display:flex;flex-direction:column;gap:18px;transition:opacity .2s}
.dx-kpis{display:grid;gap:14px}
.dx-c5{grid-template-columns:repeat(5,1fr)} .dx-c3{grid-template-columns:repeat(3,1fr)}
.dx-kpi{background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);box-shadow:var(--shadow-card);padding:15px 16px;transition:transform .2s,box-shadow .2s}
.dx-kpi:hover{transform:translateY(-3px);box-shadow:var(--shadow-elevated)}
.dx-kpi-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
.dx-kpi-label{font-size:11.5px;color:var(--color-ink-soft);font-weight:600}
.dx-kpi-dot{width:22px;height:22px;border-radius:7px}
.dx-kpi-val{font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:25px;font-weight:800;letter-spacing:-.02em;color:var(--color-ink);line-height:1}
.dx-kpi-sub{font-size:11px;color:var(--color-ink-soft);margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dx-grid2{display:grid;grid-template-columns:1.5fr 1fr;gap:18px}
.dx-panel{background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);box-shadow:var(--shadow-card);padding:18px 20px}
.dx-panel-hd{margin-bottom:16px}
.dx-panel-t{font-size:15px;font-weight:700;letter-spacing:-.02em;color:var(--color-ink)}
.dx-panel-s{font-size:12px;color:var(--color-ink-soft);margin-top:2px}
.dx-bars{display:flex;flex-direction:column;gap:13px}
.dx-bar-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;gap:10px}
.dx-bar-name{font-weight:600;font-size:13px;color:var(--color-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dx-bar-sub{font-size:11px;color:var(--color-ink-soft);margin-left:8px;font-weight:400}
.dx-bar-val{font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:700;font-size:13px;color:var(--color-ink);white-space:nowrap}
.dx-track{height:8px;border-radius:999px;background:var(--color-bg);overflow:hidden}
.dx-fill{height:100%;border-radius:999px}
@keyframes dxgrow{to{width:var(--w)}}
.dx-donut-row{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.dx-donut{width:150px;height:150px;flex:none;position:relative}
.dx-donut svg{width:150px;height:150px;transform:rotate(-90deg)}
.dx-donut-center{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
.dx-donut-n{font-family:var(--mono);font-size:23px;font-weight:800;color:var(--color-ink);line-height:1}
.dx-donut-t{font-size:10px;color:var(--color-ink-soft);text-transform:uppercase;letter-spacing:.1em;margin-top:3px}
.dx-legend{display:flex;flex-direction:column;gap:10px;flex:1;min-width:150px}
.dx-lg{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--color-ink)}
.dx-sw{width:10px;height:10px;border-radius:3px;flex:none}
.dx-lg-nm{font-weight:500}.dx-lg-ct{margin-left:auto;color:var(--color-ink-soft);font-size:12px;font-family:var(--mono)}
.dx-lg-pc{font-weight:700;font-family:var(--mono);width:42px;text-align:right}
.dx-chart{width:100%;height:180px;display:block}
.dx-chart-leg{display:flex;gap:16px;font-size:11.5px;color:var(--color-ink-soft);margin-top:8px}
.dx-chart-leg span{display:inline-flex;align-items:center;gap:6px}
.dx-chart-leg i{width:14px;height:0;display:inline-block}
.dx-heat{display:grid;gap:4px;align-items:center}
.dx-h-lab{font-size:10.5px;color:var(--color-ink-soft);text-align:right;padding-right:4px;font-family:var(--mono)}
.dx-h-col{font-size:9.5px;color:var(--color-ink-soft);text-align:center;font-family:var(--mono)}
.dx-cell{aspect-ratio:1;border-radius:5px;transition:transform .15s}
.dx-cell:hover{transform:scale(1.18);outline:2px solid var(--color-accent)}
@keyframes dxfade{from{opacity:0}to{opacity:1}}
.dx-heat-leg{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--color-ink-soft);margin-top:12px;justify-content:flex-end}
.dx-scale{display:flex;gap:3px}.dx-scale i{width:14px;height:10px;border-radius:3px;display:block}
.dx-tbl-wrap{overflow-x:auto}
.dx-tbl{width:100%;border-collapse:collapse;font-size:13px}
.dx-tbl th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--color-ink-soft);font-weight:600;padding:0 10px 10px}
.dx-tbl th.dx-r,.dx-tbl td.dx-r{text-align:right;font-family:var(--mono)}
.dx-tbl td{padding:10px;border-top:1px solid var(--color-border);color:var(--color-ink)}
.dx-tbl tbody tr{transition:background .15s}
.dx-tbl tbody tr:hover{background:var(--color-bg)}
.dx-nm{font-weight:600}.dx-muted{color:var(--color-ink-soft)}
.dx-when{font-family:var(--mono);font-size:12.5px;white-space:nowrap}
.dx-hide{}
.dx-vacio{padding:28px 10px;text-align:center;color:var(--color-ink-soft);font-size:13px}
.dx-note{font-size:11.5px;color:var(--color-ink-soft);padding:2px 4px}
.dx-loading,.dx-error{padding:28px;text-align:center;color:var(--color-ink-soft)}
.dx-error{color:var(--color-danger)}
@media (max-width:1100px){.dx-c5{grid-template-columns:repeat(3,1fr)}.dx-grid2{grid-template-columns:1fr}}
@media (max-width:720px){.dx-c5,.dx-c3{grid-template-columns:repeat(2,1fr)}.dx-hide{display:none}}
@media (prefers-reduced-motion:reduce){.dashx *{animation:none!important}}
`
