import { useCallback, useEffect, useState } from 'react'
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

  const [empresaId,  _setEmpresaId]  = useState<number | null>(null)
  const [sucursalId, setSucursalId] = useState<number | null>(null)

  /**
   * Resuelve la sucursal correcta para una empresa dada.
   * Lógica centralizada: supervisor → su sucursal si aplica; otros → la primera.
   */
  const resolverSucursal = useCallback((idEmpresa: number): number | null => {
    const subs = sucursales.filter(s => s.id_empresa === idEmpresa)
    if (subs.length === 0) return null
    if (esSupervisor && idSucursalUsuario && subs.some(s => s.id_sucursal === idSucursalUsuario)) {
      return idSucursalUsuario
    }
    return subs[0].id_sucursal
  }, [sucursales, esSupervisor, idSucursalUsuario])

  /**
   * Cambiar empresa: setea empresa Y sucursal en la misma llamada.
   * React 18 los batchea en un solo render, así las páginas nunca ven
   * una combinación empresa-nueva / sucursal-vieja.
   */
  const setEmpresaId = useCallback((id: number) => {
    _setEmpresaId(id)
    setSucursalId(resolverSucursal(id))
  }, [resolverSucursal])

  // Inicializar empresa: admin → la de nro más bajo; otros → la suya.
  // Solo corre una vez, cuando empresas carga por primera vez.
  useEffect(() => {
    if (!idEmpresaUsuario || empresas.length === 0) return
    if (empresaId !== null) return  // ya inicializado, no sobreescribir
    if (esAdmin) {
      const primera = empresas.reduce((min, e) => e.id_empresa < min.id_empresa ? e : min, empresas[0])
      _setEmpresaId(primera.id_empresa)
    } else {
      _setEmpresaId(idEmpresaUsuario)
    }
  }, [idEmpresaUsuario, empresas.length]) // eslint-disable-line

  // Cuando las sucursales llegan (async) y ya tenemos empresa pero aún no
  // tenemos sucursal, asignar la primera. Esto cubre la carga inicial donde
  // empresa se setea antes de que sucursales estén listas.
  useEffect(() => {
    if (!empresaId) return
    if (sucursalId !== null) {
      // Ya hay sucursal elegida: verificar que pertenezca a la empresa actual.
      // Si no (edge case: cambio rápido), corregir.
      const perteneceAEmpresa = sucursales.some(
        s => s.id_sucursal === sucursalId && s.id_empresa === empresaId
      )
      if (perteneceAEmpresa) return  // todo OK
    }
    // Sin sucursal o sucursal de otra empresa → resolver
    setSucursalId(resolverSucursal(empresaId))
  }, [empresaId, sucursales.length, sucursales.map(s => s.id_sucursal).join(',')]) // eslint-disable-line

  const sucursalesDeEmpresa = sucursales.filter(s => s.id_empresa === empresaId)

  return {
    empresaId, sucursalId,
    setEmpresaId, setSucursalId,
    esAdmin, esSupervisor,
    empresas, sucursalesDeEmpresa,
  }
}
