import { useState } from "react"
import { Box, Button, Card, FieldLabel, FieldRoot, Heading, Input, Stack, Text } from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import { useAuth } from "../contexts/AuthContext"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [cargando, setCargando] = useState(false)
  const { loginConEmail, accesoDenegado } = useAuth()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toaster.create({ title: "Completá email y contraseña", type: "warning", duration: 3000 })
      return
    }
    setCargando(true)
    const { error } = await loginConEmail(email, password)
    setCargando(false)
    if (error) {
      toaster.create({ title: "Error al iniciar sesión", description: error.message, type: "error", duration: 4000 })
    }
  }

  return (
    <Box minH="100vh" bg="bg.page" display="flex" alignItems="center" justifyContent="center" px={4}>
      <Toaster />
      <Box w="full" maxW="400px">

        {/* Logo */}
        <Stack align="center" mb={8} gap={2}>
          <img src="/favicon.png" alt="Domus" style={{ width: 72, height: 72, borderRadius: 16 }} />
          <Heading size="lg" color="text.main" letterSpacing="tight">Domus</Heading>
          <Text fontSize="sm" color="text.muted">Sistema de gestión geriátrica</Text>
        </Stack>

        {/* Card */}
        <Card.Root bg="bg.panel" borderRadius="2xl" boxShadow="lg" border="1px solid" borderColor="border.subtle">
          <Card.Body p={8}>
            <form onSubmit={handleLogin}>
              <Stack gap={4}>
                {accesoDenegado && (
                  <Text fontSize="sm" color="red.500" textAlign="center" fontWeight="500">
                    Tu cuenta no tiene acceso al sistema. Contactá al administrador.
                  </Text>
                )}
                <FieldRoot>
                  <FieldLabel fontSize="sm">Email</FieldLabel>
                  <Input
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel fontSize="sm">Contraseña</FieldLabel>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </FieldRoot>
                <Button
                  type="submit"
                  w="full" size="lg"
                  colorPalette="teal"
                  loading={cargando}
                  mt={2}
                >
                  Ingresar
                </Button>
              </Stack>
            </form>
          </Card.Body>
        </Card.Root>

        <Text textAlign="center" mt={6} fontSize="xs" color="text.faint">
          Al ingresar aceptás los términos de uso de Domus
        </Text>
      </Box>
    </Box>
  )
}
