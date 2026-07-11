export interface PaisTelefono {
  codigo: string
  pais: string
  bandera: string
  digitos: number
}

// "digitos" = cantidad de dígitos del número local, SIN el código de país.
export const PAISES_TELEFONO: PaisTelefono[] = [
  { codigo: '+56', pais: 'Chile', bandera: '🇨🇱', digitos: 9 },
  { codigo: '+54', pais: 'Argentina', bandera: '🇦🇷', digitos: 10 },
  { codigo: '+51', pais: 'Perú', bandera: '🇵🇪', digitos: 9 },
  { codigo: '+57', pais: 'Colombia', bandera: '🇨🇴', digitos: 10 },
  { codigo: '+52', pais: 'México', bandera: '🇲🇽', digitos: 10 },
  { codigo: '+55', pais: 'Brasil', bandera: '🇧🇷', digitos: 11 },
  { codigo: '+591', pais: 'Bolivia', bandera: '🇧🇴', digitos: 8 },
  { codigo: '+593', pais: 'Ecuador', bandera: '🇪🇨', digitos: 9 },
  { codigo: '+595', pais: 'Paraguay', bandera: '🇵🇾', digitos: 9 },
  { codigo: '+598', pais: 'Uruguay', bandera: '🇺🇾', digitos: 8 },
  { codigo: '+58', pais: 'Venezuela', bandera: '🇻🇪', digitos: 10 },
  { codigo: '+1', pais: 'Estados Unidos / Canadá', bandera: '🇺🇸', digitos: 10 },
  { codigo: '+34', pais: 'España', bandera: '🇪🇸', digitos: 9 }
]

export const PAIS_TELEFONO_DEFAULT = PAISES_TELEFONO[0] // Chile

/** Dado un valor guardado (ej. "+56912345678"), separa el código de país del número local. */
export function separarTelefono(valor: string): { codigo: string; numero: string } {
  const limpio = (valor ?? '').trim()
  const encontrado = [...PAISES_TELEFONO]
    .sort((a, b) => b.codigo.length - a.codigo.length)
    .find((p) => limpio.startsWith(p.codigo))

  if (!encontrado) {
    return { codigo: PAIS_TELEFONO_DEFAULT.codigo, numero: limpio.replace(/\D/g, '') }
  }
  return { codigo: encontrado.codigo, numero: limpio.slice(encontrado.codigo.length).replace(/\D/g, '') }
}

export function armarTelefono(codigo: string, numero: string): string {
  return `${codigo}${numero}`
}

export function validarTelefono(valor: string): boolean {
  const { codigo, numero } = separarTelefono(valor)
  const pais = PAISES_TELEFONO.find((p) => p.codigo === codigo)
  if (!pais) return false
  return numero.length === pais.digitos
}
