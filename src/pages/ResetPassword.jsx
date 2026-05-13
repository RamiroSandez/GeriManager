import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Box, Button, Card, FieldLabel, FieldRoot, Heading, Input, Stack, Text } from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import { supabase } from "../services/supabase"

export default function ResetPassword() {
  const [password, setPassword] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const [cargando, setCargando] = useState(false)
  const [listo, setListo] = useState(false)
  const [sesionLista, setSesionLista] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setSesionLista(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password || password.length < 6) {
      toaster.create({ title: "La contraseña debe tener al menos 6 caracteres", type: "warning", duration: 3000 })
      return
    }
    if (password !== confirmacion) {
      toaster.create({ title: "Las contraseñas no coinciden", type: "error", duration: 3000 })
      return
    }
    setCargando(true)
    const { error } = await supabase.auth.updateUser({ password })
    setCargando(false)
    if (error) {
      toaster.create({ title: "Error al actualizar", description: error.message, type: "error", duration: 5000 })
    } else {
      setListo(true)
      setTimeout(() => navigate("/login"), 3000)
    }
  }

  return (
    <Box minH="100vh" bg="bg.page" display="flex" alignItems="center" justifyContent="center" px={4}>
      <Toaster />
      <Box w="full" maxW="400px">
        <Stack align="center" mb={8} gap={2}>
          <img src="/favicon.png" alt="Domus" style={{ width: 72, height: 72, borderRadius: 16 }} />
          <Heading size="lg" color="text.main" letterSpacing="tight">Domus</Heading>
          <Text fontSize="sm" color="text.muted">Nueva contraseña</Text>
        </Stack>

        <Card.Root bg="bg.panel" borderRadius="2xl" boxShadow="lg" border="1px solid" borderColor="border.subtle">
          <Card.Body p={8}>
            {listo ? (
              <Stack gap={4} align="center" textAlign="center">
                <Text fontSize="2xl">✅</Text>
                <Text fontWeight="700" color="text.main">Contraseña actualizada</Text>
                <Text fontSize="sm" color="text.muted">Redirigiendo al login...</Text>
              </Stack>
            ) : !sesionLista ? (
              <Stack gap={4} align="center" textAlign="center">
                <Text fontSize="2xl">🔗</Text>
                <Text fontWeight="700" color="text.main">Verificando enlace</Text>
                <Text fontSize="sm" color="text.muted">
                  Si llegaste desde el email de recuperación, esperá un momento. Si este mensaje no desaparece,
                  el enlace expiró o ya fue usado.
                </Text>
                <Button variant="ghost" colorPalette="teal" size="sm" onClick={() => navigate("/login")}>
                  ← Volver al login
                </Button>
              </Stack>
            ) : (
              <form onSubmit={handleSubmit}>
                <Stack gap={4}>
                  <Text fontWeight="700" fontSize="sm" color="text.main">Elegí tu nueva contraseña</Text>
                  <FieldRoot>
                    <FieldLabel fontSize="sm">Nueva contraseña</FieldLabel>
                    <Input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </FieldRoot>
                  <FieldRoot>
                    <FieldLabel fontSize="sm">Confirmá la contraseña</FieldLabel>
                    <Input
                      type="password"
                      placeholder="Repetí la contraseña"
                      value={confirmacion}
                      onChange={e => setConfirmacion(e.target.value)}
                      autoComplete="new-password"
                    />
                  </FieldRoot>
                  <Button type="submit" w="full" colorPalette="teal" size="lg" loading={cargando} mt={2}>
                    Guardar contraseña
                  </Button>
                </Stack>
              </form>
            )}
          </Card.Body>
        </Card.Root>
      </Box>
    </Box>
  )
}
