import { Box } from "@chakra-ui/react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import Navbar from "./components/Navbar"
import ProtectedRoute from "./components/ProtectedRoute"
import Dashboard from "./pages/Dashboard"
import FichaPaciente from "./pages/FichaPaciente"
import Gastos from "./pages/Gastos"
import Login from "./pages/Login"
import Registro from "./pages/Registro"
import Equipo from "./pages/Equipo"
import Amparos from "./pages/Amparos"

function RolRoute({ roles, children }) {
  const { rol } = useAuth()
  return roles.includes(rol) ? children : <Navigate to="/" replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <Box minH="100vh" bg="bg.page" display="flex">
                <Navbar />
                <Box flex={1} ml="220px" minH="100vh">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/paciente/:id" element={<FichaPaciente />} />
                    <Route path="/gastos" element={<RolRoute roles={["admin", "gerente"]}><Gastos /></RolRoute>} />
                    <Route path="/amparos" element={<Amparos />} />
                    <Route path="/equipo" element={<RolRoute roles={["admin"]}><Equipo /></RolRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Box>
              </Box>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
