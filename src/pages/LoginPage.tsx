import { FormEvent, useEffect, useState } from 'react'
import { signIn, resetPassword } from '../services/authService'
import { supabase } from '../services/supabaseClient'
import { useAuth } from '../hooks/useAuth'

type Modo = 'login' | 'olvide' | 'nueva-password'

export function LoginPage() {
  const { esRecovery } = useAuth()
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [nuevaPass,    setNuevaPass]    = useState('')
  const [confirmaPass, setConfirmaPass] = useState('')
  const [modo,         setModo]         = useState<Modo>('login')
  const [error,        setError]        = useState<string | null>(null)
  const [ok,           setOk]           = useState<string | null>(null)
  const [cargando,     setCargando]     = useState(false)

  // Cuando el AuthProvider detecta PASSWORD_RECOVERY, activar el modo nueva-password
  useEffect(() => {
    if (esRecovery) setModo('nueva-password')
  }, [esRecovery])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    setCargando(true)
    try {
      if (modo === 'login') {
        await signIn(email, password)
      } else if (modo === 'olvide') {
        await resetPassword(email)
        setOk('Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo.')
        setModo('login')
      } else if (modo === 'nueva-password') {
        if (nuevaPass.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
        if (nuevaPass !== confirmaPass) return setError('Las contraseñas no coinciden.')
        const { error: updateErr } = await supabase.auth.updateUser({ password: nuevaPass })
        if (updateErr) throw updateErr
        setOk('¡Contraseña actualizada! Ya puedes iniciar sesión.')
        setModo('login')
        setNuevaPass('')
        setConfirmaPass('')
        // Cerrar la sesión temporal de recovery
        await supabase.auth.signOut()
      }
    } catch (err: any) {
      setError(err.message ?? 'Ocurrió un error.')
    } finally {
      setCargando(false)
    }
  }

  function cambiarModo(m: Modo) {
    setModo(m); setError(null); setOk(null)
  }

  const titulo = {
    login:           'Inicia sesión para continuar',
    olvide:          'Ingresa tu correo y te enviaremos un enlace',
    'nueva-password':'Elige tu nueva contraseña',
  }[modo]

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)',
      backgroundImage: 'radial-gradient(ellipse at 60% 0%, rgba(37,99,235,0.15) 0%, transparent 60%)',
      padding: '20px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 380, animation: 'rxSlideIn 0.4s cubic-bezier(0.22,0.61,0.36,1)' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--color-primary)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
            marginBottom: 12,
            boxShadow: '0 0 0 6px var(--color-primary-soft)',
          }}>NX</div>
          <h2 style={{ fontSize: 20, marginBottom: 2 }}>Nexus Booking</h2>
          <p style={{ color: 'var(--color-ink-soft)', fontSize: 13 }}>{titulo}</p>
        </div>

        <form
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            boxShadow: 'var(--shadow-elevated)',
          }}
          onSubmit={handleSubmit}
        >
          {/* ── Login ── */}
          {modo === 'login' && (
            <>
              <div className="field">
                <label>Correo electrónico</label>
                <input type="email" required value={email}
                  onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" />
              </div>
              <div className="field">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span>Contraseña</span>
                  <button type="button" onClick={() => cambiarModo('olvide')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, color: 'var(--color-ink-soft)', textDecoration: 'underline', padding: 0 }}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </label>
                <input type="password" required minLength={4} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </>
          )}

          {/* ── Olvidé contraseña ── */}
          {modo === 'olvide' && (
            <div className="field">
              <label>Correo electrónico</label>
              <input type="email" required value={email}
                onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" />
            </div>
          )}

          {/* ── Nueva contraseña (flujo recovery) ── */}
          {modo === 'nueva-password' && (
            <>
              <div className="field">
                <label>Nueva contraseña</label>
                <input type="password" required minLength={6} value={nuevaPass}
                  onChange={e => setNuevaPass(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="field">
                <label>Confirmar contraseña</label>
                <input type="password" required minLength={6} value={confirmaPass}
                  onChange={e => setConfirmaPass(e.target.value)} placeholder="Repite la contraseña" />
              </div>
            </>
          )}

          {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
          {ok    && <div style={{ fontSize: 13, color: 'var(--color-success)',
            background: 'var(--color-success-soft)', borderRadius: 8,
            padding: '10px 12px', marginBottom: 12 }}>{ok}</div>}

          <button className="btn btn--primary"
            style={{ width: '100%', marginTop: 4, padding: '11px' }} disabled={cargando}>
            {cargando ? 'Procesando…' :
              modo === 'login'           ? 'Iniciar sesión' :
              modo === 'olvide'          ? 'Enviar enlace' :
              'Guardar contraseña'}
          </button>

          {modo === 'olvide' && (
            <button type="button" className="btn btn--ghost"
              style={{ width: '100%', marginTop: 8 }} onClick={() => cambiarModo('login')}>
              ← Volver al login
            </button>
          )}
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--color-ink-soft)' }}>
          <a href="/" style={{ color: 'var(--color-accent)' }}>← Volver a reservas</a>
        </p>
      </div>
    </div>
  )
}
