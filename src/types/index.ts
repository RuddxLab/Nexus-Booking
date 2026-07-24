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
  /** Cuando el servicio Y el prestador tienen comisión, cuál se aplica.
   *  Ambas se convierten a pesos y recién ahí se comparan. */
  regla_comision: 'SERVICIO' | 'PRESTADOR' | 'MAYOR' | 'MENOR'
  /** Dónde se aplica el redondeo del IVA: por cada línea o sobre el total
   *  del documento. No cambiar una vez que la empresa ya emitió. */
  regla_redondeo: 'LINEA' | 'TOTAL'
  /** Tasa de IVA en porcentaje (Chile: 19). Se aplica a servicios y
   *  productos marcados como afectos. */
  tasa_iva: number
  /** true  = la comisión se calcula sobre el neto YA con descuento (el
   *          prestador comparte el descuento).
   *  false = se calcula sobre el precio de lista (la empresa lo absorbe). */
  descuento_afecta_comision: boolean
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
  usa_caja: boolean
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
  /** 'P' = porcentaje, 'M' = monto fijo. Misma convención que servicios. */
  tipo_comision: 'P' | 'M' | null
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
  descripcion: string | null
  duracion: number // minutos
  /** Precio NETO, sin IVA. */
  valor: number
  /** Flag: 1 = afecto a IVA (19%), 0 = exento. */
  maneja_iva: number
  comision: number | null
  /** 'P' = porcentaje, 'M' = monto fijo. */
  tipo_comision: 'P' | 'M' | null
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

// Vista pública segura de servicios (sin comisión ni datos internos)
export interface ServicioPublico {
  id_servicio:     number
  id_empresa:      number
  id_sucursal:     number
  id_categoria:    number
  nombre_servicio: string
  valor:           number
  maneja_iva:      number
  duracion:        number
  descripcion:     string | null
  activo:          boolean
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

export interface Descuento {
  id_descuento: number
  id_empresa:   number
  nombre:       string
  /** PORCENTAJE = % · MONTO = rebaja fija en $ · NXM = promo 2x1, 3x2… */
  tipo:         'PORCENTAJE' | 'MONTO' | 'NXM'
  valor:        number
  /** A qué líneas de la venta se aplica. */
  aplica_a:     'TODO' | 'SERVICIOS' | 'PRODUCTOS'
  /** Tope en $ del descuento (opcional). */
  tope_monto:   number | null
  /** null = sin límite de vigencia. */
  fecha_desde:  string | null
  fecha_hasta:  string | null
  /** Si tiene código es un CUPÓN: no se lista, se ingresa a mano. */
  codigo:       string | null
  max_usos:     number | null
  usos:         number
  /** NXM: sobre qué ítem aplica la promo (uno de los dos). */
  id_servicio:  number | null
  id_producto:  number | null
  /** NXM: lleva N, paga M. 2x1 → lleva 2, paga 1. */
  nx_lleva:     number | null
  nx_paga:      number | null
  activo:       boolean
}

export interface GiftCard {
  id_gift_card:      number
  id_empresa:        number
  codigo:            string
  saldo_inicial:     number
  saldo:             number
  id_cliente:        number | null
  fecha_vencimiento: string | null
  activo:            boolean
  observaciones:     string | null
  correo_destinatario: string | null
  nombre_remitente:    string | null
}

export interface Producto {
  id_producto:    number
  id_empresa:     number
  id_sucursal:    number | null
  id_categoria:   number | null
  sku:            string | null
  nombre:         string
  descripcion:    string | null
  /** Precio NETO, sin IVA (misma convención que servicios.valor). */
  precio_venta:   number
  /** Costo promedio ponderado; lo calculan las compras (Fase 3). */
  costo_promedio: number
  maneja_iva:     boolean
  /** false = no controla stock (servicios de terceros, artículos sin control). */
  maneja_stock:   boolean
  activo:         boolean
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
