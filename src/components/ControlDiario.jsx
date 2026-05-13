import { useState, useEffect } from "react"
import { supabase } from "../services/supabase"
import {
  Box, Button, Grid, Heading, HStack, Input, Stack, Text,
  DialogBackdrop, DialogBody, DialogCloseTrigger, DialogContent,
  DialogFooter, DialogHeader, DialogPositioner, DialogRoot, DialogTitle,
} from "@chakra-ui/react"
import { toaster } from "./toaster"

const MEALS = [
  { key: "desayuno", label: "D", full: "Desayuno" },
  { key: "almuerzo", label: "A", full: "Almuerzo" },
  { key: "merienda", label: "M", full: "Merienda" },
  { key: "cena",     label: "C", full: "Cena" },
]

const VITALS = [
  { key: "presion_maxima", label: "Presión Máx.",  step: "1",   placeholder: "ej: 120", min: 40,  max: 300 },
  { key: "presion_minima", label: "Presión Mín.",  step: "1",   placeholder: "ej: 80",  min: 20,  max: 200 },
  { key: "pulso",          label: "Pulso",         step: "1",   placeholder: "ej: 72",  min: 20,  max: 300 },
  { key: "temperatura",    label: "Temperatura",   step: "0.1", placeholder: "ej: 36.5",min: 30,  max: 45  },
  { key: "respiracion",    label: "Respiración",   step: "1",   placeholder: "ej: 16",  min: 4,   max: 60  },
]

const ROW_H  = "34px"
const SEC_H  = "26px"
const COL_W  = "52px"
const LABEL_W = "190px"

function fechaStr(year, month, dia) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

