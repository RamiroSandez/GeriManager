import { useState, useEffect } from "react"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"
import {
  Badge,
  Box,
  Button,
  Card,
  FieldLabel,
  FieldRoot,
  Grid,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Spinner,
  Stack,
  Table,
  Text,
  Textarea,
} from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import { CATEGORIAS_GASTO } from "../utils/constants"

const formatPesos = (monto) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(monto)

const formatFecha = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })

const mesAnterior = (mes) => {
  const [y, m] = mes.split("-").map(Number)
  const d = new Date(y, m - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const mesSiguiente = (mes) => {
  const [y, m] = mes.split("-").map(Number)
  const d = new Date(y, m)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const nombreMes = (mes) => {
  const [y, m] = mes.split("-").map(Number)
  return new Date(y, m - 1).toLocaleString("es-AR", { month: "long", year: "numeric" })
}

const mesActual = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

const formVacio = {
  categoria: "medicamentos",
  descripcion: "",
  monto: "",
  fecha: new Date().toISOString().split("T")[0],
  proveedor: "",
  notas: "",
}

export default function Gastos() {
  const { geriatrico } = useAuth()
  const [gastos, setGastos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [filtroMes, setFiltroMes] = useState(mesActual())
  const [filtroCategoria, setFiltroCategoria] = useState("todas")
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [totalMesAnterior, setTotalMesAnterior] = useState(null)
  const [form, setForm] = useState(formVacio)

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const fetchGastos = async () => {
    setCargando(true)
    const [y, m] = filtroMes.split("-").map(Number)
    const ultimoDia = new Date(y, m, 0).toISOString().split("T")[0]
    const { data, error } = await supabase
      .from("gastos")
      .select("*")
      .eq("geriatrico_id", geriatrico?.id)
      .gte("fecha", `${filtroMes}-01`)
      .lte("fecha", ultimoDia)
      .order("fecha", { ascending: false })
    if (!error) setGastos(data || [])
    setCargando(false)
  }

  const fetchTotalMesAnterior = async () => {
    const prev = mesAnterior(filtroMes)
    const [y, m] = prev.split("-").map(Number)
    const ultimoDia = new Date(y, m, 0).toISOString().split("T")[0]
    const { data } = await supabase
      .from("gastos")
      .select("monto")
      .eq("geriatrico_id", geriatrico?.id)
      .gte("fecha", `${prev}-01`)
      .lte("fecha", ultimoDia)
    setTotalMesAnterior(data ? data.reduce((acc, g) => acc + Number(g.monto), 0) : null)
  }

  useEffect(() => {
    if (geriatrico?.id) { fetchGastos(); fetchTotalMesAnterior() }
  }, [filtroMes, geriatrico?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const abrirNuevo = () => {
    setEditandoId(null)
    setForm(formVacio)
    setMostrarForm(true)
  }

  const abrirEditar = (g) => {
    setEditandoId(g.id)
    setForm({ categoria: g.categoria, descripcion: g.descripcion, monto: String(g.monto), fecha: g.fecha, proveedor: g.proveedor || "", notas: g.notas || "" })
    setMostrarForm(true)
  }

  const cerrarForm = () => {
    setMostrarForm(false)
    setEditandoId(null)
    setForm(formVacio)
  }

  const guardarGasto = async () => {
    if (!form.descripcion || !form.monto || !form.fecha) {
      toaster.create({ title: "Completá descripción, monto y fecha", type: "warning", duration: 3000 })
      return
    }
    setGuardando(true)
    const datos = {
      categoria: form.categoria,
      descripcion: form.descripcion,
      monto: parseFloat(form.monto),
      fecha: form.fecha,
      proveedor: form.proveedor || null,
      notas: form.notas || null,
      geriatrico_id: geriatrico?.id,
    }
    const { error } = editandoId
      ? await supabase.from("gastos").update(datos).eq("id", editandoId)
      : await supabase.from("gastos").insert(datos)
    setGuardando(false)
    if (error) {
      toaster.create({ title: "Error al guardar", description: error.message, type: "error", duration: 4000 })
    } else {
      toaster.create({ title: editandoId ? "Gasto actualizado" : "Gasto registrado", type: "success", duration: 2000 })
      cerrarForm()
      fetchGastos()
      fetchTotalMesAnterior()
    }
  }

  const eliminarGasto = async (id) => {
    const { error } = await supabase.from("gastos").delete().eq("id", id)
    if (!error) {
      toaster.create({ title: "Gasto eliminado", type: "success", duration: 2000 })
      fetchGastos()
      fetchTotalMesAnterior()
    }
  }

  const totalMes = gastos.reduce((acc, g) => acc + Number(g.monto), 0)
  const diasEnMes = new Date(...filtroMes.split("-").map((v, i) => i === 1 ? Number(v) : Number(v)), 0).getDate()
  const promedioDiario = gastos.length > 0 ? totalMes / diasEnMes : 0

  const variacion = totalMesAnterior > 0
    ? Math.round(((totalMes - totalMesAnterior) / totalMesAnterior) * 100)
    : null

  const resumenCategorias = Object.entries(CATEGORIAS_GASTO)
    .map(([key, cat]) => ({
      key, cat,
      total: gastos.filter(g => g.categoria === key).reduce((acc, g) => acc + Number(g.monto), 0),
      count: gastos.filter(g => g.categoria === key).length,
    }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total)

  const gastosFiltrados = filtroCategoria === "todas"
    ? gastos
    : gastos.filter(g => g.categoria === filtroCategoria)

  return (
    <Box px={6} py={6} maxW="1400px" mx="auto">
      <Toaster />

      {/* Modal form */}
      {mostrarForm && (
        <Box position="fixed" inset={0} zIndex={200} display="flex" alignItems="center" justifyContent="center">
          <Box position="absolute" inset={0} bg="blackAlpha.600" onClick={cerrarForm} />
          <Box
            position="relative" bg="bg.panel" borderRadius="2xl" boxShadow="2xl"
            p={6} w="full" maxW="620px" mx={4}
            border="1px solid" borderColor="border.subtle"
          >
            <HStack justify="space-between" mb={5}>
              <Heading size="md" color="text.main">
                {editandoId ? "Editar gasto" : "Nuevo gasto"}
              </Heading>
              <Button variant="ghost" size="sm" onClick={cerrarForm} color="text.muted">✕</Button>
            </HStack>
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
              <FieldRoot>
                <FieldLabel fontSize="sm">Categoría</FieldLabel>
                <NativeSelect.Root>
                  <NativeSelect.Field value={form.categoria} onChange={e => set("categoria", e.target.value)}>
                    {Object.entries(CATEGORIAS_GASTO).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Fecha *</FieldLabel>
                <Input type="date" value={form.fecha} onChange={e => set("fecha", e.target.value)} />
              </FieldRoot>
              <FieldRoot gridColumn={{ md: "span 2" }}>
                <FieldLabel fontSize="sm">Descripción *</FieldLabel>
                <Input value={form.descripcion} onChange={e => set("descripcion", e.target.value)} placeholder="Ej: Compra de pañales" />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Monto (ARS) *</FieldLabel>
                <Input type="number" value={form.monto} onChange={e => set("monto", e.target.value)} placeholder="0.00" />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Proveedor</FieldLabel>
                <Input value={form.proveedor} onChange={e => set("proveedor", e.target.value)} placeholder="Nombre del proveedor" />
              </FieldRoot>
              <FieldRoot gridColumn={{ md: "span 2" }}>
                <FieldLabel fontSize="sm">Notas</FieldLabel>
                <Textarea value={form.notas} onChange={e => set("notas", e.target.value)} rows={2} placeholder="Observaciones opcionales..." />
              </FieldRoot>
            </Grid>
            <HStack mt={5} justify="flex-end" gap={3}>
              <Button variant="ghost" onClick={cerrarForm}>Cancelar</Button>
              <Button colorPalette="blue" onClick={guardarGasto} loading={guardando}>
                {editandoId ? "Guardar cambios" : "Registrar gasto"}
              </Button>
            </HStack>
          </Box>
        </Box>
      )}

      {/* Header */}
      <HStack mb={6} justify="space-between" flexWrap="wrap" gap={3}>
        <Box>
          <Heading size="lg" color="text.main" textTransform="capitalize">
            {nombreMes(filtroMes)}
          </Heading>
          <Text fontSize="sm" color="text.muted">{gastos.length} gastos registrados</Text>
        </Box>
        <HStack gap={3}>
          <HStack gap={1}>
            <Button variant="outline" size="sm" onClick={() => setFiltroMes(mesAnterior(filtroMes))}>←</Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setFiltroMes(mesSiguiente(filtroMes))}
              disabled={filtroMes >= mesActual()}
            >→</Button>
          </HStack>
          <Button colorPalette="blue" size="sm" onClick={abrirNuevo}>+ Nuevo gasto</Button>
        </HStack>
      </HStack>

      {/* Stats */}
      <Grid templateColumns={{ base: "1fr 1fr", md: "repeat(4, 1fr)" }} gap={4} mb={6}>
        <Card.Root borderRadius="xl" boxShadow="sm" bg="blue.600" color="white" gridColumn={{ base: "span 2", md: "span 1" }}>
          <Card.Body py={5} px={5}>
            <Text fontSize="xs" opacity={0.8} mb={1} fontWeight="500">Total del mes</Text>
            <Text fontSize="2xl" fontWeight="800">{formatPesos(totalMes)}</Text>
            {variacion !== null && (
              <Text fontSize="xs" opacity={0.8} mt={1}>
                {variacion > 0 ? "▲" : variacion < 0 ? "▼" : "="} {Math.abs(variacion)}% vs mes anterior
              </Text>
            )}
          </Card.Body>
        </Card.Root>

        <Card.Root borderRadius="xl" boxShadow="sm" bg="bg.panel">
          <Card.Body py={5} px={5}>
            <Text fontSize="xs" color="text.faint" mb={1} fontWeight="500">Promedio diario</Text>
            <Text fontSize="xl" fontWeight="700" color="text.main">{formatPesos(promedioDiario)}</Text>
            <Text fontSize="xs" color="text.faint" mt={1}>por día este mes</Text>
          </Card.Body>
        </Card.Root>

        <Card.Root borderRadius="xl" boxShadow="sm" bg="bg.panel">
          <Card.Body py={5} px={5}>
            <Text fontSize="xs" color="text.faint" mb={1} fontWeight="500">Mes anterior</Text>
            <Text fontSize="xl" fontWeight="700" color="text.main">
              {totalMesAnterior !== null ? formatPesos(totalMesAnterior) : "—"}
            </Text>
            <Text fontSize="xs" color="text.faint" mt={1} textTransform="capitalize">
              {nombreMes(mesAnterior(filtroMes))}
            </Text>
          </Card.Body>
        </Card.Root>

        <Card.Root borderRadius="xl" boxShadow="sm" bg="bg.panel">
          <Card.Body py={5} px={5}>
            <Text fontSize="xs" color="text.faint" mb={1} fontWeight="500">Categorías activas</Text>
            <Text fontSize="xl" fontWeight="700" color="text.main">{resumenCategorias.length}</Text>
            <Text fontSize="xs" color="text.faint" mt={1}>
              {resumenCategorias[0]?.cat.label || "—"} es la mayor
            </Text>
          </Card.Body>
        </Card.Root>
      </Grid>

      {/* Layout principal */}
      <Grid templateColumns={{ base: "1fr", lg: "1fr 300px" }} gap={6} alignItems="start">

        {/* Tabla */}
        <Card.Root boxShadow="md" borderRadius="xl">
          <Card.Header>
            <HStack justify="space-between" flexWrap="wrap" gap={3}>
              <Heading size="sm" color="text.main">Detalle de gastos</Heading>
              {/* Filtro categoría */}
              <HStack gap={2} flexWrap="wrap">
                <Button
                  size="xs" borderRadius="full"
                  variant={filtroCategoria === "todas" ? "solid" : "outline"}
                  colorPalette="gray"
                  onClick={() => setFiltroCategoria("todas")}
                >
                  Todas
                </Button>
                {resumenCategorias.map(({ key, cat }) => (
                  <Button
                    key={key} size="xs" borderRadius="full"
                    variant={filtroCategoria === key ? "solid" : "outline"}
                    colorPalette={cat.color}
                    onClick={() => setFiltroCategoria(filtroCategoria === key ? "todas" : key)}
                  >
                    {cat.label}
                  </Button>
                ))}
              </HStack>
            </HStack>
          </Card.Header>
          <Card.Body p={0}>
            {cargando ? (
              <Box display="flex" justifyContent="center" py={10}>
                <Spinner size="lg" color="blue.500" />
              </Box>
            ) : gastos.length === 0 ? (
              <Box textAlign="center" py={14}>
                <Text fontSize="2xl" mb={2}>💸</Text>
                <Text color="text.faint" mb={3}>No hay gastos registrados para este mes.</Text>
                <Button size="sm" colorPalette="blue" onClick={abrirNuevo}>+ Agregar primer gasto</Button>
              </Box>
            ) : (
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row bg="bg.muted">
                    <Table.ColumnHeader fontWeight="600" pl={4}>Fecha</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="600">Categoría</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="600">Descripción</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="600">Proveedor</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="600" textAlign="right">Monto</Table.ColumnHeader>
                    <Table.ColumnHeader pr={4}></Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {gastosFiltrados.map(g => {
                    const cat = CATEGORIAS_GASTO[g.categoria] || CATEGORIAS_GASTO.otro
                    return (
                      <Table.Row key={g.id} _hover={{ bg: "bg.hover" }}>
                        <Table.Cell pl={4} fontSize="sm" color="text.muted" whiteSpace="nowrap">
                          {formatFecha(g.fecha)}
                        </Table.Cell>
                        <Table.Cell>
                          <Badge colorPalette={cat.color} variant="subtle" borderRadius="full" px={2} fontSize="xs">
                            {cat.label}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell fontWeight="500" fontSize="sm">
                          {g.descripcion}
                          {g.notas && (
                            <Text fontSize="xs" color="text.faint" fontWeight="400">{g.notas}</Text>
                          )}
                        </Table.Cell>
                        <Table.Cell fontSize="sm" color="text.faint">{g.proveedor || "—"}</Table.Cell>
                        <Table.Cell textAlign="right" fontWeight="600" fontSize="sm" color="text.main">
                          {formatPesos(g.monto)}
                        </Table.Cell>
                        <Table.Cell pr={4}>
                          <HStack gap={0}>
                            <Button size="xs" variant="ghost" colorPalette="blue" onClick={() => abrirEditar(g)}>✏</Button>
                            <Button size="xs" variant="ghost" colorPalette="red" onClick={() => eliminarGasto(g.id)}>✕</Button>
                          </HStack>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
                {gastosFiltrados.length > 0 && (
                  <Table.Footer>
                    <Table.Row bg="bg.muted" fontWeight="700">
                      <Table.Cell pl={4} colSpan={4} fontSize="sm" color="text.main">
                        Total {filtroCategoria !== "todas" ? `(${CATEGORIAS_GASTO[filtroCategoria]?.label})` : ""}
                      </Table.Cell>
                      <Table.Cell textAlign="right" color="blue.600" fontSize="sm">
                        {formatPesos(gastosFiltrados.reduce((acc, g) => acc + Number(g.monto), 0))}
                      </Table.Cell>
                      <Table.Cell pr={4} />
                    </Table.Row>
                  </Table.Footer>
                )}
              </Table.Root>
            )}
          </Card.Body>
        </Card.Root>

        {/* Resumen por categoría */}
        {resumenCategorias.length > 0 && (
          <Stack gap={4}>
            <Card.Root borderRadius="xl" boxShadow="md">
              <Card.Header>
                <Heading size="sm" color="text.main">Por categoría</Heading>
              </Card.Header>
              <Card.Body>
                <Stack gap={4}>
                  {resumenCategorias.map(({ key, cat, total, count }) => {
                    const porcentaje = totalMes > 0 ? Math.round((total / totalMes) * 100) : 0
                    return (
                      <Box
                        key={key} cursor="pointer"
                        onClick={() => setFiltroCategoria(filtroCategoria === key ? "todas" : key)}
                        opacity={filtroCategoria !== "todas" && filtroCategoria !== key ? 0.4 : 1}
                        transition="opacity 0.15s"
                      >
                        <HStack justify="space-between" mb={1}>
                          <HStack gap={2}>
                            <Badge colorPalette={cat.color} variant="subtle" borderRadius="full" px={2} fontSize="xs">
                              {cat.label}
                            </Badge>
                            <Text fontSize="xs" color="text.faint">{count} gasto{count !== 1 ? "s" : ""}</Text>
                          </HStack>
                          <Text fontSize="sm" fontWeight="600" color="text.main">{formatPesos(total)}</Text>
                        </HStack>
                        <Box bg="bg.muted" borderRadius="full" h="5px" overflow="hidden">
                          <Box
                            bg={`${cat.color}.400`} h="100%" borderRadius="full"
                            w={`${porcentaje}%`} transition="width 0.4s"
                          />
                        </Box>
                        <Text fontSize="xs" color="text.faint" mt={0.5}>{porcentaje}%</Text>
                      </Box>
                    )
                  })}
                  <Box borderTop="1px solid" borderColor="border.subtle" pt={3}>
                    <HStack justify="space-between">
                      <Text fontWeight="700" fontSize="sm" color="text.main">Total mes</Text>
                      <Text fontWeight="800" color="blue.600" fontSize="lg">{formatPesos(totalMes)}</Text>
                    </HStack>
                  </Box>
                </Stack>
              </Card.Body>
            </Card.Root>
          </Stack>
        )}
      </Grid>
    </Box>
  )
}
