import { useState, useEffect } from "react"
import { Box, Text } from "@chakra-ui/react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import AlertasPanel from "./AlertasPanel"

function IconPanel() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function IconPacientes() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconGastos() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function IconInstitucion() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function IconEquipo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z" />
      <path d="M20 21a8 8 0 1 0-16 0" />
    </svg>
  )
}

function IconSun() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function IconMedicamentos() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

function IconAmparos() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function IconPresentaciones() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

const NAV_ITEMS = [
  { label: "Panel", path: "/", icon: <IconPanel />, roles: ["admin", "gerente", "profesional"] },
  { label: "Pacientes", path: "/pacientes", icon: <IconPacientes />, roles: ["admin", "gerente", "profesional"] },
  { label: "Medicamentos", path: "/medicamentos", icon: <IconMedicamentos />, roles: ["admin", "gerente"] },
  { label: "Amparos", path: "/amparos", icon: <IconAmparos />, roles: ["admin", "gerente", "profesional"] },
  { label: "Presentaciones", path: "/presentaciones", icon: <IconPresentaciones />, roles: ["admin", "gerente", "profesional"] },
  { label: "Gastos", path: "/gastos", icon: <IconGastos />, roles: ["admin", "gerente"] },
  { label: "Equipo", path: "/equipo", icon: <IconEquipo />, roles: ["admin"] },
  { label: "Institución", path: "/institucion", icon: <IconInstitucion />, roles: ["admin"] },
]

