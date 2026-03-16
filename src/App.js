import { Box } from "@chakra-ui/react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import Navbar from "./components/Navbar"
import Dashboard from "./pages/Dashboard"
import FichaPaciente from "./pages/FichaPaciente"
import Gastos from "./pages/Gastos"

function App() {
  return (
    <BrowserRouter>
      <Box minH="100vh" bg="gray.50">
        <Navbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/paciente/:id" element={<FichaPaciente />} />
          <Route path="/gastos" element={<Gastos />} />
        </Routes>
      </Box>
    </BrowserRouter>
  )
}

export default App
