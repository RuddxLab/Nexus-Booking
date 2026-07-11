import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabaseClient'

interface AuthContextValue {
  session:    Session | null
  loading:    boolean
  esRecovery: boolean   // true cuando la sesión viene de un link de reset de contraseña
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true, esRecovery: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,    setSession]    = useState<Session | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [esRecovery, setEsRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Sesión temporal de recovery — marcar para no redirigir al admin
        setEsRecovery(true)
        setSession(newSession)
      } else {
        if (event === 'SIGNED_IN' && esRecovery) {
          // El usuario acaba de actualizar su contraseña — limpiar el flag
          setEsRecovery(false)
        }
        setSession(newSession)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, []) // eslint-disable-line

  return (
    <AuthContext.Provider value={{ session, loading, esRecovery }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
