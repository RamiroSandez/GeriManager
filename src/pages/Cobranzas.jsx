import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"
import {
  Badge, Box, Button, Card, CheckboxControl, CheckboxHiddenInput, CheckboxRoot, FieldLabel, FieldRoot, Grid, Heading,
  HStack, Input, NativeSelect, Spinner, Stack, Table, Text,
} from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import { logError } from "../utils/log"
import { formatFecha, formatPesos, parseMonto, periodoActual, totalesCuenta } from "../utils/cobranzas"
import { exportarPlanilla, leerPlanilla, sugerirPaciente } from "../utils/planillaCobranzas"

// Campos de la cuenta que trae la planilla; los vacíos no pisan lo que ya está cargado
const datosCuentaImportada = (cuenta) =>
  Object.fromEntries(Object.entries(cuenta).filter(([, v]) => v !== null && v !== undefined && v !== ""))

const formNuevoVacio = () => ({
  pacienteId: "",
  primerPeriodo: periodoActual().slice(0, 7),
  importe: "",
  porcentaje: "8",
  cobertura: "",
})

function StatCard({ label, valor, sub, destacado }) {
  return (
    <Card.Root borderRadius="xl" boxShadow="sm" bg={destacado ? "teal.600" : "bg.panel"} color={destacado ? "white" : undefined}>
      <Card.Body py={5} px={5}>
        <Text fontSize="xs" opacity={destacado ? 0.8 : 1} color={destacado ? undefined : "text.faint"} mb={1} fontWeight="500">{label}</Text>
        <Text fontSize="2xl" fontWeight="800" color={destacado ? undefined : "text.main"}>{valor}</Text>
        {sub && <Text fontSize="xs" opacity={0.8} color={destacado ? undefined : "text.faint"} mt={1}>{sub}</Text>}
      </Card.Body>
    </Card.Root>
  )
}

