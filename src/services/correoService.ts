const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL?.replace('.supabase.co', '.supabase.co/functions/v1') ?? ''

interface DatosCorreoReserva {
  token?: string
  id_agendamiento: number
  id_empresa?: number
  id_sucursal?: number
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
  // Colores de la empresa para el template del correo
  color_primario?:   string
  color_acento?:     string
  color_fondo?:      string
  color_superficie?: string
  color_borde?:      string
  color_texto?:      string
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

interface DatosCorreoGiftCard {
  email: string
  nombre_remitente: string
  valor: number
  codigo: string
  observaciones?: string | null
  fecha_vencimiento?: string | null
  nombre_empresa?: string
  // Colores de la empresa para el template (opcionales)
  color_acento?:     string
  color_fondo?:      string
  color_superficie?: string
  color_borde?:      string
  color_texto?:      string
}

/** Envía al destinatario el correo de una gift card recién emitida. No bloquea la emisión si falla. */
export async function enviarCorreoGiftCard(datos: DatosCorreoGiftCard): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${FUNCTIONS_URL}/enviar-correo-giftcard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    })
    const data = await res.json().catch(() => ({}))
    return { ok: data.ok === true, error: data.error }
  } catch (err) {
    console.warn('No se pudo enviar el correo de la gift card:', err)
    return { ok: false, error: String(err) }
  }
}

/** Dispara el correo de cierre de caja a los supervisores de la empresa. No bloquea el cierre. */
export async function enviarCorreoCierreCaja(idCaja: number): Promise<{ ok: boolean; enviados?: number; error?: string }> {
  try {
    const res = await fetch(`${FUNCTIONS_URL}/enviar-correo-cierre-caja`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_caja: idCaja })
    })
    const data = await res.json().catch(() => ({}))
    return { ok: data.ok === true, enviados: data.enviados, error: data.error }
  } catch (err) {
    console.warn('No se pudo enviar el correo de cierre de caja:', err)
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
