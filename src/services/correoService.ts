const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL?.replace('.supabase.co', '.supabase.co/functions/v1') ?? ''

interface DatosCorreoReserva {
  token?: string
  id_agendamiento: number
  nombre_cliente: string
  email: string
  telefono: string
  nombre_prestador: string
  nombre_servicio: string
  duracion: number
  fecha: string
  hora_inicio: string
  hora_fin: string
  slug?: string  // slug del negocio para construir los links de cancelar/reagendar
}

interface DatosCorreoCancelacion {
  nombre_cliente: string
  email: string
  nombre_prestador: string
  nombre_servicio: string
  fecha: string
  hora_inicio: string
  hora_fin: string
}

export async function enviarCorreoReserva(datos: DatosCorreoReserva): Promise<void> {
  try {
    await fetch(`${FUNCTIONS_URL}/enviar-correo-reserva`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    })
  } catch (err) {
    console.warn('No se pudo enviar el correo de confirmación:', err)
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
