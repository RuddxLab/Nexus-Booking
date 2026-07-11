import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const [sidebarAbierto, setSidebarAbierto] = useState(false)

  return (
    <div className="app-shell">
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

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
