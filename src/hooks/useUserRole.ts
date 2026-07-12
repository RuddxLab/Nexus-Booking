import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { useAuth } from './useAuth'

export type NombreRol = 'admin' | 'supervisor' | 'recepcionista' | 'agenda_operador' | 'prestador'

interface RolUsuario {
  idEmpresa:   number | null
  idSucursal:  number | null
  slugEmpresa: string | null   // slug de la sucursal principal (para link de reservas)
  idPrestador: number | null
  rol:         NombreRol | null
  loading:     boolean
}

/**
 * Obtiene la empresa, sucursal, slug y rol del usuario autenticado.
 * Si el usuario pertenece a múltiples empresas, devuelve la primera
 * (evolucionar a selector cuando sea necesario).
 */
export function useUserRole(): RolUsuario {
  const { session } = useAuth()
  const [idEmpresa,   setIdEmpresa]   = useState<number | null>(null)
  const [idSucursal,  setIdSucursal]  = useState<number | null>(null)
  const [slugEmpresa, setSlugEmpresa] = useState<string | null>(null)
  const [idPrestador, setIdPrestador] = useState<number | null>(null)
  const [rol,         setRol]         = useState<NombreRol | null>(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (!session) { setLoading(false); return }
    let activo = true
    setLoading(true)

    supabase
      .from('usuario_roles')
      .select('id_empresa, roles(nombre_rol)')
      .eq('id_usuario', session.user.id)
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!activo) return
        const empresa   = data?.id_empresa ?? null
        const rolNombre = (data?.roles as any)?.nombre_rol ?? null
        setIdEmpresa(empresa)
        setRol(rolNombre)

        // Obtener primera sucursal activa — usar su slug para el link de reservas
        if (empresa) {
          const { data: suc } = await supabase
            .from('sucursales')
            .select('id_sucursal, slug')
            .eq('id_empresa', empresa)
            .eq('activo', true)
            .order('id_sucursal')
            .limit(1)
            .maybeSingle()
          if (activo) {
            setIdSucursal(suc?.id_sucursal ?? null)
            setSlugEmpresa(suc?.slug ?? null)   // slug de sucursal, no de empresa
          }
        }

        if (rolNombre === 'prestador' && session) {
          const { data: prest } = await supabase
            .from('prestadores')
            .select('id_prestador')
            .eq('id_usuario', session.user.id)
            .maybeSingle()
          if (activo) setIdPrestador(prest?.id_prestador ?? null)
        }
        setLoading(false)
      })

    return () => { activo = false }
  }, [session])

  return { idEmpresa, idSucursal, slugEmpresa, idPrestador, rol, loading }
}

export const PUEDE_GESTIONAR_CATALOGO: NombreRol[] = ['admin', 'supervisor']
export const PUEDE_GESTIONAR_CLIENTES: NombreRol[] = ['admin', 'supervisor', 'recepcionista']
