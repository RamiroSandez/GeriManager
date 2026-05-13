import { useState, useEffect } from "react"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"
import {
  Box, Button, FieldLabel, FieldRoot,
  Grid, HStack, Input, NativeSelect, Stack, Text,
} from "@chakra-ui/react"
import { toaster } from "./toaster"

const FORM_INICIAL = { medicamento_id: "", dosis: "", frecuencia: "", via: "", observaciones: "" }

export default function MedicacionPaciente({ pacienteId }) {
  const { geriatrico } = useAuth()
  const [asignadas, setAsignadas] = useState([])
  const [catalogo, setCatalogo] = useState([])
  const [form, setForm] = useState(FORM_INICIAL)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const fetchAsignadas = async () => {
    const { data } = await supabase
      .from("paciente_medicamentos")
      .select("*, medicamento:medicamento_id(nombre, presentacion, dosis_estandar)")
      .eq("paciente_id", pacienteId)
      .order("created_at")
    setAsignadas(data || [])
  }

  const fetchCatalogo = async () => {
    const { data } = await supabase
      .from("medicamentos")
      .select("*")
      .eq("geriatrico_id", geriatrico.id)
      .order("nombre")
    setCatalogo(data || [])
  }

  useEffect(() => {
    fetchAsignadas()
    if (geriatrico?.id) fetchCatalogo()
  }, [pacienteId, geriatrico?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const guardar = async () => {
    if (!form.medicamento_id) {
      toaster.create({ title: "Seleccioná un medicamento", type: "error", duration: 3000 })
      return
    }
    setGuardando(true)
    const { error } = await supabase.from("paciente_medicamentos").insert([{
      paciente_id: pacienteId,
      medicamento_id: Number(form.medicamento_id),
      dosis: form.dosis || null,
      frecuencia: form.frecuencia || null,
      via: form.via || null,
      observaciones: form.observaciones || null,
    }])
    setGuardando(false)
    if (error) {
      toaster.create({ title: "Error al asignar", description: error.message, type: "error", duration: 4000 })
    } else {
      toaster.create({ title: "Medicamento asignado", type: "success", duration: 2000 })
      setForm(FORM_INICIAL)
      setMostrarForm(false)
      fetchAsignadas()
    }
  }

  const quitar = async (id) => {
    const { error } = await supabase.from("paciente_medicamentos").delete().eq("id", id)
    if (!error) {
      fetchAsignadas()
      toaster.create({ title: "Medicamento removido", type: "success", duration: 2000 })
    }
  }

  return (
    <Stack gap={4}>
      <HStack justify="space-between">
        <Text fontWeight="semibold" fontSize="sm" color="text.main">Medicación activa</Text>
        <Button
          size="sm"
          colorPalette="teal"
          variant="outline"
          onClick={() => { setMostrarForm(!mostrarForm); setForm(FORM_INICIAL) }}
        >
          {mostrarForm ? "Cancelar" : "+ Asignar medicamento"}
        </Button>
      </HStack>

      {mostrarForm && (
        <Box
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="lg"
          p={4}
          bg="bg.panel"
        >
          {catalogo.length === 0 ? (
            <Text fontSize="sm" color="text.faint">
              No hay medicamentos en el catálogo. Primero cargalos en la sección{" "}
              <a href="/medicamentos" style={{ color: "#3B82F6", textDecoration: "underline" }}>
                Medicamentos
              </a>.
            </Text>
          ) : (
            <>
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap={3} mb={3}>
                <FieldRoot required>
                  <FieldLabel fontSize="sm">Medicamento *</FieldLabel>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={form.medicamento_id}
                      onChange={e => set("medicamento_id", e.target.value)}
                      bg="bg.panel"
                    >
                      <option value="">Seleccionar...</option>
                      {catalogo.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}{m.dosis_estandar ? ` — ${m.dosis_estandar}` : ""}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel fontSize="sm">Dosis</FieldLabel>
                  <Input
                    value={form.dosis}
                    onChange={e => set("dosis", e.target.value)}
                    placeholder="Ej: 1 comprimido"
                    size="sm"
                  />
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel fontSize="sm">Frecuencia</FieldLabel>
                  <Input
                    value={form.frecuencia}
                    onChange={e => set("frecuencia", e.target.value)}
                    placeholder="Ej: Cada 8hs"
                    size="sm"
                  />
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel fontSize="sm">Vía</FieldLabel>
                  <Input
                    value={form.via}
                    onChange={e => set("via", e.target.value)}
                    placeholder="Ej: Oral"
                    size="sm"
                  />
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel fontSize="sm">Observaciones</FieldLabel>
                  <Input
                    value={form.observaciones}
                    onChange={e => set("observaciones", e.target.value)}
                    placeholder="Opcional"
                    size="sm"
                  />
                </FieldRoot>
              </Grid>
              <Button colorPalette="teal" size="sm" onClick={guardar} loading={guardando}>
                Asignar
              </Button>
            </>
          )}
        </Box>
      )}

      {asignadas.length === 0 ? (
        <Box
          textAlign="center"
          py={10}
          border="1px dashed"
          borderColor="border.subtle"
          borderRadius="lg"
        >
          <Text color="text.faint" fontSize="sm">No hay medicamentos asignados</Text>
        </Box>
      ) : (
        <Stack gap={0}>
          {/* Header */}
          <Box
            display="grid"
            gridTemplateColumns="1.5fr 120px 150px 100px 1fr 60px"
            px={4}
            py={2}
            borderBottom="1px solid"
            borderColor="border.subtle"
            bg="bg.muted"
            borderRadius="lg"
          >
            {["Medicamento", "Dosis", "Frecuencia", "Vía", "Observaciones", ""].map((h, i) => (
              <Text key={i} fontSize="xs" fontWeight="600" color="text.faint" textTransform="uppercase" letterSpacing="wider">
                {h}
              </Text>
            ))}
          </Box>

          {asignadas.map((a, i) => (
            <Box
              key={a.id}
              display="grid"
              gridTemplateColumns="1.5fr 120px 150px 100px 1fr 60px"
              px={4}
              py={3}
              borderBottom={i < asignadas.length - 1 ? "1px solid" : "none"}
              borderColor="border.subtle"
              alignItems="center"
              _hover={{ bg: "bg.hover" }}
              transition="background 0.1s"
            >
              <Text fontSize="sm" fontWeight="500" color="text.main">{a.medicamento?.nombre}</Text>
              <Text fontSize="sm" color="text.muted">{a.dosis || "—"}</Text>
              <Text fontSize="sm" color="text.muted">{a.frecuencia || "—"}</Text>
              <Text fontSize="sm" color="text.muted">{a.via || "—"}</Text>
              <Text fontSize="sm" color="text.muted">{a.observaciones || "—"}</Text>
              <Box textAlign="right">
                <Button size="xs" colorPalette="red" variant="ghost" onClick={() => quitar(a.id)}>
                  Quitar
                </Button>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
