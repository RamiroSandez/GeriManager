import { Box, Button, Heading, HStack } from "@chakra-ui/react"
import { useNavigate, useLocation } from "react-router-dom"

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Box bg="blue.600" px={6} py={3} boxShadow="sm">
      <HStack justify="space-between">
        <Heading
          size="md"
          color="white"
          cursor="pointer"
          onClick={() => navigate("/")}
        >
          Gestor de Amparos
        </Heading>
        <HStack gap={2}>
          <Button
            variant="ghost"
            size="sm"
            color="white"
            _hover={{ bg: "blue.500" }}
            fontWeight={location.pathname === "/" ? "700" : "400"}
            onClick={() => navigate("/")}
          >
            Pacientes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            color="white"
            _hover={{ bg: "blue.500" }}
            fontWeight={location.pathname === "/gastos" ? "700" : "400"}
            onClick={() => navigate("/gastos")}
          >
            Gastos
          </Button>
        </HStack>
      </HStack>
    </Box>
  )
}
