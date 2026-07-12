import { useEffect, useState } from 'react'
import { useSearchParams, Link, useParams } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import { useTenant } from '../context/TenantContext'
import { ThemeToggle } from '../components/Common/ThemeToggle'

type Estado = 'cargando' | 'exito-cancelada' | 'exito-reagendar' | 'ya-cancelada' | 'no-encontrada' | 'error'

interface DatosCita {
  id_agendamiento:  number
  nombre_cliente:   string
  fecha:            string
  hora_inicio:      string
  hora_fin:         string
  nombre_servicio:  string
  nombre_prestador: string
  estado:           string
  email:            string
  id_servicio:      number | null
  slug_empresa:     string
}

export function CancelarPage() {
  const { tenant } = useTenant()
  const { slug }   = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()

  const token   = searchParams.get('token')
  const accion  = searchParams.get('accion') ?? 'cancelar'
  const baseUrl = `/r/${slug ?? 'polish-nail-bar'}`

  const [estado,        setEstado]        = useState<Estado>('cargando')
  const [cita,          setCita]          = useState<DatosCita | null>(null)
  const [urlReagendar,  setUrlReagendar]  = useState('')
  const [msgError,      setMsgError]      = useState('')

  useEffect(() => {
    if (!token) { setMsgError('El enlace no es válido o está incompleto.'); setEstado('error'); return }

    async function procesar() {
      const { data, error } = await supabase
        .rpc('get_reserva_por_token', { p_token: token }).single()

      if (error || !data) {
        setMsgError('No encontramos esa cita. El enlace puede haber expirado.')
        setEstado('no-encontrada'); return
      }

      const c = data as DatosCita
      setCita(c)

      if (c.estado === 'CANCELADA') { setEstado('ya-cancelada'); return }

      const { data: resultado, error: errCancelar } = await supabase
        .rpc('cancelar_reserva_por_token', { p_token: token })
      const res = resultado as { ok: boolean; error?: string } | null

      if (errCancelar || !res?.ok) {
        setMsgError(res?.error ?? 'No pudimos cancelar la cita.'); setEstado('error'); return
      }

      if (accion === 'reagendar') {
        const params = new URLSearchParams()
        params.set('reagendar', '1')
        if (c.id_servicio) params.set('servicio', String(c.id_servicio))
        setUrlReagendar(`${baseUrl}/reservar?` + params.toString())
        setEstado('exito-reagendar')
      } else {
        setEstado('exito-cancelada')
      }
    }
    procesar()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const nombreNegocio = tenant?.nombre ?? 'Nexus Booking'
  const nombreCliente = cita?.nombre_cliente ?? ''

  // Formato fecha legible
  const fechaLegible = cita?.fecha
    ? new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="rxp-shell">
      {/* Orbes decorativos */}
      <div className="rxp-orb rxp-orb1"/>
      <div className="rxp-orb rxp-orb2"/>
      <div className="rxp-orb rxp-orb3"/>
      <div className="rxp-grid"/>

      {/* Topbar */}
      <div className="rxp-topbar">
        <div className="rxp-brand">
          <div className="rxp-brand-logo">{nombreNegocio.charAt(0).toUpperCase()}</div>
          <span className="rxp-brand-name">{nombreNegocio}</span>
          <span className="rxp-brand-tag">{accion === 'reagendar' ? 'Reagendamiento' : 'Cancelación'}</span>
        </div>
        <ThemeToggle style={{ marginLeft: 'auto' }} />
      </div>

      {/* Contenido centrado */}
      <div className="rxp-cancelar-wrap">

        {/* ── Cargando ── */}
        {estado === 'cargando' && (
          <div className="rxp-cancelar-card">
            <div className="rxp-loader" style={{ height: 120 }}>
              <div className="rxp-loader-dot"/><div className="rxp-loader-dot"/><div className="rxp-loader-dot"/>
            </div>
            <p className="rxp-suc-sub">Procesando tu solicitud…</p>
          </div>
        )}

        {/* ── Cancelada exitosamente ── */}
        {estado === 'exito-cancelada' && (
          <div className="rxp-cancelar-card">
            <div className="rxp-check-ring rxp-check-ring--ok">
              <svg viewBox="0 0 28 28"><path d="M6 14l6 6 10-10"/></svg>
            </div>
            <h2 className="rxp-suc-title">Cita cancelada</h2>
            <p className="rxp-suc-sub">
              Hola <strong>{nombreCliente}</strong>, tu cita fue cancelada exitosamente.
            </p>
            {cita && (
              <div className="rxp-suc-card">
                <div className="rxp-suc-row"><span className="rxp-suc-lbl">Servicio</span><span className="rxp-suc-val">{cita.nombre_servicio}</span></div>
                <div className="rxp-suc-row"><span className="rxp-suc-lbl">Profesional</span><span className="rxp-suc-val">{cita.nombre_prestador}</span></div>
                <div className="rxp-suc-row"><span className="rxp-suc-lbl">Fecha</span><span className="rxp-suc-val">{fechaLegible}</span></div>
                <div className="rxp-suc-row"><span className="rxp-suc-lbl">Hora</span><span className="rxp-suc-val">{cita.hora_inicio} hrs</span></div>
              </div>
            )}
            <Link to={`${baseUrl}/reservar`} className="rxp-cta" style={{ textDecoration: 'none' }}>
              <span className="rxp-cta-txt">Reservar nueva cita</span>
            </Link>
          </div>
        )}

        {/* ── Reagendar ── */}
        {estado === 'exito-reagendar' && (
          <div className="rxp-cancelar-card">
            <div className="rxp-check-ring rxp-check-ring--primary">
              <svg viewBox="0 0 28 28">
                <rect x="5" y="3" width="18" height="22" rx="2" strokeWidth="2"/>
                <line x1="9" y1="8" x2="19" y2="8" strokeWidth="2"/>
                <line x1="9" y1="13" x2="19" y2="13" strokeWidth="2"/>
                <line x1="9" y1="18" x2="14" y2="18" strokeWidth="2"/>
              </svg>
            </div>
            <h2 className="rxp-suc-title">Cita cancelada</h2>
            <p className="rxp-suc-sub">
              Hola <strong>{nombreCliente}</strong>, tu cita fue cancelada. Ahora elige un nuevo horario.
            </p>
            {cita && (
              <div className="rxp-suc-card">
                <div className="rxp-suc-row"><span className="rxp-suc-lbl">Servicio</span><span className="rxp-suc-val">{cita.nombre_servicio}</span></div>
                <div className="rxp-suc-row"><span className="rxp-suc-lbl">Profesional</span><span className="rxp-suc-val">{cita.nombre_prestador}</span></div>
                <div className="rxp-suc-row"><span className="rxp-suc-lbl">Fecha anterior</span><span className="rxp-suc-val">{fechaLegible}</span></div>
              </div>
            )}
            <Link to={urlReagendar} className="rxp-cta" style={{ textDecoration: 'none' }}>
              <span className="rxp-cta-txt">Elegir nuevo horario →</span>
            </Link>
          </div>
        )}

        {/* ── Ya cancelada ── */}
        {estado === 'ya-cancelada' && (
          <div className="rxp-cancelar-card">
            <div className="rxp-check-ring rxp-check-ring--warn">
              <svg viewBox="0 0 28 28">
                <path d="M14 6v9M14 19v2" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className="rxp-suc-title">Ya cancelada</h2>
            <p className="rxp-suc-sub">Esta cita ya fue cancelada anteriormente.</p>
            <Link to={`${baseUrl}/reservar`} className="rxp-cta rxp-cta-ghost" style={{ textDecoration: 'none' }}>
              <span className="rxp-cta-txt">Reservar nueva cita</span>
            </Link>
          </div>
        )}

        {/* ── No encontrada / Error ── */}
        {(estado === 'no-encontrada' || estado === 'error') && (
          <div className="rxp-cancelar-card">
            <div className="rxp-check-ring rxp-check-ring--err">
              <svg viewBox="0 0 28 28">
                <path d="M8 8l12 12M20 8L8 20" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className="rxp-suc-title">{estado === 'error' ? 'Ocurrió un error' : 'No encontrada'}</h2>
            <p className="rxp-suc-sub">{msgError}</p>
            <Link to={`${baseUrl}/reservar`} className="rxp-cta rxp-cta-ghost" style={{ textDecoration: 'none' }}>
              <span className="rxp-cta-txt">Ir a reservas</span>
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
