import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { AdminThemeProvider } from '../../context/AdminThemeContext'

export function AppShell() {
  const [sidebarAbierto, setSidebarAbierto] = useState(false)

  return (
    <AdminThemeProvider>
      <div className="app-shell">
        {/* Topbar móvil */}
        <div className="mobile-topbar">
          <button
            className="mobile-topbar__menu"
            aria-label="Abrir menú"
            onClick={() => setSidebarAbierto(true)}
          >
            ☰
          </button>
          <span className="mobile-topbar__brand">Nexus Booking</span>
        </div>

        {sidebarAbierto && (
          <div className="sidebar-overlay" onClick={() => setSidebarAbierto(false)} />
        )}

        <Sidebar abierto={sidebarAbierto} onNavegar={() => setSidebarAbierto(false)} />

        <main className="adm-main">
          <Outlet />
        </main>
      </div>
    </AdminThemeProvider>
  )
}
