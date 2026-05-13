import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"
import {
  Box, Button, Card, Grid, Heading, HStack, Spinner, Stack, Text,
} from "@chakra-ui/react"
import { Toaster } from "../components/toaster"

function KpiCard({ valor, label, color, sub, icono, onClick }) {
  return (
    <Card.Root
      borderRadius="xl" boxShadow="sm" bg="bg.panel"
      cursor={onClick ? "pointer" : "default"}
      _hover={onClick ? { boxShadow: "md", transform: "translateY(-1px)" } : {}}
      transition="all 0.15s"
      onClick={onClick}
    >
      <Card.Body py={5} px={6}>
        <HStack justify="space-between" align="flex-start">
          <Box>
            <Text fontSize="3xl" fontWeight="800" color={color} lineHeight="1">{valor}</Text>
            <Text fontSize="sm" color="text.muted" mt={1} fontWeight="500">{label}</Text>
            {sub && <Text fontSize="11px" color="text.faint" mt={0.5}>{sub}</Text>}
          </Box>
          <Text fontSize="2xl" opacity={0.8}>{icono}</Text>
        </HStack>
      </Card.Body>
    </Card.Root>
  )
}

const formatPesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)

export default function Panel() {
  const { geriatrico } = useAuth()
  const navigate = useNavigate()
  const [cargando, setCargando] = useState(true)
  const [kpis, setKpis] = useState({
    totalPacientes: 0, activos: 0, bajas: 0,
    gastosMes: 0, alertasSignos: 0, medPendientes: 0, cumpleHoy: [],
  })

  useEffect(() => {
    if (!geriatrico?.id) return
    fetchData()
  }, [geriatrico?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    setCargando(true)
    const { data: pacientes } = await supabase
      .from("Pacientes")
      .select("id, estado, fecha_nacimiento, Nombre_Completo")
      .eq("geriatrico_id", geriatrico.id)

    const todos = pacientes || []
    const activosList = todos.filter(p => !p.estado || p.estado === "activo")
    const activoIds = activosList.map(p => p.id)

    const today = new Date().toISOString().split("T")[0]
    const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
    const todayMMDD = today.slice(5)

    const cumpleHoy = activosList.filter(p => p.fecha_nacimiento?.slice(5) === todayMMDD)

    if (activoIds.length === 0) {
      setKpis({
        totalPacientes: todos.length, activos: activosList.length,
        bajas: todos.filter(p => p.estado === "baja").length,
        gastosMes: 0, alertasSignos: 0, medPendientes: 0, cumpleHoy,
      })
      setCargando(false)
      return
    }

    const [
      { data: signosData },
      { data: medHoy },
      { data: pacMeds },
      { data: gastosData },
    ] = await Promise.all([
      supabase.from("registro_signos_vitales")
        .select("presion_maxima,presion_minima,temperatura,pulso,respiracion")
        .gte("fecha", hace7).in("paciente_id", activoIds),
      supabase.from("registro_medicacion_diaria")
        .select("paciente_id,medicamento_id")
        .eq("fecha", today).in("paciente_id", activoIds),
      supabase.from("paciente_medicamentos")
        .select("paciente_id,medicamento_id")
        .in("paciente_id", activoIds),
      supabase.from("gastos")
        .select("monto")
        .eq("geriatrico_id", geriatrico.id)
        .gte("fecha", primerDiaMes),
    ])

    const alertasSignos = (signosData ?? []).filter(s =>
      (s.presion_maxima > 0 && (s.presion_maxima > 140 || s.presion_maxima < 90)) ||
      (s.temperatura > 0 && (s.temperatura > 38 || s.temperatura < 35)) ||
      (s.pulso > 0 && (s.pulso > 100 || s.pulso < 60)) ||
      (s.respiracion > 0 && (s.respiracion > 20 || s.respiracion < 12))
    ).length

    const registrados = new Set((medHoy ?? []).map(r => `${r.paciente_id}-${r.medicamento_id}`))
    const pendientes = new Set()
    for (const pm of pacMeds ?? []) {
      if (!registrados.has(`${pm.paciente_id}-${pm.medicamento_id}`)) pendientes.add(pm.paciente_id)
    }

    const gastosMes = (gastosData ?? []).reduce((acc, g) => acc + Number(g.monto), 0)

    setKpis({
      totalPacientes: todos.length,
      activos: activosList.length,
      bajas: todos.filter(p => p.estado === "baja").length,
      gastosMes, alertasSignos, medPendientes: pendientes.size, cumpleHoy,
    })
    setCargando(false)
  }

  const hora = new Date().getHours()
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches"
  const mes = new Date().toLocaleString("es-AR", { month: "long", year: "numeric" })
  const ocupacion = geriatrico?.capacidad
    ? Math.round((kpis.activos / geriatrico.capacidad) * 100)
    : null

  if (cargando) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="60vh">
        <Spinner size="xl" color="teal.500" />
      </Box>
    )
  }

  return (
    <Box px={6} py={6}>
      <Toaster />

      {/* Header */}
      <Box mb={8}>
        <Heading size="xl" color="text.main" fontWeight="800">
          {saludo}, {geriatrico?.nombre_director?.split(" ")[0] || "Director"} 👋
        </Heading>
        <Text color="text.muted" mt={1} fontSize="sm">
          {geriatrico?.nombre} · Resumen del día
        </Text>
      </Box>

      {/* KPIs principales */}
      <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={4} mb={6}>
        <KpiCard
          valor={ocupacion !== null ? `${ocupacion}%` : kpis.activos}
          label={ocupacion !== null ? "Ocupación" : "Pacientes activos"}
          color={ocupacion !== null && ocupacion >= 90 ? "red.500" : "teal.600"}
          sub={ocupacion !== null ? `${kpis.activos} de ${geriatrico.capacidad} camas` : `${kpis.activos} activos`}
          icono="🏥"
          onClick={() => navigate("/pacientes")}
        />
        <KpiCard
          valor={kpis.alertasSignos}
          label="Alertas signos vitales"
          color={kpis.alertasSignos > 0 ? "red.500" : "green.600"}
          sub="Últimos 7 días"
          icono="🩺"
          onClick={() => navigate("/pacientes")}
        />
        <KpiCard
          valor={kpis.medPendientes}
          label="Sin medicación hoy"
          color={kpis.medPendientes > 0 ? "orange.500" : "green.600"}
          sub="Pacientes con meds asignadas"
          icono="💊"
          onClick={() => navigate("/pacientes")}
        />
        <KpiCard
          valor={formatPesos(kpis.gastosMes)}
          label="Gastos del mes"
          color="teal.600"
          sub={mes}
          icono="💰"
          onClick={() => navigate("/gastos")}
        />
      </Grid>

      {/* Fila inferior: stats + cumpleaños + acciones rápidas */}
      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap={4}>

        {/* Resumen de pacientes */}
        <Card.Root borderRadius="xl" boxShadow="sm" bg="bg.panel">
          <Card.Body py={5} px={6}>
            <Text fontWeight="700" fontSize="sm" color="text.main" mb={4}>Pacientes</Text>
            <Stack gap={3}>
              <HStack justify="space-between">
                <Text fontSize="sm" color="text.muted">Total</Text>
                <Text fontSize="sm" fontWeight="700" color="text.main">{kpis.totalPacientes}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="sm" color="text.muted">Activos</Text>
                <Text fontSize="sm" fontWeight="700" color="green.600">{kpis.activos}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="sm" color="text.muted">Bajas</Text>
                <Text fontSize="sm" fontWeight="700" color="red.500">{kpis.bajas}</Text>
              </HStack>
            </Stack>
            <Button
              mt={4} size="sm" variant="outline" colorPalette="teal" w="full"
              onClick={() => navigate("/pacientes")}
            >
              Ver todos los pacientes →
            </Button>
          </Card.Body>
        </Card.Root>

        {/* Cumpleaños */}
        <Card.Root borderRadius="xl" boxShadow="sm" bg="bg.panel">
          <Card.Body py={5} px={6}>
            <Text fontWeight="700" fontSize="sm" color="text.main" mb={4}>Cumpleaños hoy 🎂</Text>
            {kpis.cumpleHoy.length === 0 ? (
              <Text fontSize="sm" color="text.faint">No hay cumpleaños hoy</Text>
            ) : (
              <Stack gap={2}>
                {kpis.cumpleHoy.map(p => (
                  <Text key={p.id} fontSize="sm" color="text.main" fontWeight="500">🎂 {p.Nombre_Completo || "Paciente"}</Text>
                ))}
              </Stack>
            )}
          </Card.Body>
        </Card.Root>

        {/* Acciones rápidas */}
        <Card.Root borderRadius="xl" boxShadow="sm" bg="bg.panel">
          <Card.Body py={5} px={6}>
            <Text fontWeight="700" fontSize="sm" color="text.main" mb={4}>Acciones rápidas</Text>
            <Stack gap={2}>
              <Button size="sm" colorPalette="teal" onClick={() => navigate("/pacientes")}>
                Ver pacientes
              </Button>
              <Button size="sm" variant="outline" colorPalette="teal" onClick={() => navigate("/amparos")}>
                Generar amparo
              </Button>
              <Button size="sm" variant="outline" colorPalette="teal" onClick={() => navigate("/gastos")}>
                Registrar gasto
              </Button>
            </Stack>
          </Card.Body>
        </Card.Root>

      </Grid>
    </Box>
  )
}
