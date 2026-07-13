const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL?.replace('.supabase.co', '.supabase.co/functions/v1') ?? ''

interface DatosCorreoReserva {
  token?: string
  id_agendamiento: number
  id_empresa?: number
  id_sucursal?: number      // para resolver config de correo por sucursal
  nombre_cliente: string
  email: string
  telefono: string
  nombre_prestador: string
  nombre_servicio: string
  duracion: number
  fecha: string
  hora_inicio: string
  hora_fin: string
  slug?: string
}

interface DatosCorreoCancelacion {
  id_empresa?: number
  id_sucursal?: number
  nombre_cliente: string
  email: string
  nombre_prestador: string
  nombre_servicio: string
  fecha: string
  hora_inicio: string
  hora_fin: string
}

export async function enviarCorreoReserva(datos: DatosCorreoReserva): Promise<{ ok: boolean; error?: string } | null> {
  try {
    const res = await fetch(`${FUNCTIONS_URL}/enviar-correo-reserva`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    })
    const data = await res.json().catch(() => ({}))
    return { ok: data.ok === true, error: data.error }
  } catch (err) {
    console.warn('No se pudo enviar el correo de confirmación:', err)
    return { ok: false, error: String(err) }
  }
}

export async function enviarCorreoCancelacion(datos: DatosCorreoCancelacion): Promise<void> {
  try {
    await fetch(`${FUNCTIONS_URL}/enviar-correo-cancelacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    })
  } catch (err) {
    console.warn('No se pudo enviar el correo de cancelación:', err)
  }
}
