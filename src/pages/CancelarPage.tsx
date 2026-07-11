import { useEffect, useState } from 'react'
import { useSearchParams, Link, useParams } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import { useTenant } from '../context/TenantContext'

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

  const token  = searchParams.get('token')
  const accion = searchParams.get('accion') ?? 'cancelar'
  const baseUrl = `/r/${slug ?? 'polish-nail-bar'}`

  const [estado,        setEstado]        = useState<Estado>('cargando')
  const [nombreCliente, setNombreCliente] = useState('')
  const [urlReagendar,  setUrlReagendar]  = useState('')
  const [msgError,      setMsgError]      = useState('')

  useEffect(() => {
    if (!token) {
      setMsgError('El enlace no es válido o está incompleto.')
      setEstado('error')
      return
    }

    async function procesar() {
      const { data, error } = await supabase
        .rpc('get_reserva_por_token', { p_token: token })
        .single()

      if (error || !data) {
        setMsgError('No encontramos esa cita. El enlace puede haber expirado.')
        setEstado('no-encontrada')
        return
      }

      const cita = data as DatosCita
      setNombreCliente(cita.nombre_cliente ?? '')

      if (cita.estado === 'CANCELADA') {
        setEstado('ya-cancelada')
        return
      }

      const { data: resultado, error: errCancelar } = await supabase
        .rpc('cancelar_reserva_por_token', { p_token: token })

      const res = resultado as { ok: boolean; error?: string } | null

      if (errCancelar || !res?.ok) {
        setMsgError(res?.error ?? 'No pudimos cancelar la cita.')
        setEstado('error')
        return
      }

      if (accion === 'reagendar') {
        const params = new URLSearchParams()
        params.set('reagendar', '1')
        if (cita.id_servicio) params.set('servicio', String(cita.id_servicio))
        setUrlReagendar(`${baseUrl}/reservar?` + params.toString())
        setEstado('exito-reagendar')
      } else {
        setEstado('exito-cancelada')
      }
    }

    procesar()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const iconMap = {
    'cargando':        { icon: '⏳', color: 'var(--color-ink-soft)' },
    'exito-cancelada': { icon: '✓',  color: 'var(--color-success)' },
    'exito-reagendar': { icon: '📅', color: 'var(--color-primary)' },
    'ya-cancelada':    { icon: '⚠',  color: 'var(--color-warning)' },
    'no-encontrada':   { icon: '?',  color: 'var(--color-ink-soft)' },
    'error':           { icon: '✕',  color: 'var(--color-danger)' },
  }

  const { icon, color } = iconMap[estado]
  const nombreNegocio   = tenant?.nombre ?? 'Nexus Booking'

  return (
    <div className="rx-shell">
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '48px 36px',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        boxShadow: 'var(--shadow-elevated)',
        animation: 'rxSlideIn 0.35s cubic-bezier(0.22,0.61,0.36,1)',
      }}>
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-ink-soft)', marginBottom: 20 }}>
          {nombreNegocio}
        </p>

        <div style={{
          width: 56, height: 56,
          borderRadius: '50%',
          background: estado === 'cargando' ? 'var(--color-surface-2)' : `${color}15`,
          border: `2px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color,
          margin: '0 auto 18px',
          animation: estado !== 'cargando' ? 'rxCheckPop 0.5s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
        }}>
          {icon}
        </div>

        {estado === 'cargando' && (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 8, fontFamily: 'var(--font-display)' }}>Procesando</h2>
            <p style={{ color: 'var(--color-ink-soft)', fontSize: 14 }}>Un momento por favor.</p>
          </>
        )}
        {estado === 'exito-cancelada' && (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 8, color: 'var(--color-success)', fontFamily: 'var(--font-display)' }}>Cita cancelada</h2>
            <p style={{ color: 'var(--color-ink-soft)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Hola <strong style={{ color: 'var(--color-ink)' }}>{nombreCliente}</strong>, tu cita fue cancelada exitosamente.
            </p>
            <Link to={`${baseUrl}/reservar`} className="rx-btn rx-btn--primary" style={{ textDecoration: 'none' }}>Reservar nueva cita</Link>
          </>
        )}
        {estado === 'exito-reagendar' && (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 8, color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>Cita cancelada</h2>
            <p style={{ color: 'var(--color-ink-soft)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Hola <strong style={{ color: 'var(--color-ink)' }}>{nombreCliente}</strong>, tu cita fue cancelada. Elige un nuevo horario.
            </p>
            <Link to={urlReagendar} className="rx-btn rx-btn--primary" style={{ textDecoration: 'none' }}>Reagendar ahora →</Link>
          </>
        )}
        {estado === 'ya-cancelada' && (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 8, color: 'var(--color-warning)', fontFamily: 'var(--font-display)' }}>Ya cancelada</h2>
            <p style={{ color: 'var(--color-ink-soft)', fontSize: 14, marginBottom: 24 }}>Esta cita ya fue cancelada anteriormente.</p>
            <Link to={`${baseUrl}/reservar`} className="rx-btn rx-btn--ghost" style={{ textDecoration: 'none' }}>Reservar nueva cita</Link>
          </>
        )}
        {estado === 'no-encontrada' && (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 8, fontFamily: 'var(--font-display)' }}>No encontrada</h2>
            <p style={{ color: 'var(--color-ink-soft)', fontSize: 14, marginBottom: 24 }}>{msgError}</p>
            <Link to={`${baseUrl}/reservar`} className="rx-btn rx-btn--ghost" style={{ textDecoration: 'none' }}>Ir a reservas</Link>
          </>
        )}
        {estado === 'error' && (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 8, color: 'var(--color-danger)', fontFamily: 'var(--font-display)' }}>Error</h2>
            <p style={{ color: 'var(--color-ink-soft)', fontSize: 14, marginBottom: 24 }}>{msgError}</p>
            <Link to={`${baseUrl}/reservar`} className="rx-btn rx-btn--ghost" style={{ textDecoration: 'none' }}>Volver al inicio</Link>
          </>
        )}
      </div>
    </div>
  )
}
