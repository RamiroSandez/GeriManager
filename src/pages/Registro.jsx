import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Box, Button, Card, FieldLabel, FieldRoot, Grid, Heading, Input, Spinner, Stack, Text, Badge } from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import { useAuth } from "../contexts/AuthContext"
import { supabase } from "../services/supabase"
import { ROLES_GERIATRICO } from "../utils/constants"

export default function Registro() {
  const [form, setForm] = useState({ nombreGeriatrico: "", nombreDirector: "", telefono: "" })
  const [cargando, setCargando] = useState(false)
  const [buscandoInvitacion, setBuscandoInvitacion] = useState(true)
  const [invitacion, setInvitacion] = useState(null)
  const { crearGeriatrico, aceptarInvitacion, user, logout, geriatrico } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (geriatrico) navigate("/")
  }, [geriatrico, navigate])

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!user?.email) { setBuscandoInvitacion(false); return }
    supabase
      .from("invitaciones")
      .select("*, geriatricos(nombre)")
      .eq("email", user.email)
      .eq("aceptada", false)
      .maybeSingle()
      .then(({ data }) => {
        setInvitacion(data || null)
        setBuscandoInvitacion(false)
      })
  }, [user?.email])

  const handleAceptar = async () => {
    setCargando(true)
    const { error } = await aceptarInvitacion(invitacion)
    setCargando(false)
    if (error) {
      toaster.create({ title: "Error al unirse", description: error.message, type: "error", duration: 5000 })
    } else {
      toaster.create({ title: "¡Bienvenido!", description: `Te uniste a ${invitacion.geriatricos.nombre}`, type: "success", duration: 2000 })
    }
  }

  const handleSetup = async (e) => {
    e.preventDefault()
    if (!form.nombreGeriatrico || !form.nombreDirector) {
      toaster.create({ title: "Completá nombre del geriátrico y del director", type: "warning", duration: 3000 })
      return
    }
    setCargando(true)
    const { error } = await crearGeriatrico(form)
    setCargando(false)
    if (error) {
      toaster.create({ title: "Error al guardar", description: error.message, type: "error", duration: 5000 })
    } else {
      toaster.create({ title: "¡Geriátrico creado!", description: "Bienvenido a Domus", type: "success", duration: 2000 })
    }
  }

  return (
    <Box minH="100vh" bg="bg.page" display="flex" alignItems="center" justifyContent="center" px={4} py={8}>
      <Toaster />
      <Box w="full" maxW="480px">
        <Stack align="center" mb={8} gap={2}>
          <img src="/favicon.png" alt="Domus" style={{ width: 72, height: 72, borderRadius: 16 }} />
          <Heading size="lg" color="text.main" letterSpacing="tight">Domus</Heading>
          <Text fontSize="sm" color="text.muted">
            Hola {user?.user_metadata?.full_name || user?.email}
          </Text>
        </Stack>

        {buscandoInvitacion ? (
          <Box display="flex" justifyContent="center" py={10}>
            <Spinner size="lg" color="teal.500" />
          </Box>
        ) : invitacion ? (
          /* Invitation acceptance card */
          <Card.Root bg="bg.panel" borderRadius="2xl" boxShadow="lg" border="1px solid" borderColor="border.subtle">
            <Card.Body p={8}>
              <Stack gap={5} align="center" textAlign="center">
                <Text fontSize="2xl">🎉</Text>
                <Stack gap={1}>
                  <Text fontWeight="700" fontSize="lg" color="text.main">Fuiste invitado a unirte</Text>
                  <Text color="text.muted" fontSize="sm">{invitacion.geriatricos?.nombre}</Text>
                </Stack>
                <Badge colorPalette={ROLES_GERIATRICO[invitacion.rol]?.color} variant="subtle" borderRadius="full" px={4} py={1} fontSize="sm">
                  {ROLES_GERIATRICO[invitacion.rol]?.label}
                </Badge>
                <Button colorPalette="teal" size="lg" w="full" onClick={handleAceptar} loading={cargando}>
                  Aceptar invitación
                </Button>
              </Stack>
            </Card.Body>
          </Card.Root>
        ) : (
          /* Create geriatrico form */
          <Card.Root bg="bg.panel" borderRadius="2xl" boxShadow="lg" border="1px solid" borderColor="border.subtle">
            <Card.Body p={8}>
              <form onSubmit={handleSetup}>
                <Stack gap={5}>
                  <Text fontSize="xs" fontWeight="700" color="teal.600" textTransform="uppercase" letterSpacing="wide">
                    Configurá tu geriátrico
                  </Text>
                  <FieldRoot>
                    <FieldLabel fontSize="sm" color="text.main">Nombre del geriátrico *</FieldLabel>
                    <Input
                      placeholder='Ej: Residencia "Del Este"'
                      value={form.nombreGeriatrico}
                      onChange={e => set("nombreGeriatrico", e.target.value)}
                      bg="bg.muted" border="1px solid" borderColor="border.subtle"
                    />
                  </FieldRoot>
                  <Grid templateColumns="1fr 1fr" gap={4}>
                    <FieldRoot>
                      <FieldLabel fontSize="sm" color="text.main">Nombre del director *</FieldLabel>
                      <Input
                        placeholder="Dr. Apellido"
                        value={form.nombreDirector}
                        onChange={e => set("nombreDirector", e.target.value)}
                        bg="bg.muted" border="1px solid" borderColor="border.subtle"
                      />
                    </FieldRoot>
                    <FieldRoot>
                      <FieldLabel fontSize="sm" color="text.main">Teléfono</FieldLabel>
                      <Input
                        placeholder="11 1234-5678"
                        value={form.telefono}
                        onChange={e => set("telefono", e.target.value)}
                        bg="bg.muted" border="1px solid" borderColor="border.subtle"
                      />
                    </FieldRoot>
                  </Grid>
                  <Button type="submit" colorPalette="teal" size="lg" w="full" loading={cargando} mt={2}>
                    Crear geriátrico
                  </Button>
                </Stack>
              </form>
            </Card.Body>
          </Card.Root>
        )}

        <Text
          textAlign="center" mt={4} fontSize="sm" color="text.muted"
          cursor="pointer" _hover={{ color: "text.main" }} onClick={logout}
        >
          Cerrar sesión
        </Text>
      </Box>
    </Box>
  )
}
