import { supabase } from './supabaseClient'

/**
 * Fábrica de operaciones CRUD para tablas simples.
 * Si se pasa idEmpresa, listAll filtra automáticamente por esa empresa.
 * La seguridad real vive en RLS; esto es para que cada usuario vea
 * solo los datos de su empresa en la UI.
 */
export function createCrudService<T extends Record<string, any>>(
  table: string,
  idColumn: string
) {
  return {
    async listAll(orderBy?: string, idEmpresa?: number | null, idSucursal?: number | null): Promise<T[]> {
      let query = supabase.from(table).select('*')
      if (idEmpresa)  query = query.eq('id_empresa',  idEmpresa)  as any
      if (idSucursal) query = query.eq('id_sucursal', idSucursal) as any
      const { data, error } = orderBy ? await query.order(orderBy) : await query
      if (error) throw error
      return (data ?? []) as T[]
    },

    async getById(id: number | string): Promise<T | null> {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq(idColumn, id)
        .maybeSingle()
      if (error) throw error
      return data as T | null
    },

    async create(payload: Partial<T>): Promise<T> {
      const { data, error } = await supabase.from(table).insert(payload as any).select().single()
      if (error) throw error
      return data as T
    },

    async update(id: number | string, payload: Partial<T>): Promise<T> {
      const { data, error } = await supabase
        .from(table)
        .update(payload as any)
        .eq(idColumn, id)
        .select()
        .single()
      if (error) throw error
      return data as T
    },

    async remove(id: number | string): Promise<void> {
      const { error } = await supabase.from(table).delete().eq(idColumn, id)
      if (error) throw error
    }
  }
}
