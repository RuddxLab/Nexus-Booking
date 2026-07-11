import { useEffect, useState } from 'react'
import { empresasService, sucursalesService } from '../services/entityServices'
import { supabase } from '../services/supabaseClient'
import { useUserRole } from './useUserRole'
import type { Empresa, Sucursal, Categoria } from '../types'

export function useEmpresasSucursales() {
  const { idEmpresa } = useUserRole()
  const [empresas,   setEmpresas]   = useState<Empresa[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])

  useEffect(() => {
    // Empresas: siempre cargar (admin necesita verlas todas)
    empresasService.listAll('nombre_empresa').then(setEmpresas).catch(() => setEmpresas([]))
    // Sucursales y categorías: esperar a que idEmpresa esté disponible
    if (!idEmpresa) return
    sucursalesService.listAll('nombre_sucursal', idEmpresa).then(setSucursales).catch(() => setSucursales([]))
    supabase.from('categorias').select('*').eq('id_empresa', idEmpresa).eq('activo', true).order('nombre_categoria')
      .then(({ data }) => setCategorias((data ?? []) as Categoria[]))
  }, [idEmpresa])

  const nombreEmpresa   = (id: number) => empresas.find((e)  => e.id_empresa   === id)?.nombre_empresa   ?? String(id)
  const nombreSucursal  = (id: number) => sucursales.find((s) => s.id_sucursal  === id)?.nombre_sucursal  ?? String(id)
  const nombreCategoria = (id: number) => categorias.find((c) => c.id_categoria === id)?.nombre_categoria ?? String(id)

  const opcionesEmpresa  = empresas.map((e) => ({ value: e.id_empresa,   label: e.nombre_empresa }))
  const opcionesSucursal = sucursales.map((s) => ({ value: s.id_sucursal, label: s.nombre_sucursal }))

  const opcionesCategorias = (filtrarEmpresa?: number) =>
    categorias
      .filter(c => !filtrarEmpresa || c.id_empresa === filtrarEmpresa)
      .map(c => ({ value: c.id_categoria, label: c.nombre_categoria }))

  return {
    empresas, sucursales, categorias,
    nombreEmpresa, nombreSucursal, nombreCategoria,
    opcionesEmpresa, opcionesSucursal, opcionesCategorias,
  }
}