export default function Cobranzas() {
  const { geriatrico } = useAuth()
  const navigate = useNavigate()
  const [cuentas, setCuentas] = useState([])
  const [meses, setMeses] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(formNuevoVacio)
  const [creando, setCreando] = useState(false)
  const [importacion, setImportacion] = useState(null) // hojas leídas del Excel, pendientes de confirmar
  const [leyendoExcel, setLeyendoExcel] = useState(false)
  const [importando, setImportando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const inputExcel = useRef(null)

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const fetchDatos = async () => {
    setCargando(true)
    const [{ data: c, error: errC }, { data: m, error: errM }, { data: p }] = await Promise.all([
      supabase.from("cobranzas_cuentas")
        .select("*, Pacientes(id, Nombre_Completo, estado)")
        .eq("geriatrico_id", geriatrico.id),
      supabase.from("cobranzas_meses")
        .select("paciente_id, importe, importe_cobrado, porcentaje_honorarios, honorarios_abonados_el, fecha_cobro")
        .eq("geriatrico_id", geriatrico.id),
      supabase.from("Pacientes")
        .select("id, Nombre_Completo, estado")
        .eq("geriatrico_id", geriatrico.id)
        .order("Nombre_Completo"),
    ])
    if (errC || errM) {
      toaster.create({ title: "Error al cargar cobranzas", description: (errC || errM).message, type: "error", duration: 5000 })
    }
    setCuentas(c || [])
    setMeses(m || [])
    setPacientes(p || [])
    setCargando(false)
  }

  useEffect(() => {
    if (geriatrico?.id) fetchDatos()
  }, [geriatrico?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Alta de cuenta: crea la configuración y el primer mes ────────────────

  const crearCuenta = async () => {
    const importe = parseMonto(form.importe)
    const porcentaje = Number(form.porcentaje)
    if (!form.pacienteId || !/^\d{4}-\d{2}$/.test(form.primerPeriodo)) {
      toaster.create({ title: "Elegí el paciente y el primer mes", type: "warning", duration: 3000 })
      return
    }
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      toaster.create({ title: "El % de honorarios debe estar entre 0 y 100", type: "warning", duration: 3000 })
      return
    }
    setCreando(true)
    const pacienteId = Number(form.pacienteId)
    const { error } = await supabase.from("cobranzas_cuentas").insert({
      geriatrico_id: geriatrico.id,
      paciente_id: pacienteId,
      cobertura: form.cobertura.trim() || null,
      porcentaje_honorarios: porcentaje,
    })
    const { error: errMes } = error ? {} : await supabase.from("cobranzas_meses").insert({
      geriatrico_id: geriatrico.id,
      paciente_id: pacienteId,
      periodo: `${form.primerPeriodo}-01`,
      importe,
      porcentaje_honorarios: porcentaje,
    })
    setCreando(false)
    if (error || errMes) {
      const err = error || errMes
      logError("cobranzas.crearCuenta", err)
      toaster.create({ title: "No se pudo crear la cuenta", description: err.message, type: "error", duration: 5000 })
      return
    }
    navigate(`/cobranzas/${pacienteId}`)
  }

  // ── Importar planilla Excel (formato actual, una hoja por paciente) ──────

  const abrirExcel = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = "" // permite volver a elegir el mismo archivo
    if (!file) return
    setLeyendoExcel(true)
    try {
      const hojas = (await leerPlanilla(file)).filter(h => h.meses.length > 0)
      if (hojas.length === 0) {
        toaster.create({ title: "No se encontraron meses en el archivo", type: "warning", duration: 4000 })
      } else {
        setImportacion(hojas.map(h => {
          const sugerido = sugerirPaciente(h.hoja, pacientes)
          return { ...h, pacienteId: sugerido ? String(sugerido.id) : "", incluir: !!sugerido }
        }))
      }
    } catch (err) {
      logError("cobranzas.leerPlanilla", err)
      toaster.create({ title: "No se pudo leer el Excel", description: err.message, type: "error", duration: 5000 })
    }
    setLeyendoExcel(false)
  }

  const setHoja = (idx, campo, val) =>
    setImportacion(prev => prev.map((h, i) => (i === idx ? { ...h, [campo]: val } : h)))

  const confirmarImportacion = async () => {
    const elegidas = importacion.filter(h => h.incluir)
    if (elegidas.some(h => !h.pacienteId)) {
      toaster.create({ title: "Asigná un paciente a cada hoja marcada", type: "warning", duration: 3000 })
      return
    }
    if (new Set(elegidas.map(h => h.pacienteId)).size !== elegidas.length) {
      toaster.create({ title: "Hay dos hojas asignadas al mismo paciente", type: "warning", duration: 3000 })
      return
    }
    setImportando(true)
    const errores = []
    for (const h of elegidas) {
      const base = { geriatrico_id: geriatrico.id, paciente_id: Number(h.pacienteId) }
      const { error } = await supabase.from("cobranzas_cuentas")
        .upsert({ ...datosCuentaImportada(h.cuenta), ...base }, { onConflict: "paciente_id" })
      const { error: errMeses } = error ? {} : await supabase.from("cobranzas_meses")
        .upsert(h.meses.map(m => ({ ...m, ...base })), { onConflict: "paciente_id,periodo" })
      if (error || errMeses) {
        logError("cobranzas.importar", error || errMeses)
        errores.push(`${h.hoja}: ${(error || errMeses).message}`)
      }
    }
    setImportando(false)
    if (errores.length) {
      toaster.create({ title: "Algunas hojas no se importaron", description: errores.join(" · "), type: "error", duration: 8000 })
    } else {
      const aRevisar = elegidas.reduce((acc, h) => acc + h.aRevisar, 0)
      toaster.create({
        title: `${elegidas.length} hojas importadas`,
        description: aRevisar ? `${aRevisar} meses quedaron marcados con "⚠ Revisar" en observaciones.` : undefined,
        type: "success", duration: 6000,
      })
      setImportacion(null)
    }
    fetchDatos()
  }

  // ── Exportar todas las cuentas en el mismo formato de planilla ────────────

  const exportarTodo = async () => {
    setExportando(true)
    const { data: todos, error } = await supabase.from("cobranzas_meses").select("*").eq("geriatrico_id", geriatrico.id)
    if (error) {
      toaster.create({ title: "Error al exportar", description: error.message, type: "error", duration: 5000 })
    } else {
      const fecha = new Date().toLocaleDateString("es-AR").replace(/\//g, "-")
      await exportarPlanilla(filas.map(f => f.cuenta), todos || [], `Cobranzas ${geriatrico.nombre || ""} ${fecha}.xlsx`.replace(/\s+/g, " "))
    }
    setExportando(false)
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const filas = cuentas
    .map(c => ({
      cuenta: c,
      nombre: c.Pacientes?.Nombre_Completo || "Paciente",
      activo: !c.Pacientes?.estado || c.Pacientes.estado === "activo",
      t: totalesCuenta(meses.filter(m => m.paciente_id === c.paciente_id), c),
    }))
    .sort((a, b) => (b.activo - a.activo) || b.t.saldo - a.t.saldo)

  const general = filas.reduce((acc, f) => ({
    saldo: acc.saldo + f.t.saldo,
    honorariosPendientes: acc.honorariosPendientes + f.t.honorariosPendientes,
    mesesConSaldo: acc.mesesConSaldo + f.t.mesesConSaldo,
  }), { saldo: 0, honorariosPendientes: 0, mesesConSaldo: 0 })

  const conCuenta = new Set(cuentas.map(c => c.paciente_id))
  const pacientesSinCuenta = pacientes.filter(p => !conCuenta.has(p.id))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box px={6} py={6} maxW="1400px" mx="auto">
      <Toaster />

      <HStack mb={6} justify="space-between" flexWrap="wrap" gap={3}>
        <Box>
          <Heading size="lg" color="text.main">Cobranzas</Heading>
          <Text fontSize="sm" color="text.muted">Facturación mensual a la obra social, cobros y honorarios por paciente</Text>
        </Box>
        <HStack gap={2} flexWrap="wrap">
          <input ref={inputExcel} type="file" accept=".xlsx,.xls" hidden onChange={abrirExcel} />
          <Button variant="outline" colorPalette="teal" size="sm" onClick={() => inputExcel.current?.click()} loading={leyendoExcel}>
            Importar Excel
          </Button>
          <Button variant="outline" colorPalette="teal" size="sm" onClick={exportarTodo} loading={exportando} disabled={filas.length === 0}>
            Exportar Excel
          </Button>
          <Button colorPalette="teal" size="sm" onClick={() => { setForm(formNuevoVacio()); setMostrarForm(v => !v) }}>
            {mostrarForm ? "Cancelar" : "+ Nueva cuenta"}
          </Button>
        </HStack>
      </HStack>

      {/* Confirmación de importación: cada hoja del Excel se asigna a un paciente */}
      {importacion && (
        <Box position="fixed" inset={0} zIndex={200} display="flex" alignItems="center" justifyContent="center">
          <Box position="absolute" inset={0} bg="blackAlpha.600" onClick={() => !importando && setImportacion(null)} />
          <Box
            position="relative" bg="bg.panel" borderRadius="2xl" boxShadow="2xl" p={6} w="full" maxW="720px" mx={4}
            maxH="85vh" overflowY="auto" border="1px solid" borderColor="border.subtle"
          >
            <HStack justify="space-between" mb={1}>
              <Heading size="md" color="text.main">Importar planilla</Heading>
              <Button variant="ghost" size="sm" onClick={() => setImportacion(null)} disabled={importando} color="text.muted">✕</Button>
            </HStack>
            <Text fontSize="sm" color="text.muted" mb={4}>
              Elegí a qué paciente corresponde cada hoja. Si el paciente ya tiene meses cargados, los de la planilla los reemplazan.
              Lo que no se pudo interpretar queda en observaciones con la marca "⚠ Revisar".
            </Text>
            <Stack gap={3}>
              {importacion.map((h, idx) => (
                <Box key={h.hoja} p={3} border="1px solid" borderColor="border.subtle" borderRadius="md" bg="bg.muted">
                  <Grid templateColumns={{ base: "1fr", md: "auto 1fr 1.3fr" }} gap={3} alignItems="center">
                    <CheckboxRoot checked={h.incluir} onCheckedChange={e => setHoja(idx, "incluir", !!e.checked)}>
                      <CheckboxHiddenInput />
                      <CheckboxControl />
                    </CheckboxRoot>
                    <Box>
                      <Text fontWeight="600" fontSize="sm" color="text.main">{h.hoja}</Text>
                      <Text fontSize="xs" color="text.muted">
                        {h.meses.length} meses
                        {h.aRevisar > 0 && <Text as="span" color="orange.500"> · {h.aRevisar} a revisar</Text>}
                      </Text>
                    </Box>
                    <NativeSelect.Root size="sm">
                      <NativeSelect.Field
                        value={h.pacienteId} bg="bg.panel"
                        onChange={e => { setHoja(idx, "pacienteId", e.target.value); if (e.target.value) setHoja(idx, "incluir", true) }}
                      >
                        <option value="">Elegir paciente...</option>
                        {pacientes.map(p => <option key={p.id} value={p.id}>{p.Nombre_Completo}</option>)}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Grid>
                  {h.avisos.length > 0 && (
                    <Text fontSize="xs" color="text.faint" mt={2}>{h.avisos.join(" · ")}</Text>
                  )}
                </Box>
              ))}
            </Stack>
            <Text fontSize="xs" color="text.faint" mt={3}>
              Si un paciente no aparece en la lista, primero hay que darlo de alta en Pacientes.
            </Text>
            <HStack mt={5} justify="flex-end" gap={3}>
              <Button variant="ghost" onClick={() => setImportacion(null)} disabled={importando}>Cancelar</Button>
              <Button colorPalette="teal" onClick={confirmarImportacion} loading={importando} disabled={!importacion.some(h => h.incluir)}>
                Importar {importacion.filter(h => h.incluir).length} hojas
              </Button>
            </HStack>
          </Box>
        </Box>
      )}

      {mostrarForm && (
        <Card.Root borderRadius="xl" boxShadow="md" mb={6} border="1px solid" borderColor="teal.200">
          <Card.Body>
            <Text fontWeight="600" color="text.main" mb={4}>Nueva cuenta de cobranza</Text>
            <Grid templateColumns={{ base: "1fr", md: "2fr 1fr 1fr 1fr" }} gap={4}>
              <FieldRoot>
                <FieldLabel fontSize="sm">Paciente</FieldLabel>
                <NativeSelect.Root>
                  <NativeSelect.Field value={form.pacienteId} onChange={e => set("pacienteId", e.target.value)} bg="bg.muted">
                    <option value="">Seleccionar paciente...</option>
                    {pacientesSinCuenta.map(p => <option key={p.id} value={p.id}>{p.Nombre_Completo}</option>)}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Primer mes facturado</FieldLabel>
                <Input type="month" value={form.primerPeriodo} onChange={e => set("primerPeriodo", e.target.value)} bg="bg.muted" />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">Importe mensual</FieldLabel>
                <Input
                  value={form.importe} placeholder="$ 3.700.000" inputMode="decimal" bg="bg.muted"
                  onChange={e => set("importe", e.target.value)}
                />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel fontSize="sm">% honorarios</FieldLabel>
                <Input
                  value={form.porcentaje} inputMode="decimal" bg="bg.muted"
                  onChange={e => set("porcentaje", e.target.value.replace(/[^\d.]/g, ""))}
                />
              </FieldRoot>
              <FieldRoot gridColumn={{ md: "span 4" }}>
                <FieldLabel fontSize="sm">Cobertura</FieldLabel>
                <Input
                  value={form.cobertura} placeholder="Hogar permanente categoría A con centro de día + 35%" bg="bg.muted"
                  onChange={e => set("cobertura", e.target.value)}
                />
              </FieldRoot>
            </Grid>
            <HStack mt={4} justify="flex-end">
              <Button colorPalette="teal" onClick={crearCuenta} loading={creando}>Crear cuenta</Button>
            </HStack>
          </Card.Body>
        </Card.Root>
      )}

      <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4} mb={6}>
        <StatCard destacado label="Saldo adeudado por obras sociales" valor={formatPesos(general.saldo)} sub={`${general.mesesConSaldo} meses con saldo`} />
        <StatCard label="Honorarios pendientes de pago" valor={formatPesos(general.honorariosPendientes)} />
        <StatCard label="Cuentas" valor={filas.length} sub={`${filas.filter(f => f.activo).length} de pacientes activos`} />
      </Grid>

      <Card.Root boxShadow="md" borderRadius="xl">
        <Card.Body p={0}>
          {cargando ? (
            <Box display="flex" justifyContent="center" py={10}><Spinner size="lg" color="teal.500" /></Box>
          ) : filas.length === 0 ? (
            <Box textAlign="center" py={14}>
              <Text color="text.faint" mb={3}>Todavía no hay cuentas de cobranza.</Text>
              <Button size="sm" colorPalette="teal" onClick={() => setMostrarForm(true)}>+ Crear la primera</Button>
            </Box>
          ) : (
            <Box overflowX="auto">
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row bg="bg.muted">
                    <Table.ColumnHeader fontWeight="600" pl={4}>Paciente</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="600" textAlign="right">Facturado</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="600" textAlign="right">Cobrado</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="600" textAlign="right">Saldo</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="600" textAlign="right">Hon. pendientes</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="600" pr={4}>Último cobro</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {filas.map(({ cuenta, nombre, activo, t }) => (
                    <Table.Row
                      key={cuenta.id} cursor="pointer" _hover={{ bg: "bg.hover" }} opacity={activo ? 1 : 0.6}
                      onClick={() => navigate(`/cobranzas/${cuenta.paciente_id}`)}
                    >
                      <Table.Cell pl={4} fontWeight="500" fontSize="sm">
                        {nombre}
                        {!activo && <Badge ml={2} colorPalette="gray" variant="subtle" fontSize="xs">Baja</Badge>}
                      </Table.Cell>
                      <Table.Cell textAlign="right" fontSize="sm">{formatPesos(t.facturado)}</Table.Cell>
                      <Table.Cell textAlign="right" fontSize="sm">{formatPesos(t.cobrado)}</Table.Cell>
                      <Table.Cell textAlign="right" fontSize="sm" fontWeight="700" color={t.saldo > 0 ? "red.500" : "green.600"}>
                        {formatPesos(t.saldo)}
                        <Text as="span" fontSize="xs" color="text.faint" fontWeight="400"> ({t.mesesConSaldo} meses)</Text>
                      </Table.Cell>
                      <Table.Cell textAlign="right" fontSize="sm" color={t.honorariosPendientes > 0 ? "orange.500" : "text.muted"}>
                        {formatPesos(t.honorariosPendientes)}
                      </Table.Cell>
                      <Table.Cell pr={4} fontSize="sm" color="text.muted">{formatFecha(t.ultimoCobro) || "—"}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          )}
        </Card.Body>
      </Card.Root>
    </Box>
  )
}