export default function ControlDiario({ pacienteId, pacienteNombre }) {
  const today     = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const [medicamentos, setMedicamentos] = useState([])
  const [registroMed, setRegistroMed]   = useState({})   // "fecha-medId" → row
  const [registroSig, setRegistroSig]   = useState({})   // "fecha" → row

  const [diaOpen, setDiaOpen]   = useState(null)
  const [formDia, setFormDia]   = useState({})
  const [guardando, setGuardando] = useState(false)

  const diasEnMes = new Date(year, month + 1, 0).getDate()
  const dias      = Array.from({ length: diasEnMes }, (_, i) => i + 1)
  const todayStr  = today.toISOString().split("T")[0]

  useEffect(() => {
    const primer  = fechaStr(year, month, 1)
    const ultimo  = fechaStr(year, month, diasEnMes)

    supabase
      .from("paciente_medicamentos")
      .select("id, medicamento:medicamento_id(id, nombre)")
      .eq("paciente_id", pacienteId)
      .then(({ data }) => setMedicamentos(data || []))

    supabase
      .from("registro_medicacion_diaria")
      .select("*")
      .eq("paciente_id", pacienteId)
      .gte("fecha", primer)
      .lte("fecha", ultimo)
      .then(({ data }) => {
        const m = {}
        for (const r of (data || [])) m[`${r.fecha}-${r.medicamento_id}`] = r
        setRegistroMed(m)
      })

    supabase
      .from("registro_signos_vitales")
      .select("*")
      .eq("paciente_id", pacienteId)
      .gte("fecha", primer)
      .lte("fecha", ultimo)
      .then(({ data }) => {
        const s = {}
        for (const r of (data || [])) s[r.fecha] = r
        setRegistroSig(s)
      })
  }, [pacienteId, year, month, diasEnMes])

  const abrirDia = (dia) => {
    const fecha = fechaStr(year, month, dia)
    const sig   = registroSig[fecha] || {}
    const meds  = {}
    for (const m of medicamentos) {
      const r = registroMed[`${fecha}-${m.medicamento.id}`]
      meds[m.medicamento.id] = {
        desayuno: r?.desayuno || false,
        almuerzo: r?.almuerzo || false,
        merienda: r?.merienda || false,
        cena:     r?.cena     || false,
      }
    }
    setFormDia({
      fecha, dia,
      signos: {
        presion_maxima: sig.presion_maxima || "",
        presion_minima: sig.presion_minima || "",
        pulso:          sig.pulso          || "",
        temperatura:    sig.temperatura    || "",
        respiracion:    sig.respiracion    || "",
      },
      meds,
    })
    setDiaOpen(dia)
  }

  const toggleComida = (medId, comida) =>
    setFormDia(p => ({
      ...p,
      meds: { ...p.meds, [medId]: { ...p.meds[medId], [comida]: !p.meds[medId][comida] } },
    }))

  const setSigno = (key, val) =>
    setFormDia(p => ({ ...p, signos: { ...p.signos, [key]: val } }))

  const guardar = async () => {
    setGuardando(true)
    const { fecha } = formDia

    const signosPayload = Object.fromEntries(
      Object.entries(formDia.signos).map(([k, v]) => [k, v === "" ? null : Number(v)])
    )
    const { error: errSig } = await supabase
      .from("registro_signos_vitales")
      .upsert({ paciente_id: pacienteId, fecha, ...signosPayload }, { onConflict: "paciente_id,fecha" })

    if (errSig) {
      toaster.create({ title: "Error al guardar signos", description: errSig.message, type: "error", duration: 4000 })
      setGuardando(false)
      return
    }

    for (const m of medicamentos) {
      await supabase
        .from("registro_medicacion_diaria")
        .upsert({
          paciente_id:    pacienteId,
          medicamento_id: m.medicamento.id,
          fecha,
          ...formDia.meds[m.medicamento.id],
        }, { onConflict: "paciente_id,medicamento_id,fecha" })
    }

    toaster.create({ title: "Registro guardado", type: "success", duration: 2000 })
    setDiaOpen(null)

    // Refresh
    const primer = fechaStr(year, month, 1)
    const ultimo = fechaStr(year, month, diasEnMes)
    supabase.from("registro_medicacion_diaria").select("*").eq("paciente_id", pacienteId).gte("fecha", primer).lte("fecha", ultimo)
      .then(({ data }) => { const m = {}; for (const r of (data || [])) m[`${r.fecha}-${r.medicamento_id}`] = r; setRegistroMed(m) })
    supabase.from("registro_signos_vitales").select("*").eq("paciente_id", pacienteId).gte("fecha", primer).lte("fecha", ultimo)
      .then(({ data }) => { const s = {}; for (const r of (data || [])) s[r.fecha] = r; setRegistroSig(s) })

    setGuardando(false)
  }

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0);  setYear(y => y + 1) } else setMonth(m => m + 1) }

  const nombreMes = new Date(year, month).toLocaleDateString("es-AR", { month: "long", year: "numeric" })

  const thStyle = {
    border: "1px solid #000",
    padding: "2px 1px",
    fontWeight: "700",
    background: "#f0f0f0",
    textAlign: "left",
    fontSize: "7px",
  }

  const tdStyle = {
    border: "1px solid #000",
    padding: "2px 1px",
    fontSize: "7px",
    height: "16px",
  }

  return (
    <Box>
      {/* Header */}
      <HStack mb={4} justify="space-between">
        <Heading size="sm" color="text.main" textTransform="capitalize">{nombreMes}</Heading>
        <HStack gap={2}>
          <Button size="xs" variant="outline" onClick={prevMonth}>‹</Button>
          <Button size="xs" variant="outline" onClick={nextMonth}>›</Button>
          <Button size="xs" colorPalette="teal" variant="outline" onClick={() => window.print()}>
            Imprimir
          </Button>
        </HStack>
      </HStack>

      {/* Grid */}
      <Box id="control-diario-print" overflowX="auto" borderRadius="xl" border="1px solid" borderColor="border.subtle">
        <Box display="flex" minW="max-content">

          {/* ── Left sticky column ── */}
          <Box
            position="sticky"
            left={0}
            zIndex={2}
            w={LABEL_W}
            flexShrink={0}
            borderRight="2px solid"
            borderColor="border.subtle"
            bg="bg.panel"
          >
            {/* Day header spacer */}
            <Box h={ROW_H} borderBottom="1px solid" borderColor="border.subtle" />

            {/* Medicación section */}
            <Box
              h={SEC_H}
              px={3}
              display="flex"
              alignItems="center"
              borderBottom="1px solid"
              borderColor="border.subtle"
              bg="bg.hover"
            >
              <Text fontSize="10px" fontWeight="700" color="teal.600" textTransform="uppercase" letterSpacing="wider">
                Medicación
              </Text>
            </Box>
            {medicamentos.length === 0 ? (
              <Box h={ROW_H} px={3} display="flex" alignItems="center" borderBottom="1px solid" borderColor="border.subtle">
                <Text fontSize="xs" color="text.faint">Sin medicamentos asignados</Text>
              </Box>
            ) : medicamentos.map((m, i) => (
              <Box
                key={m.id}
                h={ROW_H}
                px={3}
                display="flex"
                alignItems="center"
                borderBottom="1px solid"
                borderColor="border.subtle"
                bg={i % 2 === 0 ? "bg.panel" : "bg.muted"}
              >
                <Text fontSize="xs" fontWeight="500" color="text.main" noOfLines={1} title={m.medicamento.nombre}>
                  {m.medicamento.nombre}
                </Text>
              </Box>
            ))}

            {/* Signos vitales section */}
            <Box
              h={SEC_H}
              px={3}
              display="flex"
              alignItems="center"
              borderBottom="1px solid"
              borderColor="border.subtle"
              bg="bg.muted"
            >
              <Text fontSize="10px" fontWeight="700" color="green.600" textTransform="uppercase" letterSpacing="wider">
                Signos Vitales
              </Text>
            </Box>
            {VITALS.map((v, i) => (
              <Box
                key={v.key}
                h={ROW_H}
                px={3}
                display="flex"
                alignItems="center"
                borderBottom={i < VITALS.length - 1 ? "1px solid" : "none"}
                borderColor="border.subtle"
                bg={i % 2 === 0 ? "bg.panel" : "bg.muted"}
              >
                <Text fontSize="xs" color="text.muted">{v.label}</Text>
              </Box>
            ))}
          </Box>

          {/* ── Day columns ── */}
          {dias.map(dia => {
            const fecha   = fechaStr(year, month, dia)
            const eHoy    = fecha === todayStr
            const signo   = registroSig[fecha]
            const tieneAlgo = !!signo || medicamentos.some(m => {
              const r = registroMed[`${fecha}-${m.medicamento.id}`]
              return r && (r.desayuno || r.almuerzo || r.merienda || r.cena)
            })

            return (
              <Box
                key={dia}
                w={COL_W}
                flexShrink={0}
                borderRight="1px solid"
                borderColor="border.subtle"
                cursor="pointer"
                onClick={() => abrirDia(dia)}
                _hover={{ bg: "bg.hover" }}
                transition="background 0.1s"
              >
                {/* Day number */}
                <Box
                  h={ROW_H}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  borderBottom="1px solid"
                  borderColor="border.subtle"
                  bg={eHoy ? "teal.600" : tieneAlgo ? "bg.hover" : "bg.muted"}
                >
                  <Text
                    fontSize="xs"
                    fontWeight="700"
                    color={eHoy ? "white" : "text.main"}
                  >
                    {dia}
                  </Text>
                </Box>

                {/* Medicación section header spacer */}
                <Box h={SEC_H} borderBottom="1px solid" borderColor="border.subtle" bg="bg.hover" />

                {/* Medication rows */}
                {medicamentos.length === 0 ? (
                  <Box h={ROW_H} borderBottom="1px solid" borderColor="border.subtle" />
                ) : medicamentos.map((m, i) => {
                  const r = registroMed[`${fecha}-${m.medicamento.id}`]
                  return (
                    <Box
                      key={m.id}
                      h={ROW_H}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      gap="2px"
                      borderBottom="1px solid"
                      borderColor="border.subtle"
                      bg={i % 2 === 0 ? "white" : "gray.50"}
                    >
                      {MEALS.map(meal => (
                        <Box
                          key={meal.key}
                          w="9px"
                          h="9px"
                          borderRadius="2px"
                          bg={r?.[meal.key] ? "teal.500" : "gray.200"}
                          title={meal.full}
                          flexShrink={0}
                        />
                      ))}
                    </Box>
                  )
                })}

                {/* Signos vitales section header spacer */}
                <Box h={SEC_H} borderBottom="1px solid" borderColor="border.subtle" bg="green.50" />

                {/* Vital sign rows */}
                {VITALS.map((v, i) => (
                  <Box
                    key={v.key}
                    h={ROW_H}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    borderBottom={i < VITALS.length - 1 ? "1px solid" : "none"}
                    borderColor="border.subtle"
                    bg={i % 2 === 0 ? "white" : "gray.50"}
                  >
                    <Text fontSize="10px" fontWeight="500" color={signo?.[v.key] ? "text.main" : "gray.300"}>
                      {signo?.[v.key] || "·"}
                    </Text>
                  </Box>
                ))}
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* Legend (solo pantalla) */}
      <HStack className="no-print" mt={3} gap={4} flexWrap="wrap">
        {MEALS.map(m => (
          <HStack key={m.key} gap={1}>
            <Box w="9px" h="9px" borderRadius="2px" bg="teal.500" flexShrink={0} />
            <Text fontSize="xs" color="text.faint">{m.label} = {m.full}</Text>
          </HStack>
        ))}
        <HStack gap={1}>
          <Box w="12px" h="12px" borderRadius="sm" bg="green.100" border="1px solid" borderColor="green.300" />
          <Text fontSize="xs" color="text.faint">Día con registro</Text>
        </HStack>
      </HStack>

      {/* ── Tabla para imprimir (oculta en pantalla) ── */}
      <div id="tabla-print" style={{ display: "none" }}>
        {[dias.slice(0, 16), dias.slice(16)].map((pageDias, pi) => (
          pageDias.length === 0 ? null : (
            <div key={pi} style={{ pageBreakAfter: pi === 0 ? "always" : "avoid" }}>
              {/* Encabezado */}
              <div style={{ marginBottom: "5px" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", textAlign: "center", letterSpacing: "0.5px", borderBottom: "1px solid #000", paddingBottom: "3px" }}>
                  Administración de Medicación y Control de Signos Vitales
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", marginTop: "3px" }}>
                  <span>{pacienteNombre ? `Paciente: ${pacienteNombre}` : ""}</span>
                  <span style={{ textTransform: "capitalize" }}>MES: {nombreMes}</span>
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: "7.5px" }}>
                <colgroup>
                  <col style={{ width: "115px" }} />
                  {pageDias.map(d => <col key={d} />)}
                </colgroup>

                <thead>
                  <tr>
                    <th style={thStyle}>MEDICACIÓN</th>
                    {pageDias.map(d => (
                      <th key={d} style={{ ...thStyle, textAlign: "center" }}>{d}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {/* Filas de medicamentos */}
                  {medicamentos.length === 0 ? (
                    [1, 2, 3, 4].map(i => (
                      <tr key={i}><td style={{ ...tdStyle, height: "16px" }} colSpan={pageDias.length + 1} /></tr>
                    ))
                  ) : medicamentos.map(m => (
                    <tr key={m.id}>
                      <td style={{ ...tdStyle, paddingLeft: "3px", fontWeight: "600" }}>{m.medicamento.nombre}</td>
                      {pageDias.map(d => {
                        const fecha = fechaStr(year, month, d)
                        const r = registroMed[`${fecha}-${m.medicamento.id}`]
                        const hasAny = r && (r.desayuno || r.almuerzo || r.merienda || r.cena)
                        return (
                          <td key={d} style={{ ...tdStyle, textAlign: "center" }}>
                            {hasAny ? "■" : ""}
                          </td>
                        )
                      })}
                    </tr>
                  ))}

                  {/* Filas D/A/M/C */}
                  {MEALS.map(meal => (
                    <tr key={meal.key}>
                      <td style={{ ...tdStyle, paddingLeft: "3px", fontWeight: "600" }}>
                        {meal.full.toUpperCase()}
                      </td>
                      {pageDias.map(d => {
                        const fecha = fechaStr(year, month, d)
                        const given = medicamentos.some(m => registroMed[`${fecha}-${m.medicamento.id}`]?.[meal.key])
                        return (
                          <td key={d} style={{ ...tdStyle, textAlign: "center" }}>
                            {given ? "■" : ""}
                          </td>
                        )
                      })}
                    </tr>
                  ))}

                  {/* Signos vitales — cabecera */}
                  <tr>
                    <td colSpan={pageDias.length + 1} style={{
                      border: "1px solid #000",
                      background: "#000",
                      color: "#fff",
                      fontWeight: "700",
                      padding: "2px 3px",
                      fontSize: "7px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}>
                      SIGNOS VITALES
                    </td>
                  </tr>

                  {/* Filas de signos vitales */}
                  {VITALS.map(v => (
                    <tr key={v.key}>
                      <td style={{ ...tdStyle, paddingLeft: "3px", fontWeight: "600" }}>
                        {v.label.toUpperCase()}
                      </td>
                      {pageDias.map(d => {
                        const fecha = fechaStr(year, month, d)
                        const val = registroSig[fecha]?.[v.key]
                        return (
                          <td key={d} style={{ ...tdStyle, textAlign: "center" }}>{val || ""}</td>
                        )
                      })}
                    </tr>
                  ))}

                  {/* Firma y sello */}
                  <tr>
                    <td colSpan={pageDias.length + 1} style={{
                      border: "1px solid #000",
                      padding: "22px 3px 3px",
                      fontSize: "7.5px",
                      fontWeight: "700",
                    }}>
                      FIRMA Y SELLO
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        ))}
      </div>

      {/* CSS de impresión */}
      <style>{`
        @page { size: A4 landscape; margin: 8mm; }
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #tabla-print { display: block !important; visibility: visible; position: fixed; top: 0; left: 0; width: 100%; }
          #tabla-print * { visibility: visible; }
        }
      `}</style>

      {/* ── Modal por día ── */}
      <DialogRoot
        open={diaOpen !== null}
        onOpenChange={e => { if (!e.open) setDiaOpen(null) }}
        size="lg"
      >
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent borderRadius="xl">
            <DialogHeader>
              <DialogTitle>
                {diaOpen && new Date(year, month, diaOpen).toLocaleDateString("es-AR", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric"
                })}
              </DialogTitle>
            </DialogHeader>
            <DialogCloseTrigger />
            <DialogBody>
              <Stack gap={5}>
                {/* Medicación */}
                {medicamentos.length > 0 && (
                  <Box>
                    <Text fontWeight="600" fontSize="sm" color="teal.600" mb={3}>Medicación</Text>
                    <Stack gap={3}>
                      {medicamentos.map(m => (
                        <Box key={m.id} p={3} border="1px solid" borderColor="border.subtle" borderRadius="lg">
                          <Text fontSize="sm" fontWeight="600" mb={2}>{m.medicamento.nombre}</Text>
                          <HStack gap={2} flexWrap="wrap">
                            {MEALS.map(meal => {
                              const checked = formDia.meds?.[m.medicamento.id]?.[meal.key] || false
                              return (
                                <Box
                                  key={meal.key}
                                  px={3}
                                  py={1.5}
                                  borderRadius="md"
                                  border="1px solid"
                                  borderColor={checked ? "teal.500" : "border.subtle"}
                                  bg={checked ? "teal.500" : "bg.muted"}
                                  color={checked ? "white" : "text.muted"}
                                  fontSize="sm"
                                  fontWeight="500"
                                  cursor="pointer"
                                  userSelect="none"
                                  onClick={() => toggleComida(m.medicamento.id, meal.key)}
                                  transition="all 0.15s"
                                >
                                  {checked ? "✓" : "○"} {meal.full}
                                </Box>
                              )
                            })}
                          </HStack>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Signos vitales */}
                <Box>
                  <Text fontWeight="600" fontSize="sm" color="green.600" mb={3}>Signos Vitales</Text>
                  <Grid templateColumns="1fr 1fr" gap={3}>
                    {VITALS.map(v => (
                      <Box key={v.key}>
                        <Text fontSize="xs" color="text.faint" mb={1}>{v.label}</Text>
                        <Input
                          type="number"
                          step={v.step}
                          min={v.min}
                          max={v.max}
                          size="sm"
                          value={formDia.signos?.[v.key] || ""}
                          onChange={e => setSigno(v.key, e.target.value)}
                          placeholder={v.placeholder}
                        />
                      </Box>
                    ))}
                  </Grid>
                </Box>
              </Stack>
            </DialogBody>
            <DialogFooter gap={2}>
              <Button variant="ghost" onClick={() => setDiaOpen(null)}>Cancelar</Button>
              <Button colorPalette="teal" onClick={guardar} loading={guardando}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>
    </Box>
  )
}
