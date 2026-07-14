import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  listPrestadoresPublico,
  listServiciosPublico,
  listCategoriasPublico,
} from '../services/entityServices'
import { supabase } from '../services/supabaseClient'
import {
  listHorariosPrestador,
  listAusenciasPrestador,
  listHorasOcupadas,
  listPrestadorIdsDeServicio,
  crearReservaPublica,
  DobleReservaError,
} from '../services/disponibilidadService'
import { listDiasBloqueadosPorRango } from '../services/ausenciasService'
import { generarHorasDisponibles, diaISO } from '../utils/disponibilidad'
import { getMonthGrid, toISODate } from '../utils/calendarUtils'
import { validarEmail, formatearRut, validarRut, limpiarRut } from '../utils/validators'
import { enviarCorreoReserva } from '../services/correoService'
import { PAISES_TELEFONO, separarTelefono, armarTelefono, validarTelefono } from '../data/paisesTelefono'
import { TelefonoPicker } from '../components/Common/TelefonoPicker'
import { useTenant } from '../context/TenantContext'
import { ThemeToggle } from '../components/Common/ThemeToggle'
import type { PrestadorPublico, Servicio, Categoria } from '../types'

const NOMBRES_DIA_ISO    = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO']
const NOMBRES_DIA_CORTOS = ['Lu','Ma','Mi','Ju','Vi','Sa','Do']
const CLAVE_STORAGE = 'nexus-booking:datos-cliente'

interface DatosGuardados { nombre: string; rut: string; telefono: string; email: string }
function cargarDatos(): DatosGuardados | null {
  try { return JSON.parse(localStorage.getItem(CLAVE_STORAGE) ?? 'null') } catch { return null }
}
function guardarDatos(d: DatosGuardados) { localStorage.setItem(CLAVE_STORAGE, JSON.stringify(d)) }

