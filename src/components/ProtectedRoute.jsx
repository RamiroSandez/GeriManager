import { Navigate, useLocation } from "react-router-dom"
import { Box, Spinner } from "@chakra-ui/react"
import { useAuth } from "../contexts/AuthContext"

export default function ProtectedRoute({ children }) {
  const { user, cargando, setupPendiente } = useAuth()
  const location = useLocation()

  if (cargando) {
    return (
      <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="bg.page">
        <Spinner size="lg" color="teal.500" />
      </Box>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (setupPendiente && location.pathname !== "/registro") {
    return <Navigate to="/registro" replace />
  }

  return children
}
