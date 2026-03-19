import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"
import {
  Box,
  Button,
  Card,
  Grid,
  Heading,
  HStack,
  Input,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react"
import { Toaster } from "../components/toaster"
import CrearPacienteModal from "../components/CrearPacienteModal"

export default function Dashboard() {
  const { geriatrico } = useAuth()
  const [pacientes, setPacientes] = useState([])
  const [busqueda, setBusqueda] = useState("")
  const [cargando, setCargando] = useState(true)
  const [mostrarCrear, setMostrarCrear] = useState(false)
  const navigate = useNavigate()

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

  useEffect(() => { if (geriatrico?.id) fetchPacientes() }, [geriatrico?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const pacientesFiltrados = pacientes.filter(p =>
    p.Nombre_Completo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.dni?.includes(busqueda) ||
    p.Obra_social?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <Box px={6} py={6}>
      <Toaster />

      {/* Stats */}
      <Grid templateColumns="repeat(auto-fill, minmax(170px, 1fr))" gap={4} mb={6}>
        <Card.Root borderRadius="lg" boxShadow="sm" bg="bg.panel">
          <Card.Body py={4} px={5}>
            <Text fontSize="3xl" fontWeight="bold" color="blue.600">{pacientes.length}</Text>
            <Text fontSize="sm" color="text.muted">Total pacientes</Text>
          </Card.Body>
        </Card.Root>
        <Card.Root borderRadius="lg" boxShadow="sm" bg="bg.panel">
          <Card.Body py={4} px={5}>
            <Text fontSize="3xl" fontWeight="bold" color="green.600">
              {pacientes.filter(p => p.Obra_social).length}
            </Text>
            <Text fontSize="sm" color="text.muted">Con obra social</Text>
          </Card.Body>
        </Card.Root>
        <Card.Root borderRadius="lg" boxShadow="sm" bg="bg.panel">
          <Card.Body py={4} px={5}>
            <Text fontSize="3xl" fontWeight="bold" color="orange.600">
              {pacientes.filter(p => !p.Obra_social).length}
            </Text>
            <Text fontSize="sm" color="text.muted">Sin obra social</Text>
          </Card.Body>
        </Card.Root>
      </Grid>

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
        <Button colorPalette="blue" onClick={() => setMostrarCrear(true)}>
          + Nuevo Paciente
        </Button>
      </HStack>

      {/* Tabla de pacientes */}
      <Card.Root boxShadow="md" borderRadius="xl">
        <Card.Header>
          <HStack justify="space-between">
            <Heading size="md" color="blue.600">
              Pacientes ({pacientesFiltrados.length})
            </Heading>
          </HStack>
        </Card.Header>
        <Card.Body p={0}>
          {cargando ? (
            <Box display="flex" justifyContent="center" py={10}>
              <Spinner size="lg" color="blue.500" />
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
                  <Table.ColumnHeader></Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {pacientesFiltrados.map(p => {
                  const edad = p.fecha_nacimiento
                    ? Math.floor((new Date() - new Date(p.fecha_nacimiento)) / (365.25 * 24 * 60 * 60 * 1000))
                    : null
                  return (
                    <Table.Row
                      key={p.id}
                      cursor="pointer"
                      _hover={{ bg: "bg.hover" }}
                      onClick={() => navigate(`/paciente/${p.id}`)}
                    >
                      <Table.Cell fontWeight="500">{p.Nombre_Completo}</Table.Cell>
                      <Table.Cell>{p.dni}</Table.Cell>
                      <Table.Cell>{edad !== null ? `${edad} años` : "—"}</Table.Cell>
                      <Table.Cell>{p.Obra_social || "—"}</Table.Cell>
                      <Table.Cell>
                        <Button
                          size="xs" variant="ghost" colorPalette="blue"
                          onClick={e => { e.stopPropagation(); navigate(`/paciente/${p.id}`) }}
                        >
                          Ver ficha →
                        </Button>
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
    </Box>
  )
}