function SidebarContent({ onNavigate, dark, toggleDark, geriatrico, user, rol, logout, navigate }) {
  const location = useLocation()
  const visibleLinks = NAV_ITEMS.filter(item => item.roles.includes(rol))
  const initiales = (geriatrico?.nombre_director || user?.user_metadata?.full_name || "??")
    .split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()

  return (
    <>
      {/* Logo */}
      <Box px={5} py={5} borderBottom="1px solid" borderColor="border.subtle">
        <Box display="flex" alignItems="center" gap={3} cursor="pointer" onClick={() => onNavigate("/")}>
          <img src="/favicon.png" alt="Domus" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <Box>
            <Text fontWeight="800" fontSize="sm" color="text.main" letterSpacing="tight" lineHeight="1.1">
              Domus
            </Text>
            <Text fontSize="10px" color="text.faint" lineHeight="1.2" noOfLines={1}>
              {geriatrico?.nombre || "Mi Geriátrico"}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Nav links */}
      <Box flex={1} py={4} px={3} overflowY="auto">
        {visibleLinks.map(({ label, path, icon }) => {
          const active = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)
          return (
            <Box
              key={path}
              onClick={() => onNavigate(path)}
              cursor="pointer"
              display="flex"
              alignItems="center"
              gap={3}
              px={3}
              py={2.5}
              borderRadius="lg"
              mb={1}
              bg={active ? "teal.600" : "transparent"}
              color={active ? "white" : "text.muted"}
              fontWeight={active ? "600" : "400"}
              fontSize="sm"
              _hover={{ bg: active ? "teal.600" : "bg.hover", color: active ? "white" : "text.main" }}
              transition="all 0.15s"
            >
              <Box opacity={active ? 1 : 0.7}>{icon}</Box>
              {label}
            </Box>
          )
        })}
      </Box>

      {/* Bottom: alertas + dark mode + user */}
      <Box px={3} py={4} borderTop="1px solid" borderColor="border.subtle">
        <Box display="flex" alignItems="center" gap={3} px={3} py={1} mb={1}>
          <AlertasPanel />
          <Text fontSize="sm" color="text.muted">Alertas</Text>
        </Box>

        <Box
          display="flex" alignItems="center" gap={3} px={3} py={2}
          borderRadius="lg" cursor="pointer" color="text.muted" fontSize="sm"
          _hover={{ bg: "bg.hover", color: "text.main" }}
          transition="all 0.15s"
          onClick={toggleDark}
          mb={2}
        >
          {dark ? <IconSun /> : <IconMoon />}
          {dark ? "Modo claro" : "Modo oscuro"}
        </Box>

        <Box
          display="flex" alignItems="center" gap={3} px={3} py={2}
          borderRadius="lg" cursor="pointer"
          _hover={{ bg: "bg.hover" }}
          transition="all 0.15s"
          onClick={async () => { await logout(); navigate("/login") }}
        >
          <Box
            w="28px" h="28px" borderRadius="full" bg="teal.600" color="white"
            fontSize="10px" fontWeight="700" display="flex"
            alignItems="center" justifyContent="center" flexShrink={0}
          >
            {initiales}
          </Box>
          <Box flex={1} overflow="hidden">
            <Text fontSize="xs" fontWeight="600" color="text.main" lineHeight="1.2" noOfLines={1}>
              {geriatrico?.nombre_director || user?.user_metadata?.full_name || "Director"}
            </Text>
            <Text fontSize="10px" color="text.faint" lineHeight="1.2">Cerrar sesión</Text>
          </Box>
          <Box color="text.faint"><IconLogout /></Box>
        </Box>
      </Box>
    </>
  )
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { geriatrico, logout, rol, user } = useAuth()
  const [dark, setDark] = useState(() => localStorage.getItem("geri-theme") === "dark")
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("geri-theme", next ? "dark" : "light")
  }

  const sharedProps = { dark, toggleDark, geriatrico, user, rol, logout, navigate }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <Box
        w="220px" minH="100vh"
        bg="bg.panel"
        borderRight="1px solid" borderColor="border.subtle"
        display={{ base: "none", lg: "flex" }}
        flexDirection="column"
        position="fixed" top={0} left={0}
        zIndex={100}
        boxShadow="1px 0 8px rgba(0,0,0,0.04)"
      >
        <SidebarContent onNavigate={navigate} {...sharedProps} />
      </Box>

      {/* ── Mobile top bar ──────────────────────────────────────────── */}
      <Box
        display={{ base: "flex", lg: "none" }}
        position="fixed" top={0} left={0} right={0}
        h="56px" zIndex={100}
        bg="bg.panel"
        borderBottom="1px solid" borderColor="border.subtle"
        px={4} alignItems="center" justifyContent="space-between"
        boxShadow="0 1px 8px rgba(0,0,0,0.06)"
      >
        {/* Logo */}
        <Box display="flex" alignItems="center" gap={2} cursor="pointer" onClick={() => navigate("/")}>
          <img src="/favicon.png" alt="Domus" style={{ width: 28, height: 28, borderRadius: 8 }} />
          <Text fontWeight="800" fontSize="sm" color="text.main">Domus</Text>
        </Box>

        {/* Derecha: alertas + hamburguesa */}
        <Box display="flex" alignItems="center" gap={1}>
          <AlertasPanel />
          <Box
            cursor="pointer" p={2} borderRadius="lg"
            color="text.muted"
            _hover={{ bg: "bg.hover", color: "text.main" }}
            transition="all 0.15s"
            onClick={() => setMobileOpen(v => !v)}
          >
            {mobileOpen ? <IconClose /> : <IconMenu />}
          </Box>
        </Box>
      </Box>

      {/* ── Mobile drawer ───────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          <Box
            position="fixed" inset={0} zIndex={200}
            bg="blackAlpha.600"
            onClick={() => setMobileOpen(false)}
          />
          <Box
            position="fixed" top={0} left={0} bottom={0}
            w="260px" zIndex={201}
            bg="bg.panel"
            display="flex" flexDirection="column"
            borderRight="1px solid" borderColor="border.subtle"
            boxShadow="xl"
          >
            <SidebarContent onNavigate={(path) => { navigate(path); setMobileOpen(false) }} {...sharedProps} />
          </Box>
        </>
      )}
    </>
  )
}
