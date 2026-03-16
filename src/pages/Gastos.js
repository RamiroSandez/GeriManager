import { useState, useEffect } from "react"
import { supabase } from "../services/supabase"
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

const mesActual = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

const formatPesos = (monto) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(monto)

export default function Gastos() {
  const [gastos, setGastos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [filtroMes, setFiltroMes] = useState(mesActual())
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({
    categoria: "medicamentos",
    descripcion: "",
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
    proveedor: "",
    notas: "",
  })

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const fetchGastos = async () => {
    setCargando(true)
    const desde = `${filtroMes}-01`
    const hasta = `${filtroMes}-31`
    const { data, error } = await supabase
      .from("gastos")
      .select("*")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false })
    if (!error) setGastos(data || [])
    setCargando(false)
  }

  useEffect(() => {
    fetchGastos()
  }, [filtroMes]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardarGasto = async () => {
    if (!form.descripcion || !form.monto || !form.fecha) {
      toaster.create({ title: "Completá descripción, monto y fecha", type: "warning", duration: 3000 })
      return
    }
    setGuardando(true)
    const { error } = await supabase.from("gastos").insert({
      categoria: form.categoria,
      descripcion: form.descripcion,
      monto: parseFloat(form.monto),
      fecha: form.fecha,
      proveedor: form.proveedor || null,
      notas: form.notas || null,
    })
    setGuardando(false)
    if (error) {
      toaster.create({ title: "Error al guardar", description: error.message, type: "error", duration: 4000 })
    } else {
      toaster.create({ title: "Gasto registrado", type: "success", duration: 2000 })
      setForm({ categoria: "medicamentos", descripcion: "", monto: "", fecha: new Date().toISOString().split("T")[0], proveedor: "", notas: "" })
      setMostrarForm(false)
      fetchGastos()
    }
  }

  const eliminarGasto = async (id) => {
    const { error } = await supabase.from("gastos").delete().eq("id", id)
    if (error) {
      toaster.create({ title: "Error al eliminar", type: "error", duration: 3000 })
    } else {
      toaster.create({ title: "Gasto eliminado", type: "success", duration: 2000 })
      fetchGastos()
    }
  }

  const exportarExcel = async () => {
    const webhookUrl = process.env.REACT_APP_N8N_WEBHOOK_GASTOS
    if (!webhookUrl) {
      toaster.create({
        title: "Webhook no configurado",
        description: "Agregá REACT_APP_N8N_WEBHOOK_GASTOS en el .env",
        type: "warning",
        duration: 5000,
      })
      return
    }
    setExportando(true)
    const payload = {
      mes: filtroMes,
      gastos: gastos,
      total: gastos.reduce((acc, g) => acc + Number(g.monto), 0),
      por_categoria: Object.keys(CATEGORIAS_GASTO).map(cat => ({
        categoria: CATEGORIAS_GASTO[cat].label,
        total: gastos.filter(g => g.categoria === cat).reduce((acc, g) => acc + Number(g.monto), 0),
      })),
      timestamp: new Date().toISOString(),
    }
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(`Error HTTP ${response.status}`)
      toaster.create({ title: "Enviado a n8n para generar Excel", type: "success", duration: 4000 })
    } catch (err) {
      toaster.create({ title: "Error al exportar", description: err.message, type: "error", duration: 5000 })
    }
    setExportando(false)
  }

  const totalMes = gastos.reduce((acc, g) => acc + Number(g.monto), 0)

  return (
    <Box px={6} py={6}>
      <Toaster />

      {/* Header */}
      <HStack mb={6} justify="space-between" flexWrap="wrap" gap={3}>
        <Heading size="lg" color="gray.800">Panel de Gastos</Heading>
        <HStack gap={2} flexWrap="wrap">
          <Input
            type="month"
            value={filtroMes}
            onChange={e => setFiltroMes(e.target.value)}
            maxW="180px"
            bg="white"
            borderRadius="lg"
          />
          <Button colorPalette="green" onClick={() => setMostrarForm(!mostrarForm)}>
            {mostrarForm ? "Cancelar" : "+ Nuevo gasto"}
          </Button>
          <Button
            colorPalette="teal"
            variant="outline"
            onClick={exportarExcel}
            loading={exportando}
          >
            Exportar Excel
          </Button>
        </HStack>
      </HStack>

      {/* Stats por categoría */}
      <Grid templateColumns="repeat(auto-fill, minmax(160px, 1fr))" gap={4} mb={6}>
        <Card.Root borderRadius="lg" boxShadow="sm" bg="white">
          <Card.Body py={4} px={5}>
            <Text fontSize="xl" fontWeight="bold" color="gray.800">
              {formatPesos(totalMes)}
            </Text>
            <Text fontSize="sm" color="gray.500">Total del mes</Text>
          </Card.Body>
        </Card.Root>
        {Object.entries(CATEGORIAS_GASTO).map(([key, cat]) => {
          const total = gastos.filter(g => g.categoria === key).reduce((acc, g) => acc + Number(g.monto), 0)
          if (total === 0) return null
          return (
            <Card.Root key={key} borderRadius="lg" boxShadow="sm" bg="white">
              <Card.Body py={4} px={5}>
                <Text fontSize="lg" fontWeight="bold" color={`${cat.color}.600`}>
                  {formatPesos(total)}
                </Text>
                <Text fontSize="xs" color="gray.500">{cat.label}</Text>
              </Card.Body>
            </Card.Root>
          )
        })}
      </Grid>

      {/* Formulario nuevo gasto */}
      {mostrarForm && (
        <Card.Root borderRadius="xl" boxShadow="md" mb={6} border="1px solid" borderColor="green.100">
          <Card.Header>
            <Heading size="sm" color="gray.700">Registrar nuevo gasto</Heading>
          </Card.Header>
          <Card.Body>
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap={4}>
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
                <FieldLabel fontSize="sm">Descripción *</FieldLabel>
                <Input value={form.descripcion} onChange={e => set("descripcion", e.target.value)} placeholder="Ej: Compra de pañales" />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Monto (ARS) *</FieldLabel>
                <Input type="number" value={form.monto} onChange={e => set("monto", e.target.value)} placeholder="0.00" />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Fecha *</FieldLabel>
                <Input type="date" value={form.fecha} onChange={e => set("fecha", e.target.value)} />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Proveedor</FieldLabel>
                <Input value={form.proveedor} onChange={e => set("proveedor", e.target.value)} placeholder="Nombre del proveedor" />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Notas</FieldLabel>
                <Textarea value={form.notas} onChange={e => set("notas", e.target.value)} rows={1} placeholder="Observaciones..." />
              </FieldRoot>
            </Grid>
            <Button mt={4} colorPalette="green" onClick={guardarGasto} loading={guardando}>
              Guardar gasto
            </Button>
          </Card.Body>
        </Card.Root>
      )}

      {/* Tabla de gastos */}
      <Card.Root boxShadow="md" borderRadius="xl">
        <Card.Header>
          <HStack justify="space-between">
            <Heading size="md" color="gray.700">
              Gastos de {filtroMes} ({gastos.length})
            </Heading>
          </HStack>
        </Card.Header>
        <Card.Body p={0}>
          {cargando ? (
            <Box display="flex" justifyContent="center" py={10}>
              <Spinner size="lg" color="blue.500" />
            </Box>
          ) : gastos.length === 0 ? (
            <Text color="gray.400" textAlign="center" py={10}>
              No hay gastos registrados para este mes.
            </Text>
          ) : (
            <Table.Root size="md">
              <Table.Header>
                <Table.Row bg="gray.50">
                  <Table.ColumnHeader fontWeight="600">Fecha</Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="600">Categoría</Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="600">Descripción</Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="600">Proveedor</Table.ColumnHeader>
                  <Table.ColumnHeader fontWeight="600" textAlign="right">Monto</Table.ColumnHeader>
                  <Table.ColumnHeader></Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {gastos.map(g => {
                  const cat = CATEGORIAS_GASTO[g.categoria] || CATEGORIAS_GASTO.otro
                  return (
                    <Table.Row key={g.id}>
                      <Table.Cell fontSize="sm" color="gray.600">
                        {new Date(g.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge colorPalette={cat.color} variant="subtle" borderRadius="full" px={3} fontSize="xs">
                          {cat.label}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell fontWeight="500">{g.descripcion}</Table.Cell>
                      <Table.Cell fontSize="sm" color="gray.500">{g.proveedor || "—"}</Table.Cell>
                      <Table.Cell textAlign="right" fontWeight="600" color="gray.800">
                        {formatPesos(g.monto)}
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          size="xs"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => eliminarGasto(g.id)}
                        >
                          Eliminar
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

      {/* Resumen por categoría */}
      {gastos.length > 0 && (
        <Card.Root borderRadius="xl" boxShadow="md" mt={6}>
          <Card.Header>
            <Heading size="sm" color="gray.700">Resumen por categoría</Heading>
          </Card.Header>
          <Card.Body>
            <Stack gap={2}>
              {Object.entries(CATEGORIAS_GASTO).map(([key, cat]) => {
                const total = gastos.filter(g => g.categoria === key).reduce((acc, g) => acc + Number(g.monto), 0)
                if (total === 0) return null
                const porcentaje = totalMes > 0 ? Math.round((total / totalMes) * 100) : 0
                return (
                  <HStack key={key} justify="space-between">
                    <HStack gap={2}>
                      <Badge colorPalette={cat.color} variant="subtle" borderRadius="full" px={3} fontSize="xs">
                        {cat.label}
                      </Badge>
                      <Text fontSize="sm" color="gray.500">{porcentaje}%</Text>
                    </HStack>
                    <Text fontWeight="600" fontSize="sm">{formatPesos(total)}</Text>
                  </HStack>
                )
              })}
              <Box borderTop="1px solid" borderColor="gray.100" pt={2} mt={1}>
                <HStack justify="space-between">
                  <Text fontWeight="700" color="gray.700">Total</Text>
                  <Text fontWeight="700" color="gray.800" fontSize="lg">{formatPesos(totalMes)}</Text>
                </HStack>
              </Box>
            </Stack>
          </Card.Body>
        </Card.Root>
      )}
    </Box>
  )
}
