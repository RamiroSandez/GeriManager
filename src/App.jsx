import { Box } from "@chakra-ui/react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import Navbar from "./components/Navbar"
import ProtectedRoute from "./components/ProtectedRoute"
import Panel from "./pages/Panel"
import Pacientes from "./pages/Pacientes"
import FichaPaciente from "./pages/FichaPaciente"
import Gastos from "./pages/Gastos"
import Login from "./pages/Login"
import Registro from "./pages/Registro"
import Equipo from "./pages/Equipo"
import Amparos from "./pages/Amparos"
import Presentaciones from "./pages/Presentaciones"
import Institucion from "./pages/Institucion"
import Medicamentos from "./pages/Medicamentos"
import ResetPassword from "./pages/ResetPassword"

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
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <Box minH="100vh" bg="bg.page" display="flex">
                <Navbar />
                <Box flex={1} ml={{ base: 0, lg: "220px" }} minH="100vh" pt={{ base: "56px", lg: 0 }}>
                  <Routes>
                    <Route path="/" element={<Panel />} />
                    <Route path="/pacientes" element={<Pacientes />} />
                    <Route path="/paciente/:id" element={<FichaPaciente />} />
                    <Route path="/gastos" element={<RolRoute roles={["admin", "gerente"]}><Gastos /></RolRoute>} />
                    <Route path="/amparos" element={<Amparos />} />
                    <Route path="/presentaciones" element={<Presentaciones />} />
                    <Route path="/equipo" element={<RolRoute roles={["admin"]}><Equipo /></RolRoute>} />
                    <Route path="/institucion" element={<RolRoute roles={["admin"]}><Institucion /></RolRoute>} />
                    <Route path="/medicamentos" element={<RolRoute roles={["admin", "gerente"]}><Medicamentos /></RolRoute>} />
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
