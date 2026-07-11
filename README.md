# Nexus Booking — Frontend

React + TypeScript + Vite, sin librerías de UI (CSS propio). Conectado a Supabase.

## Poner a andar en CodeSandbox

1. Crea un Sandbox de tipo **Vite + React + TypeScript** (o importa esta carpeta completa).
2. Copia `.env.example` a `.env` y verifica los valores (ya están puestos, son las llaves públicas del proyecto):
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
3. `npm install`
4. `npm run dev`
5. Regístrate desde la pantalla de login (crea un usuario en Supabase Auth). Avísame el correo para asignarte el rol `admin` en `usuario_roles`.

## Qué incluye

- **Auth**: login/registro contra Supabase Auth (`src/services/authService.ts`, `src/hooks/useAuth.tsx`).
- **Calendario semanal** (`src/pages/CalendarPage.tsx` + `src/components/Calendar/*`): bloques coloreados por estado, click en un slot vacío para agendar, click en una cita para cancelarla. El bloqueo de doble-reserva lo hace la base de datos (`EXCLUDE` constraint); el frontend solo traduce ese error a un mensaje legible (`DobleReservaError`).
- **CRUD** de Clientes, Prestadores, Servicios y Sucursales, todos usando el mismo componente genérico `CrudPage` para evitar repetir código.
- **Capa de servicios** separada de la UI (`src/services/`), como pediste en la arquitectura.

## Pendiente / próximos pasos

- `ID_EMPRESA` / `ID_SUCURSAL` están fijos en `CalendarPage.tsx` (línea con el comentario TODO) porque hoy solo existe una empresa. Cuando haya roles reales en `usuario_roles`, esto debe leerse de la sesión, no estar hardcodeado.
- El modal de nueva cita no valida horarios de trabajo del prestador ni sus descansos (`prestador_horarios`, `prestador_descansos`) — hoy solo respeta el rango 08:00–20:00 fijo del calendario.
- Falta la vista diaria (solo está la semanal).
