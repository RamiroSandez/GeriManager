import { useState, useEffect } from "react"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"
import {
  Box, Button, Card, FieldLabel, FieldRoot,
  Grid, Heading, HStack, Input, Spinner, Stack, Text,
} from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"

export default function Institucion() {
  const { geriatrico, user, refreshGeriatrico } = useAuth()
  const [form, setForm] = useState({
    nombre: "",
    nombre_director: "",
    telefono: "",
    email_contacto: "",
    direccion: "",
    localidad: "",
    provincia: "",
    capacidad: "",
  })
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [totalPacientes, setTotalPacientes] = useState(0)

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!geriatrico?.id) return
    setForm({
      nombre: geriatrico.nombre || "",
      nombre_director: geriatrico.nombre_director || "",
      telefono: geriatrico.telefono || "",
      email_contacto: geriatrico.email_contacto || "",
      direccion: geriatrico.direccion || "",
      localidad: geriatrico.localidad || "",
      provincia: geriatrico.provincia || "",
      capacidad: geriatrico.capacidad || "",
    })
    supabase
      .from("Pacientes")
      .select("id", { count: "exact" })
      .eq("geriatrico_id", geriatrico.id)
      .then(({ count }) => setTotalPacientes(count || 0))
    setCargando(false)
  }, [geriatrico?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    setGuardando(true)
    const { error } = await supabase
      .from("geriatricos")
      .update({
        nombre: form.nombre,
        nombre_director: form.nombre_director,
        telefono: form.telefono || null,
        email_contacto: form.email_contacto || null,
        direccion: form.direccion || null,
        localidad: form.localidad || null,
        provincia: form.provincia || null,
        capacidad: form.capacidad ? parseInt(form.capacidad) : null,
      })
      .eq("id", geriatrico.id)
    setGuardando(false)
    if (error) {
      toaster.create({ title: "Error al guardar", description: error.message, type: "error", duration: 4000 })
    } else {
      toaster.create({ title: "Datos actualizados", type: "success", duration: 2000 })
      await refreshGeriatrico()
    }
  }

  const ocupacion = form.capacidad > 0
    ? Math.round((totalPacientes / parseInt(form.capacidad)) * 100)
    : null

  if (cargando) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={20}>
        <Spinner size="xl" color="blue.500" />
      </Box>
    )
  }

  return (
    <Box px={6} py={6} maxW="800px">
      <Toaster />

      <Box mb={6}>
        <Heading size="lg" color="text.main">Institución</Heading>
        <Text fontSize="sm" color="text.muted">Datos y configuración de tu geriátrico</Text>
      </Box>

      {/* Stats de ocupación */}
      {form.capacidad > 0 && (
        <Grid templateColumns="repeat(3, 1fr)" gap={4} mb={6}>
          <Card.Root borderRadius="xl" boxShadow="sm" bg="blue.600" color="white">
            <Card.Body py={4} px={5}>
              <Text fontSize="xs" opacity={0.8} mb={1} fontWeight="500">Ocupación</Text>
              <Text fontSize="2xl" fontWeight="800">{ocupacion}%</Text>
              <Text fontSize="xs" opacity={0.7} mt={1}>{totalPacientes} de {form.capacidad} plazas</Text>
            </Card.Body>
          </Card.Root>
          <Card.Root borderRadius="xl" boxShadow="sm" bg="bg.panel">
            <Card.Body py={4} px={5}>
              <Text fontSize="xs" color="text.faint" mb={1} fontWeight="500">Plazas ocupadas</Text>
              <Text fontSize="2xl" fontWeight="700" color="text.main">{totalPacientes}</Text>
              <Text fontSize="xs" color="text.faint" mt={1}>pacientes activos</Text>
            </Card.Body>
          </Card.Root>
          <Card.Root borderRadius="xl" boxShadow="sm" bg="bg.panel">
            <Card.Body py={4} px={5}>
              <Text fontSize="xs" color="text.faint" mb={1} fontWeight="500">Plazas libres</Text>
              <Text fontSize="2xl" fontWeight="700" color={parseInt(form.capacidad) - totalPacientes > 0 ? "green.600" : "red.500"}>
                {Math.max(0, parseInt(form.capacidad) - totalPacientes)}
              </Text>
              <Text fontSize="xs" color="text.faint" mt={1}>disponibles</Text>
            </Card.Body>
          </Card.Root>
        </Grid>
      )}

      {/* Formulario */}
      <Stack gap={5}>
        {/* Datos generales */}
        <Card.Root borderRadius="xl" boxShadow="md">
          <Card.Header>
            <Heading size="sm" color="text.main">Datos generales</Heading>
          </Card.Header>
          <Card.Body>
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
              <FieldRoot gridColumn={{ md: "span 2" }}>
                <FieldLabel fontSize="sm">Nombre del geriátrico *</FieldLabel>
                <Input value={form.nombre} onChange={e => set("nombre", e.target.value)} />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Director/a *</FieldLabel>
                <Input value={form.nombre_director} onChange={e => set("nombre_director", e.target.value)} />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Capacidad (plazas)</FieldLabel>
                <Input
                  type="number" min={0}
                  value={form.capacidad}
                  onChange={e => set("capacidad", e.target.value)}
                  placeholder="Ej: 30"
                />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Teléfono</FieldLabel>
                <Input value={form.telefono} onChange={e => set("telefono", e.target.value)} placeholder="+54 11 1234-5678" />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Email de contacto</FieldLabel>
                <Input type="email" value={form.email_contacto} onChange={e => set("email_contacto", e.target.value)} placeholder="contacto@geriatrico.com" />
              </FieldRoot>
            </Grid>
          </Card.Body>
        </Card.Root>

        {/* Ubicación */}
        <Card.Root borderRadius="xl" boxShadow="md">
          <Card.Header>
            <Heading size="sm" color="text.main">Ubicación</Heading>
          </Card.Header>
          <Card.Body>
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
              <FieldRoot gridColumn={{ md: "span 2" }}>
                <FieldLabel fontSize="sm">Dirección</FieldLabel>
                <Input value={form.direccion} onChange={e => set("direccion", e.target.value)} placeholder="Av. Corrientes 1234" />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Localidad</FieldLabel>
                <Input value={form.localidad} onChange={e => set("localidad", e.target.value)} placeholder="Buenos Aires" />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Provincia</FieldLabel>
                <Input value={form.provincia} onChange={e => set("provincia", e.target.value)} placeholder="Buenos Aires" />
              </FieldRoot>
            </Grid>
          </Card.Body>
        </Card.Root>

        {/* Cuenta */}
        <Card.Root borderRadius="xl" boxShadow="md">
          <Card.Header>
            <Heading size="sm" color="text.main">Cuenta</Heading>
          </Card.Header>
          <Card.Body>
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
              <FieldRoot>
                <FieldLabel fontSize="sm">Email de acceso</FieldLabel>
                <Input value={user?.email || ""} disabled bg="bg.muted" color="text.faint" />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Plan</FieldLabel>
                <Input value="Free" disabled bg="bg.muted" color="text.faint" />
              </FieldRoot>
            </Grid>
          </Card.Body>
        </Card.Root>

        <HStack>
          <Button colorPalette="blue" onClick={guardar} loading={guardando}>
            Guardar cambios
          </Button>
        </HStack>
      </Stack>
    </Box>
  )
}
