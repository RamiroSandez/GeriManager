import { useState, useEffect } from "react"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"
import {
  Badge, Box, Button, Card, FieldLabel, FieldRoot,
  Grid, Heading, Input, NativeSelect, Spinner,
  Stack, Table, Text,
} from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import { ROLES_GERIATRICO } from "../utils/constants"

export default function Equipo() {
  const { geriatrico, user } = useAuth()
  const [miembros, setMiembros] = useState([])
  const [invitaciones, setInvitaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ email: "", rol: "profesional" })

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const fetchData = async () => {
    setCargando(true)
    const [{ data: m }, { data: i }] = await Promise.all([
      supabase.from("miembros_geriatrico").select("*").eq("geriatrico_id", geriatrico?.id).order("created_at"),
      supabase.from("invitaciones").select("*").eq("geriatrico_id", geriatrico?.id).eq("aceptada", false).order("created_at", { ascending: false }),
    ])
    setMiembros(m || [])
    setInvitaciones(i || [])
    setCargando(false)
  }

  useEffect(() => { if (geriatrico?.id) fetchData() }, [geriatrico?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const invitar = async () => {
    if (!form.email) {
      toaster.create({ title: "Ingresá un email", type: "warning", duration: 3000 })
      return
    }
    setGuardando(true)
    const { error } = await supabase.from("invitaciones").insert({
      geriatrico_id: geriatrico.id,
      email: form.email.toLowerCase().trim(),
      rol: form.rol,
    })
    setGuardando(false)
    if (error) {
      toaster.create({ title: "Error al invitar", description: error.message, type: "error", duration: 4000 })
    } else {
      toaster.create({ title: "Invitación creada", description: `Se invitó a ${form.email}`, type: "success", duration: 3000 })
      setForm({ email: "", rol: "profesional" })
      fetchData()
    }
  }

  const eliminarMiembro = async (id) => {
    const { error } = await supabase.from("miembros_geriatrico").delete().eq("id", id)
    if (!error) {
      toaster.create({ title: "Miembro eliminado", type: "success", duration: 2000 })
      fetchData()
    }
  }

  const cancelarInvitacion = async (id) => {
    const { error } = await supabase.from("invitaciones").delete().eq("id", id)
    if (!error) {
      toaster.create({ title: "Invitación cancelada", type: "success", duration: 2000 })
      fetchData()
    }
  }

  return (
    <Box px={6} py={6} maxW="900px" mx="auto">
      <Toaster />
      <Heading size="lg" color="text.main" mb={6}>Equipo</Heading>

      {/* Invite form */}
      <Card.Root borderRadius="xl" boxShadow="md" mb={6} borderLeft="4px solid" borderColor="teal.400">
        <Card.Header pb={2}>
          <Heading size="sm" color="text.main">Invitar nuevo miembro</Heading>
        </Card.Header>
        <Card.Body>
          <Grid templateColumns={{ base: "1fr", md: "1fr 200px auto" }} gap={3} alignItems="end">
            <FieldRoot>
              <FieldLabel fontSize="sm">Email</FieldLabel>
              <Input
                type="email"
                placeholder="enfermero@ejemplo.com"
                value={form.email}
                onChange={e => set("email", e.target.value)}
              />
            </FieldRoot>
            <FieldRoot>
              <FieldLabel fontSize="sm">Rol</FieldLabel>
              <NativeSelect.Root>
                <NativeSelect.Field value={form.rol} onChange={e => set("rol", e.target.value)}>
                  <option value="gerente">Gerente</option>
                  <option value="profesional">Profesional</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </FieldRoot>
            <Button colorPalette="teal" onClick={invitar} loading={guardando}>
              Invitar
            </Button>
          </Grid>
          <Text fontSize="xs" color="text.faint" mt={2}>
            La persona recibirá el acceso la próxima vez que ingrese con Google usando ese email.
          </Text>
        </Card.Body>
      </Card.Root>

      {cargando ? (
        <Box display="flex" justifyContent="center" py={10}><Spinner size="lg" color="teal.500" /></Box>
      ) : (
        <Stack gap={6}>
          {/* Members table */}
          <Card.Root borderRadius="xl" boxShadow="md">
            <Card.Header>
              <Heading size="sm" color="text.main">Miembros activos ({miembros.length})</Heading>
            </Card.Header>
            <Card.Body p={0}>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row bg="bg.muted">
                    <Table.ColumnHeader pl={4} fontWeight="600">Nombre</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="600">Email</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="600">Rol</Table.ColumnHeader>
                    <Table.ColumnHeader pr={4}></Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {miembros.map(m => {
                    const rolInfo = ROLES_GERIATRICO[m.rol] || ROLES_GERIATRICO.profesional
                    const esYo = m.user_id === user?.id
                    return (
                      <Table.Row key={m.id} _hover={{ bg: "bg.hover" }}>
                        <Table.Cell pl={4} fontWeight="500" fontSize="sm">
                          {m.nombre || "—"} {esYo && <Badge colorPalette="gray" variant="subtle" fontSize="xs" ml={1}>Tú</Badge>}
                        </Table.Cell>
                        <Table.Cell fontSize="sm" color="text.muted">{m.email || "—"}</Table.Cell>
                        <Table.Cell>
                          <Badge colorPalette={rolInfo.color} variant="subtle" borderRadius="full" px={2} fontSize="xs">
                            {rolInfo.label}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell pr={4}>
                          {!esYo && m.rol !== "admin" && (
                            <Button size="xs" variant="ghost" colorPalette="red" onClick={() => eliminarMiembro(m.id)}>
                              ✕
                            </Button>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Card.Body>
          </Card.Root>

          {/* Pending invitations */}
          {invitaciones.length > 0 && (
            <Card.Root borderRadius="xl" boxShadow="md">
              <Card.Header>
                <Heading size="sm" color="text.main">Invitaciones pendientes ({invitaciones.length})</Heading>
              </Card.Header>
              <Card.Body p={0}>
                <Table.Root size="sm">
                  <Table.Header>
                    <Table.Row bg="bg.muted">
                      <Table.ColumnHeader pl={4} fontWeight="600">Email</Table.ColumnHeader>
                      <Table.ColumnHeader fontWeight="600">Rol</Table.ColumnHeader>
                      <Table.ColumnHeader pr={4}></Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {invitaciones.map(inv => {
                      const rolInfo = ROLES_GERIATRICO[inv.rol] || ROLES_GERIATRICO.profesional
                      return (
                        <Table.Row key={inv.id} _hover={{ bg: "bg.hover" }}>
                          <Table.Cell pl={4} fontSize="sm">{inv.email}</Table.Cell>
                          <Table.Cell>
                            <Badge colorPalette={rolInfo.color} variant="subtle" borderRadius="full" px={2} fontSize="xs">
                              {rolInfo.label}
                            </Badge>
                          </Table.Cell>
                          <Table.Cell pr={4}>
                            <Button size="xs" variant="ghost" colorPalette="red" onClick={() => cancelarInvitacion(inv.id)}>
                              Cancelar
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      )
                    })}
                  </Table.Body>
                </Table.Root>
              </Card.Body>
            </Card.Root>
          )}
        </Stack>
      )}
    </Box>
  )
}
