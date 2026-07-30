import { useState, useEffect } from "react"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"
import {
  Box, Button, HStack, Input, Stack, Text,
} from "@chakra-ui/react"
import { toaster } from "./toaster"

export default function MedicacionPaciente({ pacienteId, registrarEvento, onCambio }) {
  const { geriatrico } = useAuth()
  const [asignadas, setAsignadas] = useState([])
  const [catalogo, setCatalogo] = useState([])
  const [seleccionados, setSeleccionados] = useState({}) // { [medId]: { dosis, frecuencia } }
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

  const disponibles = catalogo.filter(m => !asignadas.some(a => a.medicamento_id === m.id))
  const idsSeleccionados = Object.keys(seleccionados).map(Number)

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => {
      if (prev[id] !== undefined) {
        const { [id]: _, ...rest } = prev
        return rest
      }
      const med = catalogo.find(m => m.id === id)
      return { ...prev, [id]: { dosis: med?.dosis_estandar || "", frecuencia: "" } }
    })
  }

  const setDosis = (id, val) =>
    setSeleccionados(prev => ({ ...prev, [id]: { ...prev[id], dosis: val } }))

  const setFrecuencia = (id, val) =>
    setSeleccionados(prev => ({ ...prev, [id]: { ...prev[id], frecuencia: val } }))

  const guardar = async () => {
    if (idsSeleccionados.length === 0) {
      toaster.create({ title: "Seleccioná al menos un medicamento", type: "warning", duration: 3000 })
      return
    }
    setGuardando(true)
    const filas = idsSeleccionados.map(medId => ({
      paciente_id: pacienteId,
      medicamento_id: medId,
      dosis: seleccionados[medId]?.dosis || null,
      frecuencia: seleccionados[medId]?.frecuencia || null,
    }))
    const { error } = await supabase.from("paciente_medicamentos").insert(filas)
    setGuardando(false)
    if (error) {
      toaster.create({ title: "Error al asignar", description: error.message, type: "error", duration: 4000 })
    } else {
      const nombres = idsSeleccionados.map(mid => catalogo.find(m => m.id === mid)?.nombre).filter(Boolean)
      toaster.create({ title: `${idsSeleccionados.length} medicamento${idsSeleccionados.length > 1 ? "s asignados" : " asignado"}`, type: "success", duration: 2000 })
      if (registrarEvento) await registrarEvento(`Medicación asignada: ${nombres.join(", ")}`)
      if (onCambio) onCambio()
      setSeleccionados({})
      setMostrarForm(false)
      fetchAsignadas()
    }
  }

  const quitar = async (id) => {
    const med = asignadas.find(a => a.id === id)
    const { error } = await supabase.from("paciente_medicamentos").delete().eq("id", id)
    if (!error) {
      toaster.create({ title: "Medicamento removido", type: "success", duration: 2000 })
      if (registrarEvento) await registrarEvento(`Medicación removida: ${med?.medicamento?.nombre || ""}`)
      if (onCambio) onCambio()
      fetchAsignadas()
    }
  }

  const abrirForm = () => {
    setSeleccionados({})
    setMostrarForm(true)
  }

  return (
    <Stack gap={4}>
      <HStack justify="space-between">
        <Text fontWeight="semibold" fontSize="sm" color="text.main">Medicación activa</Text>
        {!mostrarForm && disponibles.length > 0 && (
          <Button size="sm" colorPalette="teal" variant="outline" onClick={abrirForm}>
            + Asignar medicamento
          </Button>
        )}
        {mostrarForm && (
          <Button size="sm" variant="ghost" colorPalette="gray" onClick={() => setMostrarForm(false)}>
            Cancelar
          </Button>
        )}
      </HStack>

      {mostrarForm && (
        <Box border="1px solid" borderColor="border.subtle" borderRadius="lg" p={4} bg="bg.panel">
          {disponibles.length === 0 ? (
            <Text fontSize="sm" color="text.faint">
              Todos los medicamentos del catálogo ya están asignados.
            </Text>
          ) : (
            <Stack gap={3}>
              <Text fontSize="xs" color="text.muted">Seleccioná uno o varios medicamentos para agregar:</Text>
              <Stack gap={1}>
                {disponibles.map(m => {
                  const activo = seleccionados[m.id] !== undefined
                  return (
                    <Box
                      key={m.id}
                      borderRadius="md"
                      border="1px solid"
                      borderColor={activo ? "teal.500" : "border.subtle"}
                      bg={activo ? "teal.500/10" : "bg.muted"}
                      overflow="hidden"
                      transition="all 0.15s"
                    >
                      <HStack
                        px={3} py={2} cursor="pointer"
                        onClick={() => toggleSeleccion(m.id)}
                        _hover={{ borderColor: "teal.400" }}
                        justify="space-between"
                      >
                        <Box>
                          <Text fontSize="sm" fontWeight="600" color="text.main">{m.nombre}</Text>
                          {m.dosis_estandar && (
                            <Text fontSize="xs" color="text.muted">{m.dosis_estandar}</Text>
                          )}
                        </Box>
                        <Box
                          w="18px" h="18px" borderRadius="full" flexShrink={0}
                          bg={activo ? "teal.500" : "bg.panel"}
                          border="2px solid"
                          borderColor={activo ? "teal.500" : "border.subtle"}
                          display="flex" alignItems="center" justifyContent="center"
                          fontSize="10px" color="white" fontWeight="700"
                        >
                          {activo ? "✓" : ""}
                        </Box>
                      </HStack>
                      {activo && (
                        <HStack px={3} pb={2} gap={2} onClick={e => e.stopPropagation()}>
                          <Input
                            size="xs"
                            placeholder="Dosis (ej: 500mg)"
                            value={seleccionados[m.id]?.dosis || ""}
                            onChange={e => setDosis(m.id, e.target.value)}
                            bg="bg.panel"
                          />
                          <Input
                            size="xs"
                            placeholder="Frecuencia (ej: Cada 8hs, Una vez al día)"
                            value={seleccionados[m.id]?.frecuencia || ""}
                            onChange={e => setFrecuencia(m.id, e.target.value)}
                            bg="bg.panel"
                          />
                        </HStack>
                      )}
                    </Box>
                  )
                })}
              </Stack>
              <Button
                colorPalette="teal" size="sm" onClick={guardar} loading={guardando}
                disabled={idsSeleccionados.length === 0}
              >
                Agregar {idsSeleccionados.length > 0 ? `${idsSeleccionados.length} medicamento${idsSeleccionados.length > 1 ? "s" : ""}` : ""}
              </Button>
            </Stack>
          )}
        </Box>
      )}

      {asignadas.length === 0 ? (
        <Box textAlign="center" py={10} border="1px dashed" borderColor="border.subtle" borderRadius="lg">
          <Text color="text.faint" fontSize="sm">No hay medicamentos asignados</Text>
        </Box>
      ) : (
        <Stack gap={0}>
          <Box
            display="grid"
            gridTemplateColumns="1.5fr 120px 150px 100px 1fr 60px"
            px={4} py={2}
            borderBottom="1px solid" borderColor="border.subtle"
            bg="bg.muted" borderRadius="lg"
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
              px={4} py={3}
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
