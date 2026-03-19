import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"
import {
  Badge, Box, Button, Card, FieldLabel, FieldRoot,
  Heading, HStack, Input, NativeSelect, Spinner, Stack, Table, Text,
} from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import { ESTADOS_AMPARO } from "../utils/constants"

export default function Amparos() {
  const { geriatrico } = useAuth()
  const navigate = useNavigate()
  const [amparos, setAmparos] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [form, setForm] = useState({ paciente_id: "", observaciones: "" })
  const [guardando, setGuardando] = useState(false)
  const [generando, setGenerando] = useState(null)

  const fetchAmparos = async () => {
    const { data } = await supabase
      .from("amparos")
      .select("*, Pacientes(id, Nombre_Completo, dni, Obra_social, fecha_nacimiento, diagnostico, motivo_ingreso, antecedentes, medicacion, numero_afiliado)")
      .eq("geriatrico_id", geriatrico?.id)
      .order("created_at", { ascending: false })
    setAmparos(data || [])
    setCargando(false)
  }

  const fetchPacientes = async () => {
    const { data } = await supabase
      .from("Pacientes")
      .select("id, Nombre_Completo")
      .eq("geriatrico_id", geriatrico?.id)
      .order("Nombre_Completo")
    setPacientes(data || [])
  }

  useEffect(() => {
    if (geriatrico?.id) { fetchAmparos(); fetchPacientes() }
  }, [geriatrico?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const crearAmparo = async () => {
    if (!form.paciente_id) {
      toaster.create({ title: "Seleccioná un paciente", type: "warning", duration: 3000 })
      return
    }
    setGuardando(true)
    const { error } = await supabase.from("amparos").insert({
      geriatrico_id: geriatrico.id,
      paciente_id: Number(form.paciente_id),
      estado: "preparando_documentacion",
      observaciones: form.observaciones || null,
    })
    setGuardando(false)
    if (error) {
      toaster.create({ title: "Error al crear", description: error.message, type: "error", duration: 5000 })
    } else {
      toaster.create({ title: "Amparo creado", type: "success", duration: 2000 })
      setForm({ paciente_id: "", observaciones: "" })
      setMostrarNuevo(false)
      fetchAmparos()
    }
  }

  const cambiarEstado = async (amparoId, nuevoEstado) => {
    await supabase.from("amparos")
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq("id", amparoId)
    setAmparos(prev => prev.map(a => a.id === amparoId ? { ...a, estado: nuevoEstado } : a))
  }

  const actualizarDocUrl = async (amparoId, url) => {
    await supabase.from("amparos").update({ doc_url: url }).eq("id", amparoId)
    setAmparos(prev => prev.map(a => a.id === amparoId ? { ...a, doc_url: url } : a))
  }

  const generarAmparo = async (amparo) => {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL
    if (!webhookUrl) {
      toaster.create({ title: "Webhook no configurado", type: "warning", duration: 4000 })
      return
    }
    setGenerando(amparo.id)
    const paciente = amparo.Pacientes
    const { data: documentos } = await supabase.from("documentos").select("*").eq("paciente_id", paciente.id)
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

  const eliminarAmparo = async (id) => {
    await supabase.from("amparos").delete().eq("id", id)
    setAmparos(prev => prev.filter(a => a.id !== id))
  }

  const amparosFiltrados = filtroEstado === "todos"
    ? amparos
    : amparos.filter(a => a.estado === filtroEstado)

  return (
    <Box px={6} py={6}>
      <Toaster />

      <HStack justify="space-between" mb={6} flexWrap="wrap" gap={3}>
        <Box>
          <Heading size="lg" color="text.main">Amparos</Heading>
          <Text fontSize="sm" color="text.muted">
            {amparos.length} amparo{amparos.length !== 1 ? "s" : ""} registrado{amparos.length !== 1 ? "s" : ""}
          </Text>
        </Box>
        <Button colorPalette="blue" onClick={() => setMostrarNuevo(v => !v)}>
          {mostrarNuevo ? "Cancelar" : "+ Nuevo Amparo"}
        </Button>
      </HStack>

      {/* Form nuevo amparo */}
      {mostrarNuevo && (
        <Card.Root borderRadius="xl" boxShadow="md" mb={5} border="1px solid" borderColor="blue.200">
          <Card.Body>
            <Stack gap={4}>
              <Text fontWeight="600" color="text.main">Nuevo Amparo</Text>
              <HStack gap={4} flexWrap="wrap">
                <FieldRoot flex={1} minW="200px">
                  <FieldLabel fontSize="sm">Paciente *</FieldLabel>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={form.paciente_id}
                      onChange={e => setForm(prev => ({ ...prev, paciente_id: e.target.value }))}
                      bg="bg.muted"
                    >
                      <option value="">Seleccionar paciente...</option>
                      {pacientes.map(p => (
                        <option key={p.id} value={p.id}>{p.Nombre_Completo}</option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </FieldRoot>
                <FieldRoot flex={2} minW="250px">
                  <FieldLabel fontSize="sm">Observaciones</FieldLabel>
                  <Input
                    placeholder="Notas sobre este amparo..."
                    value={form.observaciones}
                    onChange={e => setForm(prev => ({ ...prev, observaciones: e.target.value }))}
                    bg="bg.muted"
                  />
                </FieldRoot>
              </HStack>
              <HStack>
                <Button colorPalette="blue" onClick={crearAmparo} loading={guardando}>Crear Amparo</Button>
                <Button variant="ghost" onClick={() => setMostrarNuevo(false)}>Cancelar</Button>
              </HStack>
            </Stack>
          </Card.Body>
        </Card.Root>
      )}

      {/* Filtros por estado */}
      <HStack gap={2} mb={4} flexWrap="wrap">
        <Button
          size="sm" borderRadius="full"
          variant={filtroEstado === "todos" ? "solid" : "outline"}
          colorPalette="gray"
          onClick={() => setFiltroEstado("todos")}
        >
          Todos ({amparos.length})
        </Button>
        {Object.entries(ESTADOS_AMPARO).map(([k, v]) => {
          const count = amparos.filter(a => a.estado === k).length
          if (count === 0) return null
          return (
            <Button
              key={k} size="sm" borderRadius="full"
              variant={filtroEstado === k ? "solid" : "outline"}
              colorPalette={v.color}
              onClick={() => setFiltroEstado(k)}
            >
              {v.label} ({count})
            </Button>
          )
        })}
      </HStack>

      {/* Tabla */}
      <Card.Root borderRadius="xl" boxShadow="md">
        <Card.Body p={0}>
          {cargando ? (
            <Box display="flex" justifyContent="center" py={10}>
              <Spinner size="lg" color="blue.500" />
            </Box>
          ) : amparosFiltrados.length === 0 ? (
            <Text color="text.muted" textAlign="center" py={10}>
              {filtroEstado === "todos" ? "No hay amparos registrados." : "No hay amparos con este estado."}
            </Text>
          ) : (
            <Table.Root size="md">
              <Table.Header>
                <Table.Row bg="bg.muted">
                  <Table.ColumnHeader fontWeight="600">Paciente</Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="600">Estado</Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="600">Fecha</Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="600">Observaciones</Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="600">Documento</Table.ColumnHeader>
                  <Table.ColumnHeader></Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {amparosFiltrados.map(a => {
                  const estado = ESTADOS_AMPARO[a.estado] || ESTADOS_AMPARO.preparando_documentacion
                  return (
                    <Table.Row key={a.id} _hover={{ bg: "bg.hover" }}>
                      <Table.Cell>
                        <Text
                          fontWeight="500" fontSize="sm" cursor="pointer" color="blue.600"
                          onClick={() => navigate(`/paciente/${a.Pacientes?.id}`)}
                          _hover={{ textDecoration: "underline" }}
                        >
                          {a.Pacientes?.Nombre_Completo}
                        </Text>
                        <Text fontSize="xs" color="text.faint">DNI: {a.Pacientes?.dni}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <NativeSelect.Root maxW="200px">
                          <NativeSelect.Field
                            value={a.estado}
                            onChange={e => cambiarEstado(a.id, e.target.value)}
                            fontSize="xs"
                          >
                            {Object.entries(ESTADOS_AMPARO).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </NativeSelect.Field>
                          <NativeSelect.Indicator />
                        </NativeSelect.Root>
                        <Badge colorPalette={estado.color} variant="subtle" borderRadius="full" px={2} fontSize="xs" mt={1}>
                          {estado.label}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="xs" color="text.muted">
                          {new Date(a.created_at).toLocaleDateString("es-AR")}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="xs" color="text.muted" maxW="180px">
                          {a.observaciones || "—"}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        {a.doc_url ? (
                          <Button size="xs" variant="ghost" colorPalette="blue" as="a" href={a.doc_url} target="_blank">
                            Ver Doc
                          </Button>
                        ) : (
                          <Input
                            size="xs" placeholder="Pegar URL..." maxW="160px"
                            onBlur={e => { if (e.target.value) actualizarDocUrl(a.id, e.target.value) }}
                          />
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <HStack gap={1}>
                          <Button
                            size="xs" colorPalette="blue" variant="outline"
                            onClick={() => generarAmparo(a)}
                            loading={generando === a.id}
                          >
                            Generar
                          </Button>
                          <Button
                            size="xs" colorPalette="red" variant="ghost"
                            onClick={() => eliminarAmparo(a.id)}
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
    </Box>
  )
}
