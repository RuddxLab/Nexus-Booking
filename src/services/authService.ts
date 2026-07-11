import { supabase } from './supabaseClient'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function resetPassword(email: string) {
  const fnUrl = (import.meta.env.VITE_SUPABASE_URL as string)
    ?.replace('.supabase.co', '.supabase.co/functions/v1') + '/reset-password'

  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'No se pudo enviar el enlace.')
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}
