import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../services/supabase"
import {
  Badge,
  Box,
  Button,
  Card,
  FieldLabel,
  FieldRoot,
  Grid,
  GridItem,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Spinner,
  Stack,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import DocumentosPanel from "../components/DocumentosPanel"
import { ESTADOS_AMPARO } from "../utils/constants"
import { useAuth } from "../contexts/AuthContext"

export default function FichaPaciente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { geriatrico } = useAuth()

  const [paciente, setPaciente] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({})
  const [eventos, setEventos] = useState([])
  const [amparos, setAmparos] = useState([])
  const [creandoAmparo, setCreandoAmparo] = useState(false)
  const [nuevoAmparo, setNuevoAmparo] = useState("")
  const [generando, setGenerando] = useState(null)

  const fetchPaciente = async () => {
    const { data, error } = await supabase
      .from("Pacientes")
      .select("*")
      .eq("id", id)
      .single()
    if (!error && data) {
      setPaciente(data)
      setForm(data)
    }
    setCargando(false)
  }

  const fetchEventos = async () => {
    const { data } = await supabase
      .from("eventos")
      .select("*")
      .eq("paciente_id", id)
      .order("created_at", { ascending: false })
    setEventos(data || [])
  }

  const fetchAmparos = async () => {
    const { data } = await supabase
      .from("amparos")
      .select("*")
      .eq("paciente_id", Number(id))
      .order("created_at", { ascending: false })
    setAmparos(data || [])
  }

  useEffect(() => {
    fetchPaciente()
    fetchEventos()
    fetchAmparos()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const guardarDatos = async () => {
    setGuardando(true)
    const { error } = await supabase
      .from("Pacientes")
      .update({
        Nombre_Completo: form.Nombre_Completo,
        dni: form.dni,
        Obra_social: form.Obra_social,
        numero_afiliado: form.numero_afiliado,
        fecha_nacimiento: form.fecha_nacimiento || null,
        diagnostico: form.diagnostico,
        telefono_contacto: form.telefono_contacto,
        nombre_contacto: form.nombre_contacto,
        motivo_ingreso: form.motivo_ingreso,
        antecedentes: form.antecedentes,
        medicacion: form.medicacion,
        })
      .eq("id", id)
    setGuardando(false)
    if (error) {
      toaster.create({ title: "Error al guardar", description: error.message, type: "error", duration: 4000 })
    } else {
      toaster.create({ title: "Datos actualizados", type: "success", duration: 3000 })
      fetchPaciente()
    }
  }

  const crearAmparo = async () => {
    setCreandoAmparo(true)
    const { error } = await supabase.from("amparos").insert({
      geriatrico_id: geriatrico.id,
      paciente_id: Number(id),
      estado: "preparando_documentacion",
      observaciones: nuevoAmparo || null,
    })
    setCreandoAmparo(false)
    if (error) {
      toaster.create({ title: "Error al crear amparo", description: error.message, type: "error", duration: 5000 })
    } else {
      toaster.create({ title: "Amparo creado", type: "success", duration: 2000 })
      setNuevoAmparo("")
      fetchAmparos()
    }
  }

  const cambiarEstadoAmparo = async (amparoId, nuevoEstado) => {
    await supabase.from("amparos").update({ estado: nuevoEstado, updated_at: new Date().toISOString() }).eq("id", amparoId)
    setAmparos(prev => prev.map(a => a.id === amparoId ? { ...a, estado: nuevoEstado } : a))
  }

  const generarAmparo = async (amparo) => {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL
    if (!webhookUrl) {
      toaster.create({ title: "Webhook no configurado", type: "warning", duration: 4000 })
      return
    }
    setGenerando(amparo.id)
    const { data: documentos } = await supabase.from("documentos").select("*").eq("paciente_id", id)
    const docsConUrl = (documentos || []).map(doc => ({
      ...doc,
      url: supabase.storage.from("documentos").getPublicUrl(doc.storage_path).data.publicUrl,
    }))
    const payload = {
      paciente: {
        id: paciente.id,
        nombre: paciente.Nombre_Completo,
        dni: paciente.dni,
        obra_social: paciente.Obra_social,
        numero_afiliado: paciente.numero_afiliado,
        fecha_nacimiento: paciente.fecha_nacimiento,
        edad: paciente.fecha_nacimiento
          ? Math.floor((new Date() - new Date(paciente.fecha_nacimiento)) / (365.25 * 24 * 60 * 60 * 1000))
          : null,
        diagnostico: paciente.diagnostico,
        nombre_geriatrico: geriatrico?.nombre,
        motivo_ingreso: paciente.motivo_ingreso,
        antecedentes: paciente.antecedentes?.replace(/\r\n/g, "\n").replace(/\r/g, "\n") || "",
        medicacion: paciente.medicacion?.split("\n").filter(m => m.trim() !== "") || [],
      },
      documentos: docsConUrl,
      timestamp: new Date().toISOString(),
    }
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(`Error HTTP ${response.status}`)
      let docUrl = null
      try { const result = await response.json(); docUrl = result?.doc_url || result?.url || null } catch {}
      await supabase.from("amparos").update({ estado: "amparo_generado", doc_url: docUrl, updated_at: new Date().toISOString() }).eq("id", amparo.id)
      toaster.create({ title: "Amparo generado", type: "success", duration: 4000 })
      fetchAmparos()
    } catch (err) {
      toaster.create({ title: "Error al generar", description: err.message, type: "error", duration: 5000 })
    }
    setGenerando(null)
  }

  const eliminarAmparo = async (amparoId) => {
    await supabase.from("amparos").delete().eq("id", amparoId)
    setAmparos(prev => prev.filter(a => a.id !== amparoId))
  }

  if (cargando) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={20}>
        <Spinner size="xl" color="blue.500" />
      </Box>
    )
  }

  if (!paciente) {
    return (
      <Box textAlign="center" py={20}>
        <Text color="gray.500">Paciente no encontrado.</Text>
        <Button mt={4} onClick={() => navigate("/")}>Volver al inicio</Button>
      </Box>
    )
  }

  const ultimoAmparo = amparos[0]
  const estadoUltimoAmparo = ultimoAmparo ? (ESTADOS_AMPARO[ultimoAmparo.estado] || ESTADOS_AMPARO.preparando_documentacion) : null

  return (
    <Box px={6} py={6}>
      <Toaster />

      {/* Header de la ficha */}
      <HStack mb={5} gap={4} flexWrap="wrap" align="flex-start">
        <Button variant="ghost" size="sm" colorPalette="blue" onClick={() => navigate("/")}>
          ← Volver
        </Button>
        <Box flex={1}>
          <HStack gap={3} flexWrap="wrap">
            <Heading size="lg" color="gray.800">{paciente.Nombre_Completo}</Heading>
            {estadoUltimoAmparo && (
              <Badge colorPalette={estadoUltimoAmparo.color} variant="subtle" borderRadius="full" px={3} py={1} fontSize="sm">
                {estadoUltimoAmparo.label}
              </Badge>
            )}
          </HStack>
          <Text color="gray.500" fontSize="sm" mt={1}>
            DNI: {paciente.dni}
            {paciente.Obra_social && ` | Obra Social: ${paciente.Obra_social}`}
          </Text>
        </Box>
      </HStack>

      {/* Tabs */}
      <Tabs.Root defaultValue="datos">
        <Tabs.List mb={4}>
          <Tabs.Trigger value="datos">Datos del paciente</Tabs.Trigger>
          <Tabs.Trigger value="documentos">Documentos</Tabs.Trigger>
          <Tabs.Trigger value="amparo">Amparos ({amparos.length})</Tabs.Trigger>
          <Tabs.Trigger value="historial">Historial</Tabs.Trigger>
        </Tabs.List>

        {/* Tab: Datos */}
        <Tabs.Content value="datos">
          <Card.Root borderRadius="xl" boxShadow="md">
            <Card.Body>
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                <FieldRoot>
                  <FieldLabel fontSize="sm">Nombre completo</FieldLabel>
                  <Input value={form.Nombre_Completo || ""} onChange={e => set("Nombre_Completo", e.target.value)} />
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel fontSize="sm">DNI</FieldLabel>
                  <Input value={form.dni || ""} onChange={e => set("dni", e.target.value)} />
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel fontSize="sm">Obra Social</FieldLabel>
                  <Input value={form.Obra_social || ""} onChange={e => set("Obra_social", e.target.value)} />
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel fontSize="sm">N° de Afiliado</FieldLabel>
                  <Input value={form.numero_afiliado || ""} onChange={e => set("numero_afiliado", e.target.value)} />
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel fontSize="sm">Fecha de nacimiento</FieldLabel>
                  <Input type="date" value={form.fecha_nacimiento || ""} onChange={e => set("fecha_nacimiento", e.target.value)} />
                </FieldRoot>
                <GridItem colSpan={{ base: 1, md: 2 }}>
                  <FieldRoot>
                    <FieldLabel fontSize="sm">Diagnóstico</FieldLabel>
                    <Textarea value={form.diagnostico || ""} onChange={e => set("diagnostico", e.target.value)} rows={3} placeholder="Diagnóstico principal del paciente" />
                  </FieldRoot>
                </GridItem>
                <FieldRoot>
                  <FieldLabel fontSize="sm">Contacto / Familiar</FieldLabel>
                  <Input value={form.nombre_contacto || ""} onChange={e => set("nombre_contacto", e.target.value)} placeholder="Nombre del familiar o responsable" />
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel fontSize="sm">Teléfono de contacto</FieldLabel>
                  <Input value={form.telefono_contacto || ""} onChange={e => set("telefono_contacto", e.target.value)} placeholder="+54 11 1234-5678" />
                </FieldRoot>
                <GridItem colSpan={{ base: 1, md: 2 }}>
                  <FieldRoot>
                    <FieldLabel fontSize="sm">Motivo de ingreso</FieldLabel>
                    <Textarea value={form.motivo_ingreso || ""} onChange={e => set("motivo_ingreso", e.target.value)} rows={2} placeholder="Motivo de ingreso al geriátrico..." />
                  </FieldRoot>
                </GridItem>
                <GridItem colSpan={{ base: 1, md: 2 }}>
                  <FieldRoot>
                    <FieldLabel fontSize="sm">Antecedentes</FieldLabel>
                    <Textarea value={form.antecedentes || ""} onChange={e => set("antecedentes", e.target.value)} rows={3} placeholder="Antecedentes médicos relevantes..." />
                  </FieldRoot>
                </GridItem>
                <GridItem colSpan={{ base: 1, md: 2 }}>
                  <FieldRoot>
                    <FieldLabel fontSize="sm">Medicación (una por línea)</FieldLabel>
                    <Textarea value={form.medicacion || ""} onChange={e => set("medicacion", e.target.value)} rows={4} placeholder={"Ej:\nMetformina 500mg - 1 comp c/12hs\nAmlodipina 5mg - 1 comp c/día"} />
                  </FieldRoot>
                </GridItem>
              </Grid>
              <Button mt={5} colorPalette="blue" onClick={guardarDatos} loading={guardando}>
                Guardar cambios
              </Button>
            </Card.Body>
          </Card.Root>
        </Tabs.Content>

        {/* Tab: Documentos */}
        <Tabs.Content value="documentos">
          <Card.Root borderRadius="xl" boxShadow="md">
            <Card.Body>
              <DocumentosPanel pacienteId={Number(id)} />
            </Card.Body>
          </Card.Root>
        </Tabs.Content>

        {/* Tab: Amparos */}
        <Tabs.Content value="amparo">
          <Stack gap={4}>
            {/* Crear nuevo amparo */}
            <Card.Root borderRadius="xl" boxShadow="md">
              <Card.Body>
                <HStack gap={3} flexWrap="wrap">
                  <Input
                    flex={1} minW="200px" placeholder="Observaciones (opcional)..."
                    value={nuevoAmparo}
                    onChange={e => setNuevoAmparo(e.target.value)}
                    bg="bg.muted"
                  />
                  <Button colorPalette="blue" onClick={crearAmparo} loading={creandoAmparo}>
                    + Nuevo Amparo
                  </Button>
                </HStack>
              </Card.Body>
            </Card.Root>

            {/* Lista de amparos */}
            {amparos.length === 0 ? (
              <Text color="text.muted" textAlign="center" py={8}>
                Este paciente no tiene amparos registrados.
              </Text>
            ) : (
              amparos.map(a => {
                const estado = ESTADOS_AMPARO[a.estado] || ESTADOS_AMPARO.preparando_documentacion
                return (
                  <Card.Root key={a.id} borderRadius="xl" boxShadow="sm">
                    <Card.Body>
                      <HStack justify="space-between" flexWrap="wrap" gap={4}>
                        <Box flex={1}>
                          <HStack gap={2} mb={1}>
                            <Badge colorPalette={estado.color} variant="subtle" borderRadius="full" px={3}>
                              {estado.label}
                            </Badge>
                            <Text fontSize="xs" color="text.faint">
                              {new Date(a.created_at).toLocaleDateString("es-AR")}
                            </Text>
                          </HStack>
                          {a.observaciones && (
                            <Text fontSize="sm" color="text.muted">{a.observaciones}</Text>
                          )}
                          {a.doc_url && (
                            <Button size="xs" variant="ghost" colorPalette="blue" as="a" href={a.doc_url} target="_blank" mt={1}>
                              Ver documento
                            </Button>
                          )}
                        </Box>
                        <HStack gap={2} flexWrap="wrap">
                          <NativeSelect.Root maxW="200px">
                            <NativeSelect.Field
                              value={a.estado}
                              onChange={e => cambiarEstadoAmparo(a.id, e.target.value)}
                              fontSize="sm"
                            >
                              {Object.entries(ESTADOS_AMPARO).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                          <Button
                            size="sm" colorPalette="blue" variant="outline"
                            onClick={() => generarAmparo(a)}
                            loading={generando === a.id}
                          >
                            Generar
                          </Button>
                          <Button size="sm" colorPalette="red" variant="ghost" onClick={() => eliminarAmparo(a.id)}>
                            ✕
                          </Button>
                        </HStack>
                      </HStack>
                    </Card.Body>
                  </Card.Root>
                )
              })
            )}
          </Stack>
        </Tabs.Content>

        {/* Tab: Historial */}
        <Tabs.Content value="historial">
          <Card.Root borderRadius="xl" boxShadow="md">
            <Card.Body>
              {eventos.length === 0 ? (
                <Text color="gray.400" textAlign="center" py={8}>
                  No hay eventos registrados aún.
                </Text>
              ) : (
                <Stack gap={0}>
                  {eventos.map((ev, i) => (
                    <HStack
                      key={ev.id}
                      gap={4}
                      py={3}
                      borderBottom={i < eventos.length - 1 ? "1px solid" : "none"}
                      borderColor="gray.100"
                      align="flex-start"
                    >
                      <Box
                        w="8px"
                        h="8px"
                        borderRadius="full"
                        bg="blue.400"
                        mt="6px"
                        flexShrink={0}
                      />
                      <Box flex={1}>
                        <Text fontSize="sm" fontWeight="500">{ev.descripcion}</Text>
                        <Text fontSize="xs" color="gray.400" mt={0.5}>
                          {new Date(ev.created_at).toLocaleString("es-AR", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </Text>
                      </Box>
                    </HStack>
                  ))}
                </Stack>
              )}
            </Card.Body>
          </Card.Root>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}
