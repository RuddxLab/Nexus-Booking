// Validaciones reutilizables para los formularios de mantenimiento.

/** Calcula el dígito verificador de un RUT chileno (algoritmo módulo 11). */
function calcularDigitoVerificador(cuerpo: string): string {
  let suma = 0
  let multiplicador = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1
  }
  const resto = 11 - (suma % 11)
  if (resto === 11) return '0'
  if (resto === 10) return 'K'
  return String(resto)
}

/** Formatea un RUT a NN.NNN.NNN-D mientras el usuario escribe. */
export function formatearRut(valorCrudo: string): string {
  const limpio = valorCrudo.replace(/[^0-9kK]/g, '').toUpperCase()
  if (!limpio) return ''
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  if (!cuerpo) return limpio
  const cuerpoConPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpoConPuntos}-${dv}`
}

/** Valida que un RUT (con o sin puntos/guion) tenga un dígito verificador correcto. */
export function validarRut(valor: string): boolean {
  const limpio = valor.replace(/[^0-9kK]/g, '').toUpperCase()
  if (limpio.length < 2) return false
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  if (!/^\d+$/.test(cuerpo)) return false
  return calcularDigitoVerificador(cuerpo) === dv
}

/** Quita puntos y guión, deja solo cuerpo+DV en mayúscula (ej. "123456789"). Para guardar en la BD. */
export function limpiarRut(valor: string): string {
  return valor.replace(/[^0-9kK]/g, '').toUpperCase()
}

export const EJEMPLO_RUT = 'Ej: 12.345.678-9'

/** Validación estándar de formato de correo. */
export function validarEmail(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())
}
