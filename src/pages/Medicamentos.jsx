import { useState, useEffect } from "react"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"
import {
  Box, Button, Card, FieldLabel, FieldRoot,
  Grid, Heading, HStack, Input, Spinner, Stack, Text,
} from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"

const FORM_INICIAL = { nombre: "", presentacion: "", dosis_estandar: "" }

export default function Medicamentos() {
  const { geriatrico } = useAuth()
  const [medicamentos, setMedicamentos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)

  const fetchMedicamentos = async () => {
    const { data } = await supabase
      .from("medicamentos")
      .select("*")
      .eq("geriatrico_id", geriatrico.id)
      .order("nombre")
    setMedicamentos(data || [])
    setCargando(false)
  }

  useEffect(() => {
    if (geriatrico?.id) fetchMedicamentos()
  }, [geriatrico?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const guardar = async () => {
    if (!form.nombre.trim()) {
      toaster.create({ title: "El nombre es obligatorio", type: "error", duration: 3000 })
      return
    }
    setGuardando(true)
    const { error } = await supabase.from("medicamentos").insert([{
      ...form,
      geriatrico_id: geriatrico.id,
    }])
    setGuardando(false)
    if (error) {
      toaster.create({ title: "Error al guardar", description: error.message, type: "error", duration: 4000 })
    } else {
      toaster.create({ title: "Medicamento agregado", type: "success", duration: 3000 })
      setForm(FORM_INICIAL)
      setMostrarForm(false)
      fetchMedicamentos()
    }
  }

  const eliminar = async (id) => {
    const { error } = await supabase.from("medicamentos").delete().eq("id", id)
    if (error) {
      toaster.create({ title: "Error al eliminar", description: error.message, type: "error", duration: 4000 })
    } else {
      toaster.create({ title: "Medicamento eliminado", type: "success", duration: 2000 })
      fetchMedicamentos()
    }
  }

  if (cargando) return (
    <Box display="flex" justifyContent="center" alignItems="center" py={20}>
      <Spinner size="xl" color="teal.500" />
    </Box>
  )

  return (
    <Box px={6} py={6}>
      <Toaster />

      <HStack mb={6} justify="space-between" align="flex-start">
        <Box>
          <Heading size="lg" color="text.main">Medicamentos</Heading>
          <Text fontSize="sm" color="text.muted">Catálogo de medicamentos del geriátrico</Text>
        </Box>
        <Button
          colorPalette="teal"
          size="sm"
          onClick={() => { setMostrarForm(!mostrarForm); setForm(FORM_INICIAL) }}
        >
          {mostrarForm ? "Cancelar" : "+ Agregar medicamento"}
        </Button>
      </HStack>

      {mostrarForm && (
        <Card.Root borderRadius="xl" boxShadow="md" mb={5}>
          <Card.Header>
            <Heading size="sm">Nuevo medicamento</Heading>
          </Card.Header>
          <Card.Body>
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap={4}>
              <FieldRoot required>
                <FieldLabel fontSize="sm">Nombre *</FieldLabel>
                <Input
                  value={form.nombre}
                  onChange={e => set("nombre", e.target.value)}
                  placeholder="Ej: Metformina"
                />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Presentación</FieldLabel>
                <Input
                  value={form.presentacion}
                  onChange={e => set("presentacion", e.target.value)}
                  placeholder="Ej: Comprimidos"
                />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Dosis estándar</FieldLabel>
                <Input
                  value={form.dosis_estandar}
                  onChange={e => set("dosis_estandar", e.target.value)}
                  placeholder="Ej: 500mg"
                />
              </FieldRoot>
            </Grid>
            <Button mt={4} colorPalette="teal" size="sm" onClick={guardar} loading={guardando}>
              Guardar
            </Button>
          </Card.Body>
        </Card.Root>
      )}

      <Card.Root borderRadius="xl" boxShadow="md">
        <Card.Body p={0}>
          {medicamentos.length === 0 ? (
            <Box textAlign="center" py={14}>
              <Text color="text.faint" fontSize="sm">No hay medicamentos cargados aún.</Text>
              <Text color="text.faint" fontSize="xs" mt={1}>
                Usá el botón "Agregar medicamento" para crear el catálogo.
              </Text>
            </Box>
          ) : (
            <Stack gap={0}>
              {/* Header */}
              <Box
                display="grid"
                gridTemplateColumns="1fr 160px 160px 80px"
                px={5}
                py={3}
                borderBottom="1px solid"
                borderColor="border.subtle"
                bg="bg.muted"
                borderTopRadius="xl"
              >
                <Text fontSize="xs" fontWeight="600" color="text.faint" textTransform="uppercase" letterSpacing="wider">Nombre</Text>
                <Text fontSize="xs" fontWeight="600" color="text.faint" textTransform="uppercase" letterSpacing="wider">Presentación</Text>
                <Text fontSize="xs" fontWeight="600" color="text.faint" textTransform="uppercase" letterSpacing="wider">Dosis estándar</Text>
                <Box />
              </Box>

              {medicamentos.map((med, i) => (
                <Box
                  key={med.id}
                  display="grid"
                  gridTemplateColumns="1fr 160px 160px 80px"
                  px={5}
                  py={3}
                  borderBottom={i < medicamentos.length - 1 ? "1px solid" : "none"}
                  borderColor="border.subtle"
                  alignItems="center"
                  _hover={{ bg: "bg.hover" }}
                  transition="background 0.1s"
                >
                  <Text fontSize="sm" fontWeight="500" color="text.main">{med.nombre}</Text>
                  <Text fontSize="sm" color="text.muted">{med.presentacion || "—"}</Text>
                  <Text fontSize="sm" color="text.muted">{med.dosis_estandar || "—"}</Text>
                  <Box textAlign="right">
                    <Button
                      size="xs"
                      colorPalette="red"
                      variant="ghost"
                      onClick={() => eliminar(med.id)}
                    >
                      Eliminar
                    </Button>
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </Card.Body>
      </Card.Root>
    </Box>
  )
}
