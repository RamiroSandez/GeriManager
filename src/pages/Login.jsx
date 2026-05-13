import { useState } from "react"
import { Box, Button, Card, FieldLabel, FieldRoot, Heading, Input, Stack, Text } from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import { useAuth } from "../contexts/AuthContext"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [cargando, setCargando] = useState(false)
  const [modo, setModo] = useState("login") // "login" | "recuperar"
  const [enviado, setEnviado] = useState(false)
  const { loginConEmail, recuperarPassword, accesoDenegado } = useAuth()

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
      toaster.create({ title: "Email o contraseña incorrectos", type: "error", duration: 4000 })
    }
  }

  const handleRecuperar = async (e) => {
    e.preventDefault()
    if (!email) {
      toaster.create({ title: "Ingresá tu email", type: "warning", duration: 3000 })
      return
    }
    setCargando(true)
    const { error } = await recuperarPassword(email)
    setCargando(false)
    if (error) {
      toaster.create({ title: "Error al enviar el email", description: error.message, type: "error", duration: 4000 })
    } else {
      setEnviado(true)
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

        <Card.Root bg="bg.panel" borderRadius="2xl" boxShadow="lg" border="1px solid" borderColor="border.subtle">
          <Card.Body p={8}>

            {/* ── Modo login ── */}
            {modo === "login" && (
              <form onSubmit={handleLogin}>
                <Stack gap={4}>
                  {accesoDenegado && (
                    <Text fontSize="sm" color="red.500" textAlign="center" fontWeight="500">
                      Tu cuenta no tiene acceso. Contactá al administrador.
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
                  <Button type="submit" w="full" size="lg" colorPalette="teal" loading={cargando} mt={2}>
                    Ingresar
                  </Button>
                  <Text
                    fontSize="xs" color="teal.600" textAlign="center" cursor="pointer"
                    _hover={{ textDecoration: "underline" }}
                    onClick={() => { setModo("recuperar"); setEnviado(false) }}
                  >
                    ¿Olvidaste tu contraseña?
                  </Text>
                </Stack>
              </form>
            )}

            {/* ── Modo recuperar ── */}
            {modo === "recuperar" && (
              enviado ? (
                <Stack gap={4} align="center" textAlign="center">
                  <Text fontSize="2xl">📧</Text>
                  <Text fontWeight="700" color="text.main">Revisá tu email</Text>
                  <Text fontSize="sm" color="text.muted">
                    Te enviamos un link para restablecer tu contraseña a <strong>{email}</strong>
                  </Text>
                  <Button
                    variant="ghost" colorPalette="teal" size="sm"
                    onClick={() => { setModo("login"); setEnviado(false) }}
                  >
                    ← Volver al login
                  </Button>
                </Stack>
              ) : (
                <form onSubmit={handleRecuperar}>
                  <Stack gap={4}>
                    <Text fontWeight="700" fontSize="sm" color="text.main">Recuperar contraseña</Text>
                    <Text fontSize="xs" color="text.muted">
                      Ingresá tu email y te mandamos un link para crear una nueva contraseña.
                    </Text>
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
                    <Button type="submit" w="full" colorPalette="teal" loading={cargando}>
                      Enviar link de recuperación
                    </Button>
                    <Text
                      fontSize="xs" color="text.muted" textAlign="center" cursor="pointer"
                      _hover={{ color: "text.main" }}
                      onClick={() => setModo("login")}
                    >
                      ← Volver al login
                    </Text>
                  </Stack>
                </form>
              )
            )}

          </Card.Body>
        </Card.Root>

        <Text textAlign="center" mt={6} fontSize="xs" color="text.faint">
          Al ingresar aceptás los términos de uso de Domus
        </Text>
      </Box>
    </Box>
  )
}
