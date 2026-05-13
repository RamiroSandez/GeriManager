import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"
import {
  Badge, Box, Button, Card, DialogBackdrop, DialogBody, DialogCloseTrigger,
  DialogContent, DialogFooter, DialogHeader, DialogPositioner, DialogRoot,
  DialogTitle, Heading, HStack, Input, Spinner, Table, Text,
} from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import CrearPacienteModal from "../components/CrearPacienteModal"

export default function Pacientes() {
  const { geriatrico } = useAuth()
  const navigate = useNavigate()
  const [pacientes, setPacientes] = useState([])
  const [busqueda, setBusqueda] = useState("")
  const [cargando, setCargando] = useState(true)
  const [mostrarCrear, setMostrarCrear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // {id, nombre}
  const [eliminando, setEliminando] = useState(false)

  const eliminarPaciente = async () => {
    if (!confirmDelete) return
    setEliminando(true)
    const { id, nombre } = confirmDelete
    await Promise.all([
      supabase.from("registro_signos_vitales").delete().eq("paciente_id", id),
      supabase.from("registro_medicacion_diaria").delete().eq("paciente_id", id),
      supabase.from("paciente_medicamentos").delete().eq("paciente_id", id),
      supabase.from("amparos").delete().eq("paciente_id", id),
      supabase.from("eventos").delete().eq("paciente_id", id),
      supabase.from("documentos").delete().eq("paciente_id", id),
    ])
    const { error } = await supabase.from("Pacientes").delete().eq("id", id)
    setEliminando(false)
    setConfirmDelete(null)
    if (error) {
      toaster.create({ title: "Error al eliminar", description: error.message, type: "error", duration: 4000 })
    } else {
      toaster.create({ title: `${nombre} eliminado`, type: "success", duration: 3000 })
      fetchPacientes()
    }
  }

  const fetchPacientes = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from("Pacientes")
      .select("*")
      .eq("geriatrico_id", geriatrico?.id)
      .order("created_at", { ascending: false })
    if (!error) setPacientes(data || [])
    setCargando(false)
  }

  useEffect(() => {
    if (!geriatrico?.id) return
    fetchPacientes()
  }, [geriatrico?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const activos = pacientes.filter(p => !p.estado || p.estado === "activo")
  const bajas = pacientes.filter(p => p.estado === "baja")

  const pacientesFiltrados = pacientes.filter(p =>
    p.Nombre_Completo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.dni?.includes(busqueda) ||
    p.Obra_social?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <Box px={6} py={6}>
      <Toaster />

      {/* Header */}
      <Box mb={6}>
        <Heading size="xl" color="text.main" fontWeight="800">Pacientes</Heading>
        <Text color="text.muted" mt={1} fontSize="sm">
          {activos.length} activos · {bajas.length} bajas · {pacientes.length} en total
        </Text>
      </Box>

      {/* Buscador + botón nuevo */}
      <HStack mb={4} gap={3} flexWrap="wrap">
        <Input
          placeholder="Buscar por nombre, DNI u obra social..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          maxW="420px"
          bg="bg.panel"
          borderRadius="lg"
        />
        <Button colorPalette="teal" onClick={() => setMostrarCrear(true)}>
          + Nuevo Paciente
        </Button>
      </HStack>

      {/* Tabla */}
      <Card.Root boxShadow="md" borderRadius="xl">
        <Card.Header>
          <HStack justify="space-between">
            <Heading size="md" color="teal.600">
              {busqueda ? `Resultados (${pacientesFiltrados.length})` : `Todos los pacientes (${pacientes.length})`}
            </Heading>
          </HStack>
        </Card.Header>
        <Card.Body p={0}>
          {cargando ? (
            <Box display="flex" justifyContent="center" py={10}>
              <Spinner size="lg" color="teal.500" />
            </Box>
          ) : pacientesFiltrados.length === 0 ? (
            <Text color="text.muted" textAlign="center" py={10}>
              {busqueda ? "No se encontraron pacientes." : "No hay pacientes registrados."}
            </Text>
          ) : (
            <Table.Root size="md">
              <Table.Header>
                <Table.Row bg="bg.muted">
                  <Table.ColumnHeader fontWeight="600">Nombre Completo</Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="600">DNI</Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="600">Edad</Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="600">Obra Social</Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="600">Estado</Table.ColumnHeader>
                  <Table.ColumnHeader></Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {pacientesFiltrados.map(p => {
                  const edad = p.fecha_nacimiento
                    ? Math.floor((new Date() - new Date(p.fecha_nacimiento)) / (365.25 * 24 * 60 * 60 * 1000))
                    : null
                  const cumpleHoy = p.fecha_nacimiento?.slice(5) === new Date().toISOString().split("T")[0].slice(5)
                  return (
                    <Table.Row
                      key={p.id}
                      cursor="pointer"
                      _hover={{ bg: "bg.hover" }}
                      onClick={() => navigate(`/paciente/${p.id}`)}
                    >
                      <Table.Cell fontWeight="500">
                        {p.Nombre_Completo}
                        {cumpleHoy && <Text as="span" ml={1}>🎂</Text>}
                      </Table.Cell>
                      <Table.Cell>{p.dni}</Table.Cell>
                      <Table.Cell>{edad !== null ? `${edad} años` : "—"}</Table.Cell>
                      <Table.Cell>{p.Obra_social || "—"}</Table.Cell>
                      <Table.Cell>
                        <Badge
                          colorPalette={p.estado === "baja" ? "red" : "green"}
                          variant="subtle" borderRadius="full" px={2} fontSize="xs"
                        >
                          {p.estado === "baja" ? "Baja" : "Activo"}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <HStack gap={0}>
                          <Button
                            size="xs" variant="ghost" colorPalette="teal"
                            onClick={e => { e.stopPropagation(); navigate(`/paciente/${p.id}`) }}
                          >
                            Ver ficha →
                          </Button>
                          <Button
                            size="xs" variant="ghost" colorPalette="red"
                            onClick={e => { e.stopPropagation(); setConfirmDelete({ id: p.id, nombre: p.Nombre_Completo }) }}
                          >
                            ✕
                          </Button>
                        </HStack>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table.Root>
          )}
        </Card.Body>
      </Card.Root>

      <CrearPacienteModal
        open={mostrarCrear}
        onClose={() => setMostrarCrear(false)}
        onCreated={fetchPacientes}
        geriatrico_id={geriatrico?.id}
      />

      <DialogRoot open={!!confirmDelete} onOpenChange={e => { if (!e.open) setConfirmDelete(null) }}>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent borderRadius="xl" maxW="400px">
            <DialogHeader>
              <DialogTitle>Eliminar paciente</DialogTitle>
            </DialogHeader>
            <DialogCloseTrigger />
            <DialogBody>
              <Text fontSize="sm" color="text.muted">
                ¿Estás seguro que querés eliminar a <Text as="span" fontWeight="700" color="text.main">{confirmDelete?.nombre}</Text>?
              </Text>
              <Text fontSize="xs" color="red.500" mt={2}>
                Esta acción eliminará todos sus registros (signos vitales, medicación, documentos, amparos). No se puede deshacer.
              </Text>
            </DialogBody>
            <DialogFooter gap={2}>
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
              <Button colorPalette="red" onClick={eliminarPaciente} loading={eliminando}>
                Sí, eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>
    </Box>
  )
}
