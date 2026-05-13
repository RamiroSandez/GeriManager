import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../services/supabase"
import {
  Badge,
  Box,
  Button,
  Card,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  FieldLabel,
  FieldRoot,
  Grid,
  GridItem,
  Heading,
  HStack,
  Input,
  Spinner,
  Stack,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import DocumentosPanel from "../components/DocumentosPanel"
import MedicacionPaciente from "../components/MedicacionPaciente"
import ControlDiario from "../components/ControlDiario"
import { useAuth } from "../contexts/AuthContext"
import { logError } from "../utils/log"

const ESTADOS_PACIENTE = {
  activo: { label: "Activo", color: "green" },
  baja: { label: "Baja", color: "red" },
}

export default function FichaPaciente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, geriatrico } = useAuth()

  const [paciente, setPaciente] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [form, setForm] = useState({})
  const [eventos, setEventos] = useState([])
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
      .eq("paciente_id", Number(id))
      .order("created_at", { ascending: false })
    setEventos(data || [])
  }

  useEffect(() => {
    fetchPaciente()
    fetchEventos()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const nombreUsuario = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "Usuario"

  const registrarEvento = async (descripcion) => {
    const { error } = await supabase
      .from("eventos")
      .insert({ paciente_id: Number(id), descripcion: `${descripcion} — por ${nombreUsuario}`, tipo: "auditoria" })
    if (error) logError("registrar_evento", error.message, { geriatricoId: geriatrico?.id, userId: user?.id })
  }

  const cambiarEstado = async () => {
    const nuevoEstado = (paciente.estado || "activo") === "activo" ? "baja" : "activo"
    setCambiandoEstado(true)
    const { error } = await supabase.from("Pacientes").update({ estado: nuevoEstado }).eq("id", id)
    if (error) {
      logError("cambiar_estado_paciente", error.message, { geriatricoId: geriatrico?.id, userId: user?.id })
      toaster.create({ title: "Error al cambiar estado", description: error.message, type: "error", duration: 4000 })
    } else {
      await registrarEvento(`Estado cambiado a: ${ESTADOS_PACIENTE[nuevoEstado].label}`)
      await fetchPaciente()
      await fetchEventos()
      toaster.create({ title: `Paciente dado de ${nuevoEstado === "baja" ? "baja" : "alta"}`, type: "success", duration: 3000 })
    }
    setCambiandoEstado(false)
  }

  const eliminarPaciente = async () => {
    setEliminando(true)
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
    if (error) {
      logError("eliminar_paciente", error.message, { geriatricoId: geriatrico?.id, userId: user?.id })
      toaster.create({ title: "Error al eliminar", description: error.message, type: "error", duration: 4000 })
    } else {
      toaster.create({ title: "Paciente eliminado", type: "success", duration: 3000 })
      navigate("/pacientes")
    }
  }

  const hoy = new Date().toISOString().split("T")[0]

  const guardarDatos = async () => {
    if (!form.Nombre_Completo?.trim()) {
      toaster.create({ title: "El nombre es obligatorio", type: "error", duration: 3000 })
      return
    }
    if (form.dni && !/^\d{7,8}$/.test(form.dni.trim())) {
      toaster.create({ title: "DNI inválido", description: "Debe tener 7 u 8 dígitos numéricos", type: "error", duration: 3000 })
      return
    }
    if (form.fecha_nacimiento && form.fecha_nacimiento > hoy) {
      toaster.create({ title: "Fecha de nacimiento inválida", description: "No puede ser una fecha futura", type: "error", duration: 3000 })
      return
    }
    setGuardando(true)
    const estadoActual = paciente.estado || "activo"
    const estadoNuevo = form.estado || "activo"
    const estadoCambio = estadoNuevo !== estadoActual

    const updatePayload = {
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
      estado: estadoNuevo,
    }

    const { error } = await supabase.from("Pacientes").update(updatePayload).eq("id", id)

    if (error) {
      logError("guardar_datos_paciente", error.message, { geriatricoId: geriatrico?.id, userId: user?.id })
      toaster.create({ title: "Error al guardar", description: error.message, type: "error", duration: 4000 })
    } else {
      const descripcion = estadoCambio
        ? `Estado cambiado a: ${ESTADOS_PACIENTE[estadoNuevo]?.label || estadoNuevo}`
        : "Datos del paciente actualizados"
      await registrarEvento(descripcion)
      toaster.create({ title: "Datos actualizados", type: "success", duration: 3000 })
      await fetchPaciente()
      await fetchEventos()
    }
    setGuardando(false)
  }

  if (cargando) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={20}>
        <Spinner size="xl" color="teal.500" />
      </Box>
    )
  }

  if (!paciente) {
    return (
      <Box textAlign="center" py={20}>
        <Text color="text.muted">Paciente no encontrado.</Text>
        <Button mt={4} onClick={() => navigate("/")}>Volver al inicio</Button>
      </Box>
    )
  }

  const estadoPaciente = ESTADOS_PACIENTE[paciente.estado] || ESTADOS_PACIENTE.activo

  return (
    <Box px={6} py={6}>
      <Toaster />

      {/* Header */}
      <HStack mb={5} gap={4} flexWrap="wrap" align="flex-start">
        <Button variant="ghost" size="sm" colorPalette="teal" onClick={() => navigate("/")}>
          ← Volver
        </Button>
        <Box flex={1}>
          <HStack gap={3} flexWrap="wrap" justify="space-between">
            <HStack gap={3} flexWrap="wrap">
              <Heading size="lg" color="text.main">{paciente.Nombre_Completo}</Heading>
              <Badge colorPalette={estadoPaciente.color} variant="subtle" borderRadius="full" px={3} py={1} fontSize="sm">
                {estadoPaciente.label}
              </Badge>
            </HStack>
            <HStack gap={2}>
              <Button
                size="sm"
                colorPalette={paciente.estado === "baja" ? "green" : "red"}
                variant="outline"
                onClick={cambiarEstado}
                loading={cambiandoEstado}
              >
                {paciente.estado === "baja" ? "Reactivar paciente" : "Dar de baja"}
              </Button>
              <Button
                size="sm" colorPalette="red" variant="ghost"
                onClick={() => setConfirmDelete(true)}
              >
                🗑 Eliminar
              </Button>
            </HStack>
          </HStack>
          <Text color="text.muted" fontSize="sm" mt={1}>
            DNI: {paciente.dni}
            {paciente.Obra_social && ` | Obra Social: ${paciente.Obra_social}`}
          </Text>
        </Box>
      </HStack>

      {/* Tabs */}
      <Tabs.Root defaultValue="datos">
        <Tabs.List mb={4}>
          <Tabs.Trigger value="datos">Datos del paciente</Tabs.Trigger>
          <Tabs.Trigger value="control">Control diario</Tabs.Trigger>
          <Tabs.Trigger value="medicacion">Medicación</Tabs.Trigger>
          <Tabs.Trigger value="documentos">Documentos</Tabs.Trigger>
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
                  <Input
                    value={form.dni || ""}
                    onChange={e => set("dni", e.target.value.replace(/\D/g, "").slice(0, 8))}
                    inputMode="numeric"
                    maxLength={8}
                  />
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
                  <Input type="date" value={form.fecha_nacimiento || ""} onChange={e => set("fecha_nacimiento", e.target.value)} min="1900-01-01" max={hoy} />
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
              </Grid>
              <HStack mt={5} gap={3}>
                <Button colorPalette="teal" onClick={guardarDatos} loading={guardando}>
                  Guardar cambios
                </Button>
                <Button variant="outline" colorPalette="teal" size="md" onClick={() => window.print()}>
                  Imprimir consentimiento
                </Button>
              </HStack>
            </Card.Body>
          </Card.Root>
        </Tabs.Content>

        {/* Tab: Control diario */}
        <Tabs.Content value="control">
          <Card.Root borderRadius="xl" boxShadow="md">
            <Card.Body>
              <ControlDiario pacienteId={Number(id)} pacienteNombre={paciente.Nombre_Completo} />
            </Card.Body>
          </Card.Root>
        </Tabs.Content>

        {/* Tab: Medicación */}
        <Tabs.Content value="medicacion">
          <Card.Root borderRadius="xl" boxShadow="md">
            <Card.Body>
              <MedicacionPaciente pacienteId={Number(id)} />
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

        {/* Tab: Historial */}
        <Tabs.Content value="historial">
          <Card.Root borderRadius="xl" boxShadow="md">
            <Card.Body>
              {eventos.length === 0 ? (
                <Text color="text.faint" textAlign="center" py={8}>
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
                      borderColor="border.subtle"
                      align="flex-start"
                    >
                      <Box w="8px" h="8px" borderRadius="full" bg="teal.400" mt="6px" flexShrink={0} />
                      <Box flex={1}>
                        <Text fontSize="sm" fontWeight="500">{ev.descripcion}</Text>
                        <Text fontSize="xs" color="text.faint" mt={0.5}>
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

      {/* Formulario de consentimiento oculto — solo visible al imprimir */}
      <Box id="consentimiento-print" display="none" fontFamily="serif" p={10}>
        <Text fontSize="xl" fontWeight="bold" textAlign="center" textDecoration="underline" mb={6} fontStyle="italic">
          {geriatrico?.nombre || "Residencia Geriátrica"}
        </Text>
        <Text fontSize="md" fontWeight="semibold" mb={5}>Consentimiento de Ingreso</Text>
        <HStack gap={2} mb={3} align="flex-end">
          <Text fontSize="sm" fontWeight="bold" whiteSpace="nowrap">NOMBRE Y APELLIDO:</Text>
          <Box as="span" style={{ display: "inline-block", minWidth: 200, borderBottom: "1px solid #333" }}>&nbsp;</Box>
        </HStack>
        <HStack gap={2} mb={6} align="flex-end">
          <Text fontSize="sm" fontWeight="bold" whiteSpace="nowrap">DNI:</Text>
          <Box as="span" style={{ display: "inline-block", minWidth: 120, borderBottom: "1px solid #333" }}>&nbsp;</Box>
        </HStack>
        <Text fontSize="sm" mb={2} style={{ lineHeight: 1.8 }}>
          Formulo mi consentimiento expreso de ingresar a la residencia geriátrica conforme a los derechos y obligaciones establecidos.
        </Text>
        <Text fontSize="sm" mb={12} style={{ lineHeight: 1.8 }}>
          La residencia cumple con todos los protocolos establecidos por la normativa vigente.
        </Text>
        <Grid templateColumns="1fr 1fr" gap={16} mt={8}>
          <Box>
            <Box style={{ borderBottom: "2px solid #444", marginBottom: 8, height: 60 }} />
            <Text fontSize="xs" textAlign="center">Firma</Text>
          </Box>
          <Box>
            <Box style={{ borderBottom: "2px solid #444", marginBottom: 8, height: 60 }} />
            <Text fontSize="xs" textAlign="center">Aclaración</Text>
          </Box>
        </Grid>
      </Box>

      <style>{`
        @page { margin: 0; size: A4 portrait; }
        @media print {
          body * { visibility: hidden; }
          #consentimiento-print, #consentimiento-print * { visibility: visible; display: block !important; }
          #consentimiento-print { position: fixed; top: 0; left: 0; width: 100%; padding: 60px; }
        }
      `}</style>

      <DialogRoot open={confirmDelete} onOpenChange={e => { if (!e.open) setConfirmDelete(false) }}>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent borderRadius="xl" maxW="400px">
            <DialogHeader>
              <DialogTitle>Eliminar paciente</DialogTitle>
            </DialogHeader>
            <DialogCloseTrigger />
            <DialogBody>
              <Text fontSize="sm" color="text.muted">
                ¿Estás seguro que querés eliminar a <Text as="span" fontWeight="700" color="text.main">{paciente?.Nombre_Completo}</Text>?
              </Text>
              <Text fontSize="xs" color="red.500" mt={2}>
                Esta acción eliminará todos sus registros (signos vitales, medicación, documentos, amparos). No se puede deshacer.
              </Text>
            </DialogBody>
            <DialogFooter gap={2}>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
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
