import { useState, useEffect } from "react"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"
import {
  Box, Button, Card, CheckboxControl, CheckboxHiddenInput, CheckboxLabel, CheckboxRoot,
  FieldLabel, FieldRoot, Grid, Heading, HStack, Input, NativeSelect, Spinner, Stack, Text,
} from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import { TIPOS_AMPARO, validarCamposAmparo } from "../utils/constants"
import { generarAmparo } from "../utils/generarAmparo"

const PDF_OPTS = {
  margin: 15,
  image: { type: "jpeg", quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true },
  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  pagebreak: {
    mode: ["css", "legacy"],
    avoid: [
      ".texto", ".texto-ind", ".aviso", ".firmas", "tr", ".grilla > div", ".grilla-3 > div",
      ".campo-linea", ".texto-deuda", ".tabla-total", ".firma-deuda",
    ],
  },
}

const tipoLabel = (key) => TIPOS_AMPARO.find(t => t.key === key)?.label || key

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

const mesActualISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const sumarMeses = (ym, n) => {
  const [y, m] = ym.split("-").map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const formatearMesItem = (ym) => {
  const [y, m] = ym.split("-").map(Number)
  return `${MESES[m - 1]}/${y}`
}

const formatearMesCorto = (ym) => {
  const [y, m] = ym.split("-").map(Number)
  return `${MESES[m - 1]} ${String(y).slice(2)}`
}

const itemPresupuestoVacio = () => [{ id: crypto.randomUUID(), monto: "" }]

const facturaVacia = () => ({ id: crypto.randomUUID(), factura: "", importeTotal: "", fechaPresentada: "", importeAbonado: "" })

const formatMilesInput = (digitos) => digitos ? new Intl.NumberFormat("es-AR").format(Number(digitos)) : ""

const esTipoFacturas = (tipo) => tipo === "informe_deuda" || tipo === "recibo_pago"

const facturasParaGuardar = (facturas) =>
  facturas
    .filter(f => f.importeTotal || f.importeAbonado)
    .map(({ periodo, factura, importeTotal, fechaPresentada, importeAbonado }) =>
      ({ periodo, factura: factura ? `B-00000${factura}` : "", importeTotal, fechaPresentada, importeAbonado }))

export default function Amparos() {
  const { geriatrico } = useAuth()
  const [amparos, setAmparos] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [cargando, setCargando] = useState(true)

  // Generación
  const [pacienteId, setPacienteId] = useState("")
  const [tipoSeleccionado, setTipoSeleccionado] = useState("")
  const [mesInicioPresupuesto, setMesInicioPresupuesto] = useState(mesActualISO())
  const [itemsPresupuesto, setItemsPresupuesto] = useState(itemPresupuestoVacio())
  const itemsConMes = itemsPresupuesto.map((it, idx) => ({
    ...it,
    mes: formatearMesItem(sumarMeses(mesInicioPresupuesto, idx)),
  }))
  const [mesInicioDeuda, setMesInicioDeuda] = useState(mesActualISO())
  const [facturasDeuda, setFacturasDeuda] = useState(() => [facturaVacia()])
  const facturasConPeriodo = facturasDeuda.map((f, idx) => ({
    ...f,
    periodo: formatearMesCorto(sumarMeses(mesInicioDeuda, idx)),
  }))
  const [incluirFirmaDeuda, setIncluirFirmaDeuda] = useState(true)
  const [editandoId, setEditandoId] = useState(null)
  const [previsualizando, setPrevisualizando] = useState(false)
  const [htmlPreview, setHtmlPreview] = useState("")
  const [guardandoDoc, setGuardandoDoc] = useState(false)

  // Descarga / eliminación
  const [descargandoZip, setDescargandoZip] = useState(null)
  const [eliminando, setEliminando] = useState(null)

  const tiposDisponibles = TIPOS_AMPARO

  const setCampoFactura = (id, campo, val) =>
    setFacturasDeuda(prev => prev.map(f => f.id === id ? { ...f, [campo]: val } : f))
  const agregarFactura = () => setFacturasDeuda(prev => [...prev, facturaVacia()])
  const quitarFactura = (id) => setFacturasDeuda(prev => prev.filter(f => f.id !== id))

  const cancelarEdicion = () => {
    setEditandoId(null)
    setPacienteId("")
    setTipoSeleccionado("")
    setMesInicioPresupuesto(mesActualISO())
    setItemsPresupuesto(itemPresupuestoVacio())
    setMesInicioDeuda(mesActualISO())
    setFacturasDeuda([facturaVacia()])
    setIncluirFirmaDeuda(true)
  }

  const iniciarEdicion = (amparo) => {
    const tipo = amparo.tipo
    setEditandoId(amparo.id)
    setPacienteId(String(amparo.paciente_id))
    setTipoSeleccionado(tipo)
    setHtmlPreview("")

    if (tipo === "presupuesto") {
      const items = (amparo.observaciones || "")
        .split("<br>")
        .filter(Boolean)
        .map(linea => {
          const [mesRaw, montoRaw] = linea.split(": $")
          return { mes: (mesRaw || "").replace(/-/g, "/"), monto: montoRaw || "" }
        })
      if (items.length > 0) {
        const [nombreMes, anio] = items[0].mes.split("/")
        const idxMes = MESES.indexOf(nombreMes)
        if (idxMes >= 0 && anio) setMesInicioPresupuesto(`${anio}-${String(idxMes + 1).padStart(2, "0")}`)
        setItemsPresupuesto(items.map(i => ({ id: crypto.randomUUID(), monto: i.monto })))
      } else {
        setItemsPresupuesto(itemPresupuestoVacio())
      }
    }

    if (esTipoFacturas(tipo)) {
      try {
        const r = JSON.parse(amparo.observaciones || "{}")
        const facturas = r.facturas || []
        if (facturas.length > 0) {
          const [nombreMes, anio] = (facturas[0].periodo || "").split(" ")
          const idxMes = MESES.indexOf(nombreMes)
          if (idxMes >= 0 && anio) setMesInicioDeuda(`20${anio}-${String(idxMes + 1).padStart(2, "0")}`)
          setFacturasDeuda(facturas.map(f => ({
            id: crypto.randomUUID(),
            factura: (f.factura || "").replace(/^B-00000/, ""),
            importeTotal: f.importeTotal || "",
            fechaPresentada: f.fechaPresentada || "",
            importeAbonado: f.importeAbonado || "",
          })))
        } else {
          setFacturasDeuda([facturaVacia()])
        }
        setIncluirFirmaDeuda(r.incluirFirma !== false)
      } catch {
        setFacturasDeuda([facturaVacia()])
      }
    }
  }

  const fetchAmparos = async () => {
    const { data } = await supabase
      .from("amparos")
      .select("*, Pacientes(id, Nombre_Completo, dni, Obra_social, fecha_nacimiento, diagnostico, motivo_ingreso, antecedentes, numero_afiliado, paciente_medicamentos(dosis, frecuencia, via, medicamento:medicamento_id(nombre)))")
      .eq("geriatrico_id", geriatrico?.id)
      .order("created_at", { ascending: false })
    setAmparos(data || [])
    setCargando(false)
  }

  const fetchPacientes = async () => {
    const { data } = await supabase
      .from("Pacientes")
      .select("id, Nombre_Completo, dni, Obra_social, fecha_nacimiento, diagnostico, motivo_ingreso, antecedentes, numero_afiliado, paciente_medicamentos(dosis, frecuencia, via, medicamento:medicamento_id(nombre))")
      .eq("geriatrico_id", geriatrico?.id)
      .order("Nombre_Completo")
    setPacientes(data || [])
  }

  useEffect(() => {
    if (geriatrico?.id) { fetchAmparos(); fetchPacientes() }
  }, [geriatrico?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Previsualizar ─────────────────────────────────────────────────────────

  const previsualizar = async () => {
    const paciente = pacientes.find(p => p.id === Number(pacienteId))
    if (!paciente) {
      toaster.create({ title: "Seleccioná un paciente", type: "warning", duration: 3000 })
      return
    }
    if (!tipoSeleccionado) {
      toaster.create({ title: "Seleccioná un tipo de documento", type: "warning", duration: 3000 })
      return
    }
    if (tipoSeleccionado === "presupuesto" && !/^\d{4}-\d{2}$/.test(mesInicioPresupuesto)) {
      toaster.create({ title: "Seleccioná el mes de inicio del presupuesto", type: "warning", duration: 3000 })
      return
    }
    if (esTipoFacturas(tipoSeleccionado) && !/^\d{4}-\d{2}$/.test(mesInicioDeuda)) {
      toaster.create({ title: "Seleccioná el mes de inicio", type: "warning", duration: 3000 })
      return
    }
    const faltantes = validarCamposAmparo(paciente)
    if (faltantes.length > 0) {
      toaster.create({ title: "Faltan datos del paciente", description: `Completá: ${faltantes.join(", ")}`, type: "warning", duration: 6000 })
      return
    }
    const yaExiste = !editandoId && amparos.some(a => a.paciente_id === paciente.id && a.tipo === tipoSeleccionado)
    if (yaExiste) {
      toaster.create({ title: "Ya existe este documento", description: "Eliminalo desde el historial para poder regenerarlo.", type: "warning", duration: 5000 })
      return
    }
    setPrevisualizando(true)
    try {
      const extras = tipoSeleccionado === "presupuesto"
        ? { item_presupuesto: itemsConMes.filter(i => i.monto).map(i => `${i.mes.replace(/\//g, "-")}: $${i.monto}`).join("<br>") }
        : esTipoFacturas(tipoSeleccionado)
        ? { facturas: facturasParaGuardar(facturasConPeriodo), incluirFirma: incluirFirmaDeuda }
        : {}
      const html = await generarAmparo(tipoSeleccionado, paciente, geriatrico, extras)
      setHtmlPreview(html)
    } catch (err) {
      toaster.create({ title: "Error al previsualizar", description: err.message, type: "error", duration: 5000 })
    }
    setPrevisualizando(false)
  }

  // ── Guardar documento ─────────────────────────────────────────────────────

  const guardarDocumento = async () => {
    const paciente = pacientes.find(p => p.id === Number(pacienteId))
    if (!paciente) return
    if (tipoSeleccionado === "presupuesto" && !/^\d{4}-\d{2}$/.test(mesInicioPresupuesto)) {
      toaster.create({ title: "Seleccioná el mes de inicio del presupuesto", type: "warning", duration: 3000 })
      return
    }
    if (esTipoFacturas(tipoSeleccionado) && !/^\d{4}-\d{2}$/.test(mesInicioDeuda)) {
      toaster.create({ title: "Seleccioná el mes de inicio", type: "warning", duration: 3000 })
      return
    }
    setGuardandoDoc(true)
    try {
      const itemsStr = tipoSeleccionado === "presupuesto"
        ? itemsConMes.filter(i => i.monto).map(i => `${i.mes.replace(/\//g, "-")}: $${i.monto}`).join("<br>")
        : esTipoFacturas(tipoSeleccionado)
        ? JSON.stringify({ facturas: facturasParaGuardar(facturasConPeriodo), incluirFirma: incluirFirmaDeuda })
        : null
      const { error } = editandoId
        ? await supabase.from("amparos").update({ observaciones: itemsStr }).eq("id", editandoId)
        : await supabase.from("amparos").insert({
            geriatrico_id: geriatrico.id,
            paciente_id: paciente.id,
            tipo: tipoSeleccionado,
            estado: "amparo_generado",
            observaciones: itemsStr,
          })
      if (error) throw new Error(error.message)
      const fueEdicion = !!editandoId
      setHtmlPreview("")
      setEditandoId(null)
      setMesInicioPresupuesto(mesActualISO())
      setItemsPresupuesto(itemPresupuestoVacio())
      setMesInicioDeuda(mesActualISO())
      setFacturasDeuda([facturaVacia()])
      setIncluirFirmaDeuda(true)
      setPacienteId("")
      setTipoSeleccionado("")
      fetchAmparos()
      toaster.create({ title: fueEdicion ? "Documento actualizado" : "Documento guardado", type: "success", duration: 2000 })
    } catch (err) {
      toaster.create({ title: "Error al guardar", description: err.message, type: "error", duration: 5000 })
    }
    setGuardandoDoc(false)
  }

  // ── Descarga individual ───────────────────────────────────────────────────

  const descargarPDFDirecto = async (amparo) => {
    const paciente = amparo.Pacientes
    const tipo = amparo.tipo || TIPOS_AMPARO[0].key
    const faltantes = validarCamposAmparo(paciente)
    if (faltantes.length > 0) {
      toaster.create({ title: "Faltan datos", description: `Completá: ${faltantes.join(", ")}`, type: "warning", duration: 6000 })
      return
    }
    setDescargandoZip(amparo.id)
    try {
      let extras = {}
      if (tipo === "presupuesto" && amparo.observaciones) extras = { item_presupuesto: amparo.observaciones }
      else if (esTipoFacturas(tipo) && amparo.observaciones) { try { const r = JSON.parse(amparo.observaciones); extras = { facturas: r.facturas || [], incluirFirma: r.incluirFirma } } catch {} }
      const html = await generarAmparo(tipo, paciente, geriatrico, extras)
      const html2pdf = (await import("html2pdf.js")).default
      const container = document.createElement("div")
      container.innerHTML = html
      await html2pdf().set({ ...PDF_OPTS, filename: `${tipoLabel(tipo)} - ${paciente.Nombre_Completo}.pdf` }).from(container).save()
      toaster.create({ title: "PDF descargado", type: "success", duration: 2000 })
    } catch (err) {
      toaster.create({ title: "Error", description: err.message, type: "error", duration: 5000 })
    }
    setDescargandoZip(null)
  }

  // ── ZIP por paciente ──────────────────────────────────────────────────────

  const descargarZipPaciente = async (lista, nombre, key) => {
    setDescargandoZip(key)
    try {
      const html2pdf = (await import("html2pdf.js")).default
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()
      for (const amparo of lista) {
        const paciente = amparo.Pacientes
        if (validarCamposAmparo(paciente).length > 0) continue
        const tipo = amparo.tipo || TIPOS_AMPARO[0].key
        let extras = {}
        if (tipo === "presupuesto" && amparo.observaciones) extras = { item_presupuesto: amparo.observaciones }
        else if (esTipoFacturas(tipo) && amparo.observaciones) { try { const r = JSON.parse(amparo.observaciones); extras = { facturas: r.facturas || [], incluirFirma: r.incluirFirma } } catch {} }
        try {
          const html = await generarAmparo(tipo, paciente, geriatrico, extras)
          const container = document.createElement("div")
          container.innerHTML = html
          const pdf = await html2pdf().set(PDF_OPTS).from(container).toPdf().get("pdf")
          const fecha = new Date(amparo.created_at).toLocaleDateString("es-AR").replace(/\//g, "-")
          zip.file(`${tipoLabel(tipo)} - ${fecha}.pdf`, pdf.output("blob"))
        } catch { continue }
      }
      if (Object.keys(zip.files).length === 0) {
        toaster.create({ title: "No hay documentos válidos para descargar", type: "warning", duration: 3000 })
        setDescargandoZip(null)
        return
      }
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `${nombre}.zip`; a.click()
      URL.revokeObjectURL(url)
      toaster.create({ title: "Carpeta descargada", type: "success", duration: 3000 })
    } catch (err) {
      toaster.create({ title: "Error al generar ZIP", description: err.message, type: "error", duration: 5000 })
    }
    setDescargandoZip(null)
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────

  const eliminarAmparo = async (id) => {
    setEliminando(id)
    const { error } = await supabase.from("amparos").delete().eq("id", id)
    if (error) {
      toaster.create({ title: "Error al eliminar", description: error.message, type: "error", duration: 4000 })
    } else {
      fetchAmparos()
    }
    setEliminando(null)
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const amparosPorPaciente = amparos.reduce((acc, a) => {
    const pid = a.Pacientes?.id
    if (!pid) return acc
    if (!acc[pid]) acc[pid] = { nombre: a.Pacientes?.Nombre_Completo, amparos: [] }
    acc[pid].amparos.push(a)
    return acc
  }, {})

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box px={6} py={6}>
      <Toaster />

      <Heading size="lg" color="text.main" mb={6}>Amparos</Heading>

      {/* Panel generar */}
      {!htmlPreview && (
        <Card.Root borderRadius="xl" boxShadow="md" mb={6} border="1px solid" borderColor="teal.200">
          <Card.Body>
            <HStack justify="space-between" mb={4}>
              <Text fontWeight="600" color="text.main">
                {editandoId ? `Editando: ${tipoLabel(tipoSeleccionado)}` : "Nuevo documento"}
              </Text>
              {editandoId && (
                <Button size="xs" variant="ghost" colorPalette="gray" onClick={cancelarEdicion}>
                  Cancelar edición
                </Button>
              )}
            </HStack>
            <Stack gap={4}>
              <HStack gap={4} flexWrap="wrap" alignItems="flex-end">
                <FieldRoot flex={1} minW="220px">
                  <FieldLabel fontSize="sm">Paciente</FieldLabel>
                  <NativeSelect.Root disabled={!!editandoId}>
                    <NativeSelect.Field value={pacienteId} onChange={e => setPacienteId(e.target.value)} bg="bg.muted">
                      <option value="">Seleccionar paciente...</option>
                      {pacientes.map(p => (
                        <option key={p.id} value={p.id}>{p.Nombre_Completo}</option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </FieldRoot>
                <FieldRoot flex={1} minW="220px">
                  <FieldLabel fontSize="sm">Tipo de documento</FieldLabel>
                  <NativeSelect.Root disabled={!!editandoId}>
                    <NativeSelect.Field value={tipoSeleccionado} onChange={e => setTipoSeleccionado(e.target.value)} bg="bg.muted">
                      <option value="">Seleccionar tipo...</option>
                      {tiposDisponibles.map(t => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </FieldRoot>
              </HStack>

              {esTipoFacturas(tipoSeleccionado) && (
                <Box>
                  <FieldRoot mb={3} maxW="220px">
                    <FieldLabel fontSize="sm">Mes de inicio</FieldLabel>
                    <Input
                      type="month"
                      value={mesInicioDeuda}
                      onChange={e => setMesInicioDeuda(e.target.value)}
                      bg="bg.muted"
                    />
                  </FieldRoot>
                  <Text fontSize="sm" fontWeight="500" mb={2}>Facturas</Text>
                  <Stack gap={2}>
                    {facturasConPeriodo.map((f) => (
                      <Box key={f.id} p={3} border="1px solid" borderColor="border.subtle" borderRadius="md" bg="bg.muted">
                        <Text fontSize="xs" fontWeight="600" color="teal.600" mb={2} textTransform="capitalize">
                          {f.periodo}
                        </Text>
                        <Grid
                          templateColumns={{ base: "1fr", md: tipoSeleccionado === "recibo_pago" ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr" }}
                          gap={2}
                        >
                          <HStack gap={1}>
                            <Text fontSize="sm" color="text.muted" flexShrink={0}>B-00000</Text>
                            <Input
                              size="sm" placeholder="232" bg="bg.panel" inputMode="numeric" maxLength={3}
                              value={f.factura}
                              onChange={e => setCampoFactura(f.id, "factura", e.target.value.replace(/\D/g, "").slice(0, 3))}
                            />
                          </HStack>
                          <Input
                            size="sm" placeholder="$ Importe total" bg="bg.panel" inputMode="numeric"
                            value={f.importeTotal ? `$${formatMilesInput(f.importeTotal)}` : ""}
                            onChange={e => setCampoFactura(f.id, "importeTotal", e.target.value.replace(/\D/g, ""))}
                          />
                          <Input
                            size="sm" type="date" bg="bg.panel"
                            value={f.fechaPresentada}
                            onChange={e => setCampoFactura(f.id, "fechaPresentada", e.target.value)}
                          />
                          {tipoSeleccionado === "recibo_pago" && (
                            <Input
                              size="sm" placeholder="$ Importe abonado" bg="bg.panel" inputMode="numeric"
                              value={f.importeAbonado ? `$${formatMilesInput(f.importeAbonado)}` : ""}
                              onChange={e => setCampoFactura(f.id, "importeAbonado", e.target.value.replace(/\D/g, ""))}
                            />
                          )}
                        </Grid>
                        {facturasConPeriodo.length > 1 && (
                          <Button mt={2} size="xs" variant="ghost" colorPalette="red" onClick={() => quitarFactura(f.id)}>
                            Quitar factura
                          </Button>
                        )}
                      </Box>
                    ))}
                    <Button size="sm" variant="ghost" colorPalette="teal" alignSelf="flex-start" onClick={agregarFactura}>
                      + Agregar factura
                    </Button>
                    <CheckboxRoot
                      mt={2}
                      checked={incluirFirmaDeuda}
                      onCheckedChange={e => setIncluirFirmaDeuda(!!e.checked)}
                    >
                      <CheckboxHiddenInput />
                      <CheckboxControl />
                      <CheckboxLabel fontSize="sm">Incluir firma digital</CheckboxLabel>
                    </CheckboxRoot>
                  </Stack>
                </Box>
              )}

              {tipoSeleccionado === "presupuesto" && (
                <Box>
                  <FieldRoot mb={3} maxW="220px">
                    <FieldLabel fontSize="sm">Mes de inicio</FieldLabel>
                    <Input
                      type="month"
                      value={mesInicioPresupuesto}
                      onChange={e => setMesInicioPresupuesto(e.target.value)}
                      bg="bg.muted"
                    />
                  </FieldRoot>
                  <Text fontSize="sm" fontWeight="500" mb={2}>Ítems del presupuesto</Text>
                  <Stack gap={2}>
                    {itemsConMes.map((item) => (
                      <HStack key={item.id} gap={2}>
                        <Text fontSize="sm" color="text.muted" minW="140px" flexShrink={0}>
                          {item.mes.replace("/", " ")}
                        </Text>
                        <Text color="text.muted" flexShrink={0}>$</Text>
                        <Input
                          value={item.monto}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, "")
                            setItemsPresupuesto(prev => prev.map(it => it.id === item.id ? { ...it, monto: val } : it))
                          }}
                          placeholder="120000"
                          bg="bg.muted"
                          flex={1}
                          inputMode="numeric"
                        />
                        {itemsConMes.length > 1 && (
                          <Button
                            size="sm" variant="ghost" colorPalette="red"
                            onClick={() => setItemsPresupuesto(prev => prev.filter(it => it.id !== item.id))}
                          >
                            ✕
                          </Button>
                        )}
                      </HStack>
                    ))}
                    <Button
                      size="sm" variant="ghost" colorPalette="teal" alignSelf="flex-start"
                      onClick={() => setItemsPresupuesto(prev => [...prev, { id: crypto.randomUUID(), monto: "" }])}
                    >
                      + Agregar ítem
                    </Button>
                  </Stack>
                </Box>
              )}

              <Box>
                <Button colorPalette="teal" onClick={previsualizar} loading={previsualizando}>
                  Previsualizar
                </Button>
              </Box>
            </Stack>
          </Card.Body>
        </Card.Root>
      )}

      {/* Vista previa */}
      {htmlPreview && (
        <Card.Root borderRadius="xl" boxShadow="md" mb={6}>
          <Card.Header>
            <HStack justify="space-between" flexWrap="wrap" gap={3}>
              <Text fontWeight="600" color="text.main">Vista previa — {tipoLabel(tipoSeleccionado)}</Text>
              <HStack gap={3}>
                <Button size="sm" variant="outline" onClick={() => setHtmlPreview("")}>
                  Cancelar
                </Button>
                <Button size="sm" colorPalette="teal" onClick={guardarDocumento} loading={guardandoDoc}>
                  {editandoId ? "Guardar cambios" : "Guardar documento"}
                </Button>
              </HStack>
            </HStack>
          </Card.Header>
          <Card.Body p={0}>
            <Box
              bg="gray.200"
              px={{ base: 2, md: 8 }}
              py={6}
              borderTop="1px solid"
              borderColor="border.subtle"
              style={{ backgroundColor: "#d1d5db" }}
            >
              <Box
                maxW="860px"
                mx="auto"
                boxShadow="0 4px 24px rgba(0,0,0,0.18)"
                borderRadius="sm"
                overflow="hidden"
              >
                <iframe
                  srcDoc={htmlPreview}
                  style={{ width: "100%", height: "720px", border: "none", display: "block", background: "white" }}
                  title="Vista previa del documento"
                />
              </Box>
            </Box>
          </Card.Body>
        </Card.Root>
      )}

      {/* Carpetas por paciente */}
      {cargando ? (
        <Box display="flex" justifyContent="center" py={10}><Spinner size="lg" color="teal.500" /></Box>
      ) : Object.keys(amparosPorPaciente).length === 0 ? (
        <Text color="text.muted" textAlign="center" py={10}>No hay documentos generados aún.</Text>
      ) : (
        <Stack gap={4}>
          {Object.entries(amparosPorPaciente).map(([pid, { nombre, amparos: lista }]) => (
            <Card.Root key={pid} borderRadius="xl" boxShadow="md">
              <Card.Header>
                <HStack justify="space-between" flexWrap="wrap" gap={3}>
                  <Box>
                    <Text fontWeight="700" fontSize="md" color="text.main">{nombre}</Text>
                    <Text fontSize="xs" color="text.muted">{lista.length} documento{lista.length !== 1 ? "s" : ""}</Text>
                  </Box>
                  <Button size="sm" colorPalette="teal" variant="outline" onClick={() => descargarZipPaciente(lista, nombre, pid)} loading={descargandoZip === pid}>
                    Descargar carpeta
                  </Button>
                </HStack>
              </Card.Header>
              <Card.Body pt={0}>
                <Stack gap={1}>
                  {lista.map(a => (
                    <HStack key={a.id} justify="space-between" py={2} px={3} borderRadius="md" _hover={{ bg: "bg.hover" }}>
                      <Text fontSize="xs" color="text.muted" minW="70px">{new Date(a.created_at).toLocaleDateString("es-AR")}</Text>
                      <HStack gap={1}>
                        <Button size="xs" colorPalette="teal" variant="ghost" onClick={() => descargarPDFDirecto(a)} loading={descargandoZip === a.id}>
                          {tipoLabel(a.tipo)}
                        </Button>
                        <Button size="xs" colorPalette="teal" variant="ghost" onClick={() => iniciarEdicion(a)}>
                          ✏
                        </Button>
                        <Button size="xs" colorPalette="red" variant="ghost" onClick={() => eliminarAmparo(a.id)} loading={eliminando === a.id}>
                          ✕
                        </Button>
                      </HStack>
                    </HStack>
                  ))}
                </Stack>
              </Card.Body>
            </Card.Root>
          ))}
        </Stack>
      )}
    </Box>
  )
}
