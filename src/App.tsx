import { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { useUserRole, PUEDE_GESTIONAR_CATALOGO, PUEDE_VENDER } from './hooks/useUserRole'
import { TenantProvider } from './context/TenantContext'
import { AppShell } from './components/Layout/AppShell'
import { BadgeAmbiente } from './components/Common/BadgeAmbiente'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CalendarPage } from './pages/CalendarPage'
import { ClientesPage } from './pages/ClientesPage'
import { PrestadoresPage } from './pages/PrestadoresPage'
import { ServiciosPage } from './pages/ServiciosPage'
import { ProductosPage } from './pages/ProductosPage'
import { DescuentosPage } from './pages/DescuentosPage'
import { GiftCardsPage } from './pages/GiftCardsPage'
import { VentasPage } from './pages/VentasPage'
import { SucursalesPage } from './pages/SucursalesPage'
import { EmpresasPage } from './pages/EmpresasPage'
import { HorariosPage } from './pages/HorariosPage'
import { AusenciasPage } from './pages/AusenciasPage'
import { ReservarPage } from './pages/ReservarPage'
import { CancelarPage } from './pages/CancelarPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { PrestadorServiciosPage } from './pages/PrestadorServiciosPage'
import { PrestadorSucursalesPage } from './pages/PrestadorSucursalesPage'
import { CategoriasPage } from './pages/CategoriasPage'
import { TipoCategoriasPage } from './pages/TipoCategoriasPage'
import { TemaEmpresaPage } from './pages/TemaEmpresaPage'

/**
 * Rutas legacy sin slug → redirige al login de admin.
 * En PROD no hay un slug por defecto; cada empresa tiene su propia URL /r/:slug
 */
function CancelarCompat() {
  return <Navigate to="/admin/login" replace />
}

// ── Wrappers de tenant ────────────────────────────────────────────────────────

/**
 * Lee el :slug de la URL e inyecta el TenantProvider.
 * Todas las rutas públicas (/r/:slug/*) están bajo este wrapper.
 */
function TenantRoute({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>()
  if (!slug) return <Navigate to="/" replace />
  return <TenantProvider slug={slug}>{children}</TenantProvider>
}

// ── Guards de admin ───────────────────────────────────────────────────────────

function RutaLogin() {
  const { session, loading, esRecovery } = useAuth()
  if (loading) return <div style={{ padding: 40 }}>Cargando…</div>
  // Si hay sesión de recovery, quedarse en login para cambiar contraseña
  if (session && !esRecovery) return <Navigate to="/admin" replace />
  return <LoginPage />
}

function RutaSoloCatalogo({ children }: { children: ReactNode }) {
  const { rol, loading } = useUserRole()
  if (loading) return <div style={{ padding: 40 }}>Cargando…</div>
  if (!rol || !PUEDE_GESTIONAR_CATALOGO.includes(rol)) return <Navigate to="/admin" replace />
  return <>{children}</>
}

function RutaVentas({ children }: { children: ReactNode }) {
  const { rol, loading } = useUserRole()
  if (loading) return <div style={{ padding: 40 }}>Cargando…</div>
  if (!rol || !PUEDE_VENDER.includes(rol)) return <Navigate to="/admin" replace />
  return <>{children}</>
}

function RutaSoloAdmin({ children }: { children: ReactNode }) {
  const { rol, loading } = useUserRole()
  if (loading) return <div style={{ padding: 40 }}>Cargando…</div>
  if (rol !== 'admin') return <Navigate to="/admin" replace />
  return <>{children}</>
}

function RutasProtegidas() {
  const { session, loading } = useAuth()
  if (loading) return <div style={{ padding: 40 }}>Cargando…</div>
  if (!session) return <Navigate to="/admin/login" replace />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/"            element={<CalendarPage />} />
        <Route path="/dashboard"   element={<RutaSoloCatalogo><DashboardPage /></RutaSoloCatalogo>} />
        <Route path="/clientes"    element={<RutaSoloCatalogo><ClientesPage /></RutaSoloCatalogo>} />
        <Route path="/prestadores" element={<RutaSoloCatalogo><PrestadoresPage /></RutaSoloCatalogo>} />
        <Route path="/prestador-sucursales" element={<RutaSoloCatalogo><PrestadorSucursalesPage /></RutaSoloCatalogo>} />
        <Route path="/servicios"           element={<RutaSoloCatalogo><ServiciosPage /></RutaSoloCatalogo>} />
        <Route path="/productos"           element={<RutaSoloCatalogo><ProductosPage /></RutaSoloCatalogo>} />
        <Route path="/descuentos"          element={<RutaSoloCatalogo><DescuentosPage /></RutaSoloCatalogo>} />
        <Route path="/gift-cards"          element={<RutaVentas><GiftCardsPage /></RutaVentas>} />
        <Route path="/ventas"              element={<RutaVentas><VentasPage /></RutaVentas>} />
        <Route path="/prestador-servicios" element={<RutaSoloCatalogo><PrestadorServiciosPage /></RutaSoloCatalogo>} />
        <Route path="/categorias"          element={<RutaSoloCatalogo><CategoriasPage /></RutaSoloCatalogo>} />
        <Route path="/tipo-categorias"     element={<RutaSoloCatalogo><TipoCategoriasPage /></RutaSoloCatalogo>} />
        <Route path="/sucursales"  element={<RutaSoloCatalogo><SucursalesPage /></RutaSoloCatalogo>} />
        <Route path="/empresas"    element={<RutaSoloAdmin><EmpresasPage /></RutaSoloAdmin>} />
        <Route path="/usuarios"    element={<RutaSoloCatalogo><UsuariosPage /></RutaSoloCatalogo>} />
        <Route path="/horarios"    element={<RutaSoloCatalogo><HorariosPage /></RutaSoloCatalogo>} />
        <Route path="/ausencias"   element={<RutaSoloCatalogo><AusenciasPage /></RutaSoloCatalogo>} />
        <Route path="/tema"        element={<RutaSoloCatalogo><TemaEmpresaPage /></RutaSoloCatalogo>} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

// ── App root ──────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        {/* Banda de ambiente: visible en LOCAL y QA, invisible en PROD. */}
        <BadgeAmbiente />
        <BrowserRouter>
          <Routes>
            {/* ── Rutas públicas por tenant (slug) ─────────────────────── */}
            <Route path="/r/:slug" element={<TenantRoute><ReservarPage /></TenantRoute>} />
            <Route path="/r/:slug/reservar" element={<TenantRoute><ReservarPage /></TenantRoute>} />
            <Route path="/r/:slug/cancelar" element={<TenantRoute><CancelarPage /></TenantRoute>} />

            {/* ── Admin ────────────────────────────────────────────────── */}
            <Route path="/admin/login" element={<RutaLogin />} />
            <Route path="/admin/*"     element={<RutasProtegidas />} />

            {/* ── Compat: rutas antiguas sin slug ──────────────────────── */}
            {/* En PROD redirigen al login; cada empresa usa /r/:slug        */}
            <Route path="/cancelar" element={<CancelarCompat />} />
            <Route path="/reservar" element={<Navigate to="/admin/login" replace />} />
            <Route path="/"         element={<Navigate to="/admin/login" replace />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/admin/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
