// Tipos alineados 1:1 con el esquema de Supabase (public schema)

export type EstadoAgendamiento =
  | 'AGENDADA'
  | 'CONFIRMADA'
  | 'CANCELADA'
  | 'COMPLETADA'
  | 'NO_ASISTIO'
  | 'PAGADA'

export interface Empresa {
  id_empresa: number
  nro_empresa: number | null
  nombre_empresa: string
  rut_empresa: string | null
  email_contacto: string | null
  direccion_empresa: string | null
  db_empresa: string | null
  slug: string
  /** Rige TODO el catálogo (servicios y productos):
   *  true  = cada sucursal registra los suyos;
   *  false = catálogo compartido a nivel empresa. */
  catalogo_por_sucursal: boolean
  activo: boolean
  fecha_creacion: string
}

export interface Sucursal {
  id_sucursal: number
  id_empresa: number
  nro_sucursal: number | null
  nombre_sucursal: string
  slug: string | null
  config_ui: Record<string, string> | null
  activo: boolean
}

export interface Cliente {
  id_cliente: number
  id_empresa: number
  nombre_cliente: string
  telefono: string | null
  email: string | null
  rut: string | null
  activo: boolean
}

export interface Prestador {
  id_prestador: number
  id_empresa: number
  id_sucursal: number
  id_usuario: string | null
  nombre_prestador: string
  email: string | null
  telefono: string | null
  rut: string | null
  direccion: string | null
  ciudad: string | null
  comuna: string | null
  comision: number | null
  reserva_online: number // 1 = sí, 0 = no
  paso_agenda:    number | null
  buffer_min:     number
  dias_agenda:    number
  activo: boolean
}

export interface Categoria {
  id_categoria: number
  id_empresa: number
  id_sucursal: number
  id_tipocategoria: number
  nombre_categoria: string
  activo: boolean
}

export interface Servicio {
  id_servicio: number
  id_empresa: number
  id_sucursal: number
  id_categoria: number
  nombre_servicio: string
  duracion: number // minutos
  valor: number
  comision: number | null
  activo: boolean
}

export interface Agendamiento {
  id_agendamiento: number
  id_empresa: number
  id_sucursal: number
  id_cliente: number
  id_prestador: number
  id_servicio?: number | null
  nombre_cliente: string
  telefono?: string | null
  email?: string | null
  rut?: string | null
  fecha: string // YYYY-MM-DD
  hora_inicio: string // HH:MM
  hora_fin: string // HH:MM
  estado: EstadoAgendamiento
  // Presente solo cuando la consulta pide el join con servicios(...)
  servicios?: { nombre_servicio: string; duracion: number } | null
}

export interface PrestadorHorario {
  id_prestador_horario: number
  id_prestador: number
  dia: number // 1 = lunes … 7 = domingo (ISO)
  hora_inicio: string | null
  hora_fin: string | null
  activo: boolean
}

export interface PrestadorAusencia {
  id_prestador_ausencia: number
  id_prestador: number
  dia: string
  hora_inicio: string
  hora_fin: string
}

// Vista pública segura (sin datos sensibles de prestadores)
export interface PrestadorPublico {
  id_prestador: number
  id_sucursal: number
  nombre_prestador: string
  ciudad: string | null
  comuna: string | null
  activo: boolean
  reserva_online: number
  paso_agenda:  number | null  // null = usar duración del servicio
  buffer_min:   number         // minutos de descanso entre citas (default 0)
  dias_agenda:  number         // días hacia adelante que se abre la agenda (default 30)
}

export interface DiaBloqueado {
  id_dia_bloqueado: number
  id_empresa: number
  id_sucursal: number | null
  id_prestador: number | null   // null = aplica a todos los prestadores
  fecha: string                  // YYYY-MM-DD
  hora_inicio: string | null     // null = día completo
  hora_fin: string | null        // null = día completo
  descripcion: string | null
  created_at: string
}

export interface TipoCategoria {
  id_tipocategoria: number
  id_empresa:       number
  id_sucursal:      number | null
  nombre_tipo_categoria: string
  /** Código estable del catálogo: PROD = productos, SERV = servicios.
   *  El nombre es libre (solo para mostrar); el sistema filtra por este código. */
  codigo:           'PROD' | 'SERV' | null
  activo:           boolean
}