export function ReservarPage() {
  const { tenant, loading: cargandoTenant, error: errorTenant, setSucursal } = useTenant()
  const [searchParams] = useSearchParams()
  const paramServicio    = searchParams.get('servicio') ? Number(searchParams.get('servicio')) : null
  const esReagendamiento = searchParams.get('reagendar') === '1'

  const [paso, setPaso]   = useState<0|1|2|3|4>(1)
  const [animDir, setAnimDir] = useState<'in'|'out'>('in')
  const [cargandoBase, setCargandoBase] = useState(true)

  const [servicios,   setServicios]   = useState<Servicio[]>([])
  const [categorias,  setCategorias]  = useState<Categoria[]>([])
  const [prestadores, setPrestadores] = useState<PrestadorPublico[]>([])

  const [servicioElegido,   setServicioElegido]   = useState<Servicio | null>(null)
  const [prestadorElegido,  setPrestadorElegido]  = useState<PrestadorPublico | null>(null)
  const [fechaElegida,      setFechaElegida]      = useState<string | null>(null)
  const [horaElegida,       setHoraElegida]       = useState<string | null>(null)
  const [busqueda,          setBusqueda]           = useState('')
  const [categoriasAbiertas, setCategoriasAbiertas] = useState<Set<number>>(new Set())
  const [idsPrestServ,      setIdsPrestServ]      = useState<number[] | null>(null)

  const [mesAnchor,        setMesAnchor]        = useState(new Date())
  const [diasDisponibles,  setDiasDisponibles]  = useState<Set<number>>(new Set())
  const [fechasBloqueadas, setFechasBloqueadas] = useState<Set<string>>(new Set())
  const [horasDelDia,      setHorasDelDia]      = useState<string[]>([])
  const [cargandoHoras,    setCargandoHoras]    = useState(false)

  const saved = useMemo(() => cargarDatos(), [])
  const [nombre,   setNombre]   = useState(saved?.nombre   ?? '')
  const [rut,      setRut]      = useState(saved?.rut      ?? '')
  const [telefono, setTelefono] = useState(saved?.telefono ?? armarTelefono('+56',''))
  const [email,    setEmail]    = useState(saved?.email    ?? '')
  const [error,    setError]    = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const confirmandoRef = React.useRef(false)
  const [reservado, setReservado] = useState(false)
  const [correoEnviado, setCorreoEnviado] = useState(true)
  const [ripple,   setRipple]   = useState<string | null>(null)

  const telSep = separarTelefono(telefono)
  const pais   = PAISES_TELEFONO.find(p => p.codigo === telSep.codigo)

  // Datos pre-rellenados desde localStorage (guardado al confirmar reserva anterior)

  // Cuando el tenant carga, decidir si mostrar selector de sucursal o cargar catálogo directo
  useEffect(() => {
    if (!tenant) return
    const { idEmpresa, sucursales, idSucursal } = tenant

    // Más de una sucursal → mostrar selector (paso 0), no cargar catálogo aún
    if (sucursales.length > 1) {
      setPaso(0)
      setCargandoBase(false)
      return
    }

    // Una sola sucursal → cargar catálogo directo filtrado por esa sucursal
    Promise.all([
      listServiciosPublico(idEmpresa),
      listCategoriasPublico(idEmpresa),
      listPrestadoresPublico(idEmpresa),
    ]).then(([servs, cats, prests]) => {
      const sa = servs.filter(s => s.activo && s.id_sucursal === idSucursal)
      setServicios(sa)
      setCategorias(cats.filter(c => c.activo && c.id_sucursal === idSucursal))
      setPrestadores(prests.filter(p => Number(p.reserva_online) === 1 && p.id_sucursal === idSucursal))
      if (paramServicio) {
        const sp = sa.find(s => s.id_servicio === paramServicio)
        if (sp) {
          listPrestadorIdsDeServicio(sp.id_servicio).then(ids => {
            setServicioElegido(sp); setIdsPrestServ(ids); setPaso(2)
          })
        }
      }
    }).finally(() => setCargandoBase(false))
  }, [tenant]) // eslint-disable-line

  const serviciosPorCat = useMemo(() => {
    const txt = busqueda.trim().toLowerCase()
    const fil = txt ? servicios.filter(s => s.nombre_servicio.toLowerCase().includes(txt)) : servicios
    const m = new Map<number, Servicio[]>()
    for (const s of fil) {
      const l = m.get(s.id_categoria) ?? []; l.push(s); m.set(s.id_categoria, l)
    }
    return m
  }, [servicios, busqueda])

  const prestFiltrados = useMemo(() =>
    idsPrestServ ? prestadores.filter(p => idsPrestServ.includes(p.id_prestador)) : prestadores
  , [prestadores, idsPrestServ])

  function irPaso(n: 0|1|2|3|4) {
    setAnimDir(n > paso ? 'in' : 'out')
    setPaso(n)
    // Si volvemos al paso de fecha/hora con fecha ya elegida, refrescar horas
    if (n === 3 && fechaElegida && prestadorElegido && servicioElegido) {
      const d = new Date(fechaElegida + 'T00:00:00')
      setCargandoHoras(true)
      Promise.all([
        listHorariosPrestador(prestadorElegido.id_prestador),
        listAusenciasPrestador(prestadorElegido.id_prestador),
        listHorasOcupadas(prestadorElegido.id_prestador, fechaElegida),
        listDiasBloqueadosPorRango(fechaElegida, fechaElegida, prestadorElegido.id_prestador),
      ]).then(([hor, aus, ocu, bloq]) => {
        const dNum = diaISO(d)
        const hDia = hor.find(h => h.dia === dNum && h.activo && h.hora_inicio && h.hora_fin)
        if (!hDia || bloq.some(b => !b.hora_inicio || !b.hora_fin)) { setHorasDelDia([]); return }
        const nombreDia = NOMBRES_DIA_ISO[dNum-1]
        const ausD = aus.filter(a => String(a.dia).trim().toUpperCase() === nombreDia || String(a.dia).trim() === String(dNum))
        const bloqP = bloq.filter(b => b.hora_inicio && b.hora_fin).map(b => ({ dia: String(dNum), hora_inicio: b.hora_inicio!, hora_fin: b.hora_fin! }))
        setHorasDelDia(generarHorasDisponibles({
          horaInicio: hDia.hora_inicio!, horaFin: hDia.hora_fin!,
          duracionMin: servicioElegido.duracion, fecha: fechaElegida,
          ocupados: ocu, ausencias: [...ausD, ...bloqP],
          pasoMin:   prestadorElegido.paso_agenda ?? undefined,
          bufferMin: prestadorElegido.buffer_min  ?? 0,
        }))
      }).finally(() => setCargandoHoras(false))
    }
  }

  function triggerRipple(id: string) {
    setRipple(id)
    setTimeout(() => setRipple(null), 400)
  }

  async function handleServicio(s: Servicio) {
    triggerRipple('s'+s.id_servicio)
    setServicioElegido(s); setPrestadorElegido(null)
    const ids = await listPrestadorIdsDeServicio(s.id_servicio)
    setIdsPrestServ(ids); irPaso(2)
  }

  async function handlePrestador(p: PrestadorPublico) {
    triggerRipple('p'+p.id_prestador)
    setPrestadorElegido(p); setFechaElegida(null); setHoraElegida(null); setMesAnchor(new Date())
    const hoy   = new Date()
    const desde = toISODate(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    const hasta = toISODate(new Date(hoy.getFullYear(), hoy.getMonth()+3, 0))
    const [hor, bloq] = await Promise.all([
      listHorariosPrestador(p.id_prestador),
      listDiasBloqueadosPorRango(desde, hasta, p.id_prestador),
    ])
    setDiasDisponibles(new Set(hor.filter(h => h.activo && h.hora_inicio && h.hora_fin).map(h => h.dia)))
    setFechasBloqueadas(new Set(bloq.filter(b => !b.hora_inicio || !b.hora_fin).map(b => b.fecha)))
    irPaso(3)
  }

  async function handleFecha(d: Date) {
    if (!prestadorElegido || !servicioElegido) return
    const iso = toISODate(d)
    setFechaElegida(iso); setHoraElegida(null); setCargandoHoras(true)
    try {
      const [hor, aus, ocu, bloq] = await Promise.all([
        listHorariosPrestador(prestadorElegido.id_prestador),
        listAusenciasPrestador(prestadorElegido.id_prestador),
        listHorasOcupadas(prestadorElegido.id_prestador, iso),
        listDiasBloqueadosPorRango(iso, iso, prestadorElegido.id_prestador),
      ])
      const dNum = diaISO(d)
      const hDia = hor.find(h => h.dia === dNum && h.activo && h.hora_inicio && h.hora_fin)
      if (!hDia || bloq.some(b => !b.hora_inicio || !b.hora_fin)) { setHorasDelDia([]); return }
      const nombreDia = NOMBRES_DIA_ISO[dNum-1]
      const ausD = aus.filter(a => String(a.dia).trim().toUpperCase() === nombreDia || String(a.dia).trim() === String(dNum))
      const bloqP = bloq.filter(b => b.hora_inicio && b.hora_fin).map(b => ({ dia: String(dNum), hora_inicio: b.hora_inicio!, hora_fin: b.hora_fin! }))
      setHorasDelDia(generarHorasDisponibles({
        horaInicio: hDia.hora_inicio!, horaFin: hDia.hora_fin!,
        duracionMin: servicioElegido.duracion, fecha: iso,
        ocupados: ocu, ausencias: [...ausD, ...bloqP],
        pasoMin:    prestadorElegido.paso_agenda  ?? undefined,
        bufferMin:  prestadorElegido.buffer_min   ?? 0,
      }))
    } finally { setCargandoHoras(false) }
  }

  async function handleConfirmar() {
    if (!tenant) return
    if (confirmandoRef.current) return  // prevenir doble tap en móvil
    confirmandoRef.current = true
    setError(null)
    if (!nombre.trim())              return setError('Tu nombre es obligatorio.')
    if (!email.trim() || !validarEmail(email)) return setError('Ingresa un correo válido.')
    if (!telSep.numero || !validarTelefono(telefono)) return setError(`Teléfono inválido para ${pais?.pais}.`)
    if (rut && !validarRut(rut))     return setError('El RUT no es válido.')
    if (!servicioElegido || !prestadorElegido || !fechaElegida || !horaElegida) return setError('Falta completar pasos anteriores.')
    setGuardando(true)
    try {
      const { id, token } = await crearReservaPublica({
        idEmpresa:      tenant.idEmpresa,
        idSucursal:     tenant.idSucursal,
        idPrestador:    prestadorElegido.id_prestador,
        idServicio:     servicioElegido.id_servicio,
        fecha:          fechaElegida,
        horaInicio:     horaElegida,
        nombreCliente:  nombre,
        telefono,
        email:          email.trim().toLowerCase(),
        rut: rut ? limpiarRut(rut) : null,
      })
      // Reserva guardada exitosamente — marcar como reservado ANTES de enviar correo
      guardarDatos({ nombre, rut, telefono, email: email.trim().toLowerCase() })
      setReservado(true)
      // Enviar correo en background (si falla no afecta la reserva)
      const [h, m] = horaElegida.split(':').map(Number)
      const t = h*60 + m + servicioElegido.duracion
      const horaFin = `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`
      enviarCorreoReserva({
        token, id_agendamiento: id, id_empresa: tenant.idEmpresa, id_sucursal: tenant.idSucursal,
        nombre_cliente: nombre, email: email.trim().toLowerCase(), telefono,
        nombre_prestador: prestadorElegido.nombre_prestador,
        nombre_servicio:  servicioElegido.nombre_servicio,
        duracion: servicioElegido.duracion, fecha: fechaElegida,
        hora_inicio: horaElegida, hora_fin: horaFin,
        slug: tenant.slug,
        color_primario:   tenant.configUI.color_primario,
        color_acento:     tenant.configUI.color_acento,
        color_fondo:      tenant.configUI.color_fondo,
        color_superficie: tenant.configUI.color_superficie,
        color_borde:      tenant.configUI.color_borde,
        color_texto:      tenant.configUI.color_texto,
      }).then(res => {
        if (!res?.ok) setCorreoEnviado(false)
      }).catch(() => setCorreoEnviado(false))
    } catch (err) {
      if (err instanceof DobleReservaError) {
        // Verificar si la reserva ya fue creada por este mismo cliente
        // (ocurre en móvil cuando la red es lenta)
        const { data: yaExiste } = await supabase
          .from('agendamientos')
          .select('id_agendamiento, token_cancelacion, email')
          .eq('id_empresa',   tenant.idEmpresa)
          .eq('id_prestador', prestadorElegido!.id_prestador)
          .eq('fecha',        fechaElegida!)
          .eq('hora_inicio',  horaElegida!)
          .neq('estado',      'CANCELADA')
          .maybeSingle()

        if (yaExiste) {
          // Comprobar si es del mismo cliente (por email, case-insensitive)
          const mismoCliente = yaExiste.email?.toLowerCase().trim() === email.toLowerCase().trim()
          if (mismoCliente) {
            // Es su propia reserva duplicada — mostrar confirmación
            guardarDatos({ nombre, rut, telefono, email })
            setReservado(true)
          } else {
            // Hora tomada por OTRO cliente — volver al paso de fecha/hora
            setError('Esa hora ya fue reservada por otra persona. Elige otro horario.')
            setHoraElegida(null)
            irPaso(3)
          }
        } else {
          // No encontramos la reserva — error genérico
          setError('No se pudo confirmar la reserva. Intenta de nuevo.')
        }
      } else {
        console.error('Error al crear reserva:', err)
        setError('No se pudo confirmar la reserva. Intenta de nuevo.')
      }
    } finally { setGuardando(false); confirmandoRef.current = false }
  }

  function reiniciar() {
    setServicioElegido(null); setPrestadorElegido(null); setFechaElegida(null)
    setHoraElegida(null); setReservado(false)
    irPaso(tenant && tenant.sucursales.length > 1 ? 0 : 1)
  }

  const diasGrilla = useMemo(() => getMonthGrid(mesAnchor), [mesAnchor])
  const mesNum     = mesAnchor.getMonth()
  const hoyISO     = toISODate(new Date())
  const fechaMaxISO = useMemo(() => {
    if (!prestadorElegido) return null
    const dias = prestadorElegido.dias_agenda ?? 30
    const max  = new Date()
    max.setDate(max.getDate() + dias)
    return toISODate(max)
  }, [prestadorElegido])
  const tieneSucursales = (tenant?.sucursales.length ?? 0) > 1
  const pasoLabel  = tieneSucursales
    ? ['Sede', 'Servicio','Profesional','Fecha & Hora','Tus datos']
    : ['Servicio','Profesional','Fecha & Hora','Tus datos']
  const stepLabels = tieneSucursales
    ? ['Sede', 'Servicio', 'Profesional', 'Fecha & Hora', 'Datos']
    : ['Servicio', 'Profesional', 'Fecha & Hora', 'Datos']
  // Índice visual del paso actual (0-based relativo a stepLabels)
  const pasoVisual = tieneSucursales ? paso : paso - 1
  if (cargandoTenant) return (
    <div className="rxp-shell">
      <div className="rxp-loader">
        <div className="rxp-loader-dot"/><div className="rxp-loader-dot"/><div className="rxp-loader-dot"/>
      </div>
    </div>
  )

  if (errorTenant || !tenant) return (
    <div className="rxp-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h2 style={{ marginBottom: 8, color: 'var(--rx-ink)' }}>Negocio no encontrado</h2>
        <p style={{ color: 'var(--rx-muted)' }}>Verifica el enlace que recibiste.</p>
      </div>
    </div>
  )

  if (cargandoBase) return (
    <div className="rxp-shell">
      <div className="rxp-loader">
        <div className="rxp-loader-dot"/><div className="rxp-loader-dot"/><div className="rxp-loader-dot"/>
      </div>
    </div>
  )

  const adminPath  = '/admin/login'

  // ── Estados de carga / error del tenant ───────────────────────────────────

  return (
    <div className="rxp-shell">

      {/* ── Topbar glassmorphism ── */}
      <div className="rxp-topbar">
        <div className="rxp-brand">
          <div className="rxp-brand-logo">{tenant.nombre.charAt(0).toUpperCase()}</div>
          <span className="rxp-brand-name">{tenant.nombre}</span>
          <span className="rxp-brand-tag">Reserva online</span>
        </div>
        <div className="rxp-steps">
          {stepLabels.map((l, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <div className={`rxp-step ${reservado || pasoVisual > i ? 'done' : pasoVisual === i ? 'active' : ''}`}>
                <div className="rxp-step-n">{reservado || pasoVisual > i ? '✓' : i+1}</div>
                <span>{l}</span>
              </div>
              {i < stepLabels.length - 1 && (
                <div className={`rxp-step-line ${reservado || pasoVisual > i ? 'done' : ''}`}/>
              )}
            </div>
          ))}
        </div>
        <ThemeToggle style={{ marginLeft: 12 }} />
      </div>

      {/* ── Mobile bar ── */}
      <div className="rxp-mobile-bar">
        <div className="rxp-mobile-steps">
          {stepLabels.map((l, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <div className={`rxp-mobile-step ${reservado || pasoVisual > i ? 'done' : pasoVisual === i ? 'active' : ''}`}>
                {reservado || pasoVisual > i ? '✓' : i+1}
              </div>
              {i < stepLabels.length - 1 && (
                <div className={`rxp-mobile-line ${reservado || pasoVisual > i ? 'done' : ''}`}/>
              )}
            </div>
          ))}
        </div>
        <div className="rxp-mobile-info">
          {servicioElegido  && <span>{servicioElegido.nombre_servicio}</span>}
          {prestadorElegido && <span> · {prestadorElegido.nombre_prestador}</span>}
          {fechaElegida && horaElegida && <span> · {horaElegida}</span>}
        </div>
        <Link to={adminPath} className="rxp-mobile-staff">Acceso staff →</Link>
      </div>

      <div className="rxp-body">
        {/* ── Aside glassmorphism ── */}
        <aside className="rxp-aside">
          <div>
            <div className="rxp-aside-title">{tenant.nombre}</div>
            <div className="rxp-aside-sub">Reserva online</div>
          </div>

          {reservado ? (
            <div className="rxp-aside-ok">
              <div className="rxp-check-ring">
                <svg viewBox="0 0 28 28"><path d="M6 14l6 6 10-10"/></svg>
              </div>
              <div className="rxp-aside-title">¡Reservado!</div>
              <div className="rxp-aside-sub">Te esperamos, {nombre.split(' ')[0]}.</div>
            </div>
          ) : (
            <>
              <div className="rxp-aside-steps">
                {pasoLabel.map((l, i) => (
                  <div key={i} className={`rxp-as ${pasoVisual === i ? 'active' : pasoVisual > i ? 'done' : ''}`}>
                    <div className="rxp-as-dot">{pasoVisual > i ? '✓' : i+1}</div>
                    <span>{l}</span>
                  </div>
                ))}
              </div>

              {servicioElegido && (
                <div className="rxp-summary">
                  <div className="rxp-sum-item">
                    <span style={{ fontSize: 12, opacity: .7 }}>✂</span>
                    <div>
                      <div className="rxp-sum-l">Servicio</div>
                      <div className="rxp-sum-v">{servicioElegido.nombre_servicio}</div>
                    </div>
                  </div>
                  {prestadorElegido && (
                    <div className="rxp-sum-item">
                      <span style={{ fontSize: 12, opacity: .7 }}>👤</span>
                      <div>
                        <div className="rxp-sum-l">Profesional</div>
                        <div className="rxp-sum-v">{prestadorElegido.nombre_prestador}</div>
                      </div>
                    </div>
                  )}
                  {fechaElegida && horaElegida && (
                    <div className="rxp-sum-item">
                      <span style={{ fontSize: 12, opacity: .7 }}>📅</span>
                      <div>
                        <div className="rxp-sum-l">Fecha y hora</div>
                        <div className="rxp-sum-v">
                          {new Date(fechaElegida+'T00:00:00').toLocaleDateString('es-CL',{day:'numeric',month:'short'})} · {horaElegida}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {esReagendamiento && (
                <div className="rxp-reagendar-badge">Reagendamiento activo</div>
              )}
            </>
          )}

          <Link to={adminPath} style={{ marginTop: 'auto', fontSize: 10, color: 'var(--rx-muted)', opacity: .4, transition: 'opacity .2s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity='1')}
            onMouseLeave={e => (e.currentTarget.style.opacity='.4')}>
            Acceso staff →
          </Link>
        </aside>

        {/* ── Main panel ── */}
        <main className="rxp-main">
          {reservado ? (
            <div className="rxp-success">
              <div className="rxp-check-ring">
                <svg viewBox="0 0 28 28"><path d="M6 14l6 6 10-10"/></svg>
              </div>
              <div className="rxp-suc-title">Tu hora está confirmada</div>
              <div className="rxp-suc-sub">
                {correoEnviado
                  ? <>Recibirás un correo con los detalles en <strong>{email}</strong></>
                  : <>Tu reserva está confirmada. <span style={{ color: 'var(--color-ink-soft)' }}>El correo de confirmación no pudo enviarse (sin configuración de correo).</span></>
                }
              </div>
              <div className="rxp-suc-card">
                {servicioElegido && <div className="rxp-suc-row"><span className="rxp-suc-lbl">Servicio</span><span className="rxp-suc-val">{servicioElegido.nombre_servicio}</span></div>}
                {prestadorElegido && <div className="rxp-suc-row"><span className="rxp-suc-lbl">Profesional</span><span className="rxp-suc-val">{prestadorElegido.nombre_prestador}</span></div>}
                {fechaElegida && <div className="rxp-suc-row"><span className="rxp-suc-lbl">Fecha</span><span className="rxp-suc-val">{new Date(fechaElegida+'T00:00:00').toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'})}</span></div>}
                {horaElegida && <div className="rxp-suc-row"><span className="rxp-suc-lbl">Hora</span><span className="rxp-suc-val">{horaElegida} hrs</span></div>}
              </div>
              <button className="rxp-cta" onClick={reiniciar}>
                <span className="rxp-cta-txt">Reservar otra hora</span>
                <div className="rxp-dots"><span/><span/><span/></div>
              </button>
            </div>
          ) : (
            <div className="rxp-panel active" key={paso}>

              {/* Paso 0: Selección de sucursal (solo si hay más de una) */}
              {paso === 0 && tenant && (
                <>
                  <div className="rxp-title"><span>¿A qué sede vas?</span></div>
                  <div className="rxp-sub">Selecciona la sucursal donde quieres reservar</div>
                  <div className="rxp-pc-list">
                    {tenant.sucursales.map((s, i) => (
                      <button
                        key={s.id_sucursal}
                        className="rxp-pc"
                        style={{ animationDelay: `${i * 70}ms` }}
                        onClick={() => {
                          setSucursal(s.id_sucursal)
                          setCargandoBase(true)
                          // Cargar catálogo para la sucursal elegida
                          const { idEmpresa } = tenant
                          Promise.all([
                            listServiciosPublico(idEmpresa),
                            listCategoriasPublico(idEmpresa),
                            listPrestadoresPublico(idEmpresa),
                          ]).then(([servs, cats, prests]) => {
                            setServicios(servs.filter(sv => sv.activo && sv.id_sucursal === s.id_sucursal))
                            setCategorias(cats.filter(c => c.activo && c.id_sucursal === s.id_sucursal))
                            setPrestadores(prests.filter(p => Number(p.reserva_online) === 1 && p.id_sucursal === s.id_sucursal))
                          }).finally(() => { setCargandoBase(false); irPaso(1) })
                        }}
                      >
                        <div className="rxp-pc-av">{s.nombre_sucursal.charAt(0)}</div>
                        <div>
                          <div className="rxp-pc-name">{s.nombre_sucursal}</div>
                        </div>
                        <span className="rxp-sc-arr" style={{ marginLeft: 'auto' }}>›</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Paso 1: Servicio */}
              {paso === 1 && (
                <>
                  {tieneSucursales && (
                    <button className="rxp-back" onClick={() => irPaso(0)}>← Volver</button>
                  )}
                  <div className="rxp-title"><span>¿Qué servicio necesitas?</span></div>
                  <div className="rxp-sub">Elige el servicio que mejor se adapte a ti</div>
                  <div className="rxp-search-wrap">
                    <span className="rxp-search-icon">⌕</span>
                    <input className="rxp-search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar servicio…"/>
                  </div>
                  <div>
                    {categorias.map(cat => {
                      const lista = serviciosPorCat.get(cat.id_categoria)
                      if (!lista?.length) return null
                      const open = categoriasAbiertas.has(cat.id_categoria) || busqueda.trim() !== ''
                      return (
                        <div key={cat.id_categoria} className={`rxp-cat ${open ? 'open' : ''}`}>
                          <button className="rxp-cat-hd" onClick={() => setCategoriasAbiertas(prev => {
                            const n = new Set(prev)
                            n.has(cat.id_categoria) ? n.delete(cat.id_categoria) : n.add(cat.id_categoria)
                            return n
                          })}>
                            <span>{cat.nombre_categoria}</span>
                            <span className="rxp-cat-arr">›</span>
                          </button>
                          <div className="rxp-cat-bd">
                            <div className="rxp-serv-list">
                              {lista.map(s => (
                                <button key={s.id_servicio} className="rxp-sc" onClick={() => handleServicio(s)}>
                                  <div style={{ flex: 1 }}>
                                    <div className="rxp-sc-name">{s.nombre_servicio}</div>
                                    <div className="rxp-sc-meta">{s.duracion} min</div>
                                  </div>
                                  <span className="rxp-sc-price">${Number(s.valor).toLocaleString('es-CL')}</span>
                                  <span className="rxp-sc-arr">›</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Paso 2: Profesional */}
              {paso === 2 && (
                <>
                  <button className="rxp-back" onClick={() => irPaso(1)}>← Volver</button>
                  <div className="rxp-title"><span>¿Con quién prefieres?</span></div>
                  <div className="rxp-sub">Selecciona tu profesional</div>
                  <div className="rxp-pc-list">
                    {prestFiltrados.length === 0 && (
                      <p style={{ color: 'var(--rx-muted)', fontSize: 13 }}>No hay profesionales disponibles para este servicio.</p>
                    )}
                    {prestFiltrados.map((p, i) => (
                      <button key={p.id_prestador} className="rxp-pc"
                        style={{ animationDelay: `${i * 70}ms` }}
                        onClick={() => handlePrestador(p)}>
                        <div className="rxp-pc-av">{p.nombre_prestador.charAt(0)}</div>
                        <div>
                          <div className="rxp-pc-name">{p.nombre_prestador}</div>
                        </div>
                        <span className="rxp-sc-arr" style={{ marginLeft: 'auto' }}>›</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Paso 3: Fecha y hora */}
              {paso === 3 && (
                <>
                  <button className="rxp-back" onClick={() => irPaso(2)}>← Volver</button>
                  <div className="rxp-title"><span>Elige fecha y hora</span></div>
                  <div className="rxp-sub">Selecciona el día y luego la hora disponible</div>
                  <div className="rxp-cal-wrap">
                    <div>
                      <div className="rxp-cal-nav">
                        <button className="rxp-cal-nb" onClick={() => setMesAnchor(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}>‹</button>
                        <span className="rxp-cal-month">{mesAnchor.toLocaleDateString('es-CL',{month:'long',year:'numeric'})}</span>
                        <button className="rxp-cal-nb" onClick={() => setMesAnchor(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}>›</button>
                      </div>
                      <div className="rxp-cal-grid">
                        {NOMBRES_DIA_CORTOS.map(n => <div key={n} className="rxp-cal-h">{n}</div>)}
                        {diasGrilla.map(d => {
                          const iso        = toISODate(d)
                          const esDelMes   = d.getMonth() === mesNum
                          const esPasado   = iso < hoyISO
                          const esBloq     = fechasBloqueadas.has(iso)
                          const esFuturoLejano = fechaMaxISO ? iso > fechaMaxISO : false
                          const habilitado = esDelMes && !esPasado && !esBloq && !esFuturoLejano && diasDisponibles.has(diaISO(d))
                          const elegido    = fechaElegida === iso
                          return (
                            <button key={iso}
                              className={['rxp-day',
                                !esDelMes ? '' : esBloq ? 'bloq' : habilitado ? 'en' : '',
                                elegido ? 'sel' : '',
                              ].filter(Boolean).join(' ')}
                              disabled={!habilitado}
                              onClick={() => handleFecha(d)}
                              style={{ visibility: !esDelMes ? 'hidden' : 'visible' }}>
                              {d.getDate()}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="rxp-hrs">
                      {!fechaElegida ? (
                        <><div className="rxp-hrs-lbl">Horas</div><div style={{ fontSize: 11, color: 'var(--rx-muted2)' }}>Selecciona un día</div></>
                      ) : cargandoHoras ? (
                        <><div className="rxp-hrs-lbl">Horas</div>
                        <div className="rxp-loader" style={{ height: 'auto', paddingTop: 20 }}>
                          <div className="rxp-loader-dot"/><div className="rxp-loader-dot"/><div className="rxp-loader-dot"/>
                        </div></>
                      ) : horasDelDia.length === 0 ? (
                        <><div className="rxp-hrs-lbl">Horas</div><div style={{ fontSize: 11, color: 'var(--rx-muted)' }}>Sin horas disponibles</div></>
                      ) : (
                        <>
                          <div className="rxp-hrs-lbl">
                            {new Date(fechaElegida+'T00:00:00').toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'})}
                          </div>
                          <div className="rxp-hrs-grid">
                          {horasDelDia.map((h, i) => (
                            <button key={h} className={`rxp-hp ${horaElegida === h ? 'sel' : ''}`}
                              style={{ animationDelay: `${i * 35}ms` }}
                              onClick={() => { setHoraElegida(h); triggerRipple('h'+h) }}>
                              {h}
                            </button>
                          ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {horaElegida && (
                    <button className="rxp-cta" onClick={() => irPaso(4)} style={{ marginTop: 16 }}>
                      <span className="rxp-cta-txt">Continuar con {horaElegida} →</span>
                      <div className="rxp-dots"><span/><span/><span/></div>
                    </button>
                  )}
                </>
              )}

              {/* Paso 4: Datos */}
              {paso === 4 && (
                <>
                  <button className="rxp-back" onClick={() => irPaso(3)}>← Volver</button>
                  <div className="rxp-title"><span>Completa tus datos</span></div>
                  <div className="rxp-sub">Solo necesitamos lo básico para confirmar tu reserva</div>

                  <div className="rxp-form">
                    <div className="rxp-fl">
                      <label>Nombre completo</label>
                      <input className="rxp-inp" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre"/>
                    </div>
                    <div className="rxp-fl">
                      <label>RUT <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
                      <input className="rxp-inp" value={rut} placeholder="12.345.678-9" onChange={e => setRut(formatearRut(e.target.value))}/>
                    </div>
                    <div className="rxp-fl">
                      <label>Teléfono</label>
                      <div className="rxp-tel">
                        <TelefonoPicker
                          value={telefono}
                          onChange={nuevoVal => {
                            const { codigo: nuevoCod } = separarTelefono(nuevoVal)
                            setTelefono(armarTelefono(nuevoCod, telSep.numero))
                          }}
                        />
                        <input className="rxp-inp" style={{ flex: 1, minWidth: 0 }} value={telSep.numero}
                          placeholder={`${pais?.digitos ?? ''} dígitos`}
                          onChange={e => {
                            const n = e.target.value.replace(/\D/g,'').slice(0, pais?.digitos ?? 15)
                            setTelefono(armarTelefono(telSep.codigo, n))
                          }}/>
                      </div>
                    </div>
                    <div className="rxp-fl">
                      <label>Correo electrónico</label>
                      <input className="rxp-inp" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com"/>
                    </div>
                  </div>

                  {error && <div className="rxp-error">{error}</div>}

                  <button
                    className="rxp-cta"
                    disabled={guardando}
                    onTouchStart={(e) => {
                      e.preventDefault()  // previene el click sintético posterior
                      if (!guardando && !confirmandoRef.current) handleConfirmar()
                    }}
                    onClick={(e) => {
                      // Solo ejecutar en desktop (touch ya lo maneja onTouchStart)
                      if (!('ontouchstart' in window)) handleConfirmar()
                    }}
                  >
                    {guardando ? (
                      <><span className="rxp-cta-txt" style={{ display: 'none' }}/><div className="rxp-dots" style={{ display: 'flex' }}><span/><span/><span/></div></>
                    ) : (
                      <span className="rxp-cta-txt">{esReagendamiento ? 'Confirmar reagendamiento' : 'Confirmar reserva'} →</span>
                    )}
                  </button>
                </>
              )}

            </div>
          )}
        </main>
      </div>
    </div>
  )
}
