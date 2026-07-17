import { useEffect, useState } from 'react'
import { useUserRole } from './useUserRole'
import { useEmpresasSucursales } from './useEmpresasSucursales'
import type { Sucursal, Empresa } from '../types'

export interface FiltroEmpresaState {
  empresaId:    number | null
  sucursalId:   number | null
  setEmpresaId: (id: number) => void
  setSucursalId:(id: number) => void
  esAdmin:      boolean
  esSupervisor: boolean
  empresas:     Empresa[]
  sucursalesDeEmpresa: Sucursal[]
}

export function useFiltroEmpresa(): FiltroEmpresaState {
  const { idEmpresa: idEmpresaUsuario, idSucursal: idSucursalUsuario, rol } = useUserRole()
  const { empresas, sucursales } = useEmpresasSucursales()

  const esAdmin      = rol === 'admin'
  const esSupervisor = rol === 'supervisor'

  const [empresaId,  setEmpresaId]  = useState<number | null>(null)
  const [sucursalId, setSucursalId] = useState<number | null>(null)

  // Inicializar empresa: admin → la de id más bajo; otros → la suya
  useEffect(() => {
    if (!idEmpresaUsuario || empresas.length === 0) return
    if (empresaId !== null) return  // ya inicializado, no sobreescribir
    if (esAdmin) {
      const primera = empresas.reduce((min, e) => e.id_empresa < min.id_empresa ? e : min, empresas[0])
      setEmpresaId(primera.id_empresa)
    } else {
      setEmpresaId(idEmpresaUsuario)
    }
  }, [idEmpresaUsuario, empresas.length]) // eslint-disable-line

  // Cuando cambia empresa, resetear sucursal a la primera de esa empresa
  useEffect(() => {
    if (!empresaId) return
    const subs = sucursales.filter(s => s.id_empresa === empresaId)
    if (subs.length === 0) { setSucursalId(null); return }
    if (esSupervisor && idSucursalUsuario && subs.some(s => s.id_sucursal === idSucursalUsuario)) {
      setSucursalId(idSucursalUsuario)
    } else {
      setSucursalId(subs[0].id_sucursal)
    }
  }, [empresaId, sucursales.length, sucursales.map(s => s.id_sucursal).join(',')]) // eslint-disable-line

  const sucursalesDeEmpresa = sucursales.filter(s => s.id_empresa === empresaId)

  return {
    empresaId, sucursalId,
    setEmpresaId, setSucursalId,
    esAdmin, esSupervisor,
    empresas, sucursalesDeEmpresa,
  }
}
