import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"
import {
  Badge, Box, Button, Card, CheckboxControl, CheckboxHiddenInput, CheckboxRoot, FieldLabel, FieldRoot, Grid, Heading,
  HStack, Input, NativeSelect, Spinner, Table, Text,
} from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import { logError } from "../utils/log"
import {
  ESTADOS_MES, LUGARES_PRESENTACION, PAGADORES, estadoMes, formatPeriodo, formatPesos, honorariosMes,
  montoATexto, parseMonto, periodoActual, periodoSiguiente, saldoMes, totalesCuenta,
} from "../utils/cobranzas"
import { exportarPlanilla } from "../utils/planillaCobranzas"

const MARCA_REVISAR = /^⚠ Revisar\s*·?\s*/
const aRevisar = (m) => MARCA_REVISAR.test(m.observaciones || "")

// Input de texto que guarda al salir del campo (como una celda de planilla)
function CampoTexto({ valor, onGuardar, ...props }) {
  const [borrador, setBorrador] = useState(valor ?? "")
  useEffect(() => setBorrador(valor ?? ""), [valor])
  return (
    <Input
      size="xs" bg="bg.panel" {...props}
      value={borrador}
      onChange={e => setBorrador(e.target.value)}
      onBlur={() => { if (borrador !== (valor ?? "")) onGuardar(borrador.trim() || null) }}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }}
    />
  )
}

// Igual que CampoTexto pero para montos en formato argentino
function CampoMonto({ valor, onGuardar, ...props }) {
  const [borrador, setBorrador] = useState(montoATexto(valor))
  useEffect(() => setBorrador(montoATexto(valor)), [valor])
  return (
    <Input
      size="xs" bg="bg.panel" inputMode="decimal" textAlign="right" {...props}
      value={borrador}
      onChange={e => setBorrador(e.target.value)}
      onBlur={() => {
        const nuevo = parseMonto(borrador)
        if (nuevo !== (valor === null || valor === undefined ? null : Number(valor))) onGuardar(nuevo)
        else setBorrador(montoATexto(valor))
      }}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }}
    />
  )
}

function Resumen({ label, valor, color }) {
  return (
    <Card.Root borderRadius="xl" boxShadow="sm" bg="bg.panel">
      <Card.Body py={4} px={5}>
        <Text fontSize="xs" color="text.faint" fontWeight="500">{label}</Text>
        <Text fontSize="xl" fontWeight="800" color={color || "text.main"}>{valor}</Text>
      </Card.Body>
    </Card.Root>
  )
}

const cobroVacio = () => ({ fecha: new Date().toISOString().split("T")[0], monto: "", pagador: "obra_social" })

export default function CuentaCobranza() {
  const { pacienteId } = useParams()
  const { geriatrico } = useAuth()
  const navigate = useNavigate()
  const [cuenta, setCuenta] = useState(null)
  const [config, setConfig] = useState(null) // borrador editable de la configuración de la cuenta
  const [meses, setMeses] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardandoConfig, setGuardandoConfig] = useState(false)
  const [seleccion, setSeleccion] = useState(new Set())
  const [cobro, setCobro] = useState(cobroVacio)
  const [fechaHonorarios, setFechaHonorarios] = useState(() => new Date().toISOString().split("T")[0])
  const [aplicando, setAplicando] = useState(false)
  const [filtro, setFiltro] = useState("todos") // todos | saldo | revisar
  const [confirmarBorrar, setConfirmarBorrar] = useState(null)

  const fetchCuenta = async () => {
    setCargando(true)
    const [{ data: c }, { data: m, error }] = await Promise.all([
      supabase.from("cobranzas_cuentas")
        .select("*, Pacientes(id, Nombre_Completo, estado, Obra_social, numero_afiliado)")
        .eq("geriatrico_id", geriatrico.id).eq("paciente_id", pacienteId).maybeSingle(),
      supabase.from("cobranzas_meses")
        .select("*").eq("geriatrico_id", geriatrico.id).eq("paciente_id", pacienteId).order("periodo"),
    ])
    if (error) toaster.create({ title: "Error al cargar la cuenta", description: error.message, type: "error", duration: 5000 })
    setCuenta(c)
    setConfig(c ? {
      cobertura: c.cobertura || "",
      porcentaje: String(c.porcentaje_honorarios ?? 8),
      honorarioInicial: montoATexto(c.honorario_inicial),
      honorarioInicialAbonado: c.honorario_inicial_abonado_el || "",
      observaciones: c.observaciones || "",
    } : null)
    setMeses(m || [])
    setCargando(false)
  }

  useEffect(() => {
    if (geriatrico?.id) fetchCuenta()
  }, [geriatrico?.id, pacienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Edición de meses (guardado optimista, celda por celda) ───────────────

  const guardarMes = async (id, cambios) => {
    const previo = meses.find(m => m.id === id)
    setMeses(prev => prev.map(m => (m.id === id ? { ...m, ...cambios } : m)))
    const { error } = await supabase.from("cobranzas_meses").update(cambios).eq("id", id)
    if (error) {
      logError("cobranzas.guardarMes", error)
      setMeses(prev => prev.map(m => (m.id === id ? previo : m)))
      toaster.create({ title: "No se guardó el cambio", description: error.message, type: "error", duration: 5000 })
    }
  }

  const agregarMes = async () => {
    const ultimo = meses.at(-1)
    const { data, error } = await supabase.from("cobranzas_meses").insert({
      geriatrico_id: geriatrico.id,
      paciente_id: Number(pacienteId),
      periodo: ultimo ? periodoSiguiente(ultimo.periodo) : periodoActual(),
      importe: ultimo?.importe ?? null,
      lugar_presentacion: ultimo?.lugar_presentacion ?? null,
      porcentaje_honorarios: cuenta.porcentaje_honorarios,
    }).select().single()
    if (error) {
      toaster.create({ title: "No se pudo agregar el mes", description: error.message, type: "error", duration: 5000 })
      return
    }
    setMeses(prev => [...prev, data])
  }

  const borrarMes = async (id) => {
    const { error } = await supabase.from("cobranzas_meses").delete().eq("id", id)
    setConfirmarBorrar(null)
    if (error) {
      toaster.create({ title: "No se pudo borrar", description: error.message, type: "error", duration: 5000 })
      return
    }
    setMeses(prev => prev.filter(m => m.id !== id))
    setSeleccion(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  // ── Acciones sobre varios meses (pagos agrupados) ─────────────────────────

  const aplicarAMeses = async (armarCambios, mensajeOk) => {
    setAplicando(true)
    const elegidos = meses.filter(m => seleccion.has(m.id))
    const resultados = await Promise.all(elegidos.map(m => {
      const cambios = armarCambios(m)
      return supabase.from("cobranzas_meses").update(cambios).eq("id", m.id).then(({ error }) => ({ id: m.id, cambios, error }))
    }))
    const fallidos = resultados.filter(r => r.error)
    setMeses(prev => prev.map(m => {
      const r = resultados.find(x => x.id === m.id && !x.error)
      return r ? { ...m, ...r.cambios } : m
    }))
    setAplicando(false)
    if (fallidos.length) {
      logError("cobranzas.aplicarAMeses", fallidos[0].error)
      toaster.create({ title: `${fallidos.length} meses no se actualizaron`, description: fallidos[0].error.message, type: "error", duration: 5000 })
    } else {
      toaster.create({ title: mensajeOk, type: "success", duration: 2500 })
      setSeleccion(new Set())
    }
  }

  const registrarCobro = () => {
    if (!cobro.fecha) {
      toaster.create({ title: "Indicá la fecha de cobro", type: "warning", duration: 3000 })
      return
    }
    const monto = parseMonto(cobro.monto)
    aplicarAMeses(
      m => ({ fecha_cobro: cobro.fecha, importe_cobrado: monto ?? m.importe, pagador: cobro.pagador }),
      `Cobro registrado en ${seleccion.size} meses`,
    )
    setCobro(cobroVacio())
  }

  const marcarHonorarios = () => {
    if (!fechaHonorarios) return
    aplicarAMeses(() => ({ honorarios_abonados_el: fechaHonorarios }), "Honorarios marcados como abonados")
  }

  // ── Configuración de la cuenta ────────────────────────────────────────────

  const guardarConfig = async () => {
    const porcentaje = Number(config.porcentaje)
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      toaster.create({ title: "El % de honorarios debe estar entre 0 y 100", type: "warning", duration: 3000 })
      return
    }
    setGuardandoConfig(true)
    const cambios = {
      cobertura: config.cobertura.trim() || null,
      porcentaje_honorarios: porcentaje,
      honorario_inicial: parseMonto(config.honorarioInicial),
      honorario_inicial_abonado_el: config.honorarioInicialAbonado || null,
      observaciones: config.observaciones.trim() || null,
    }
    const { error } = await supabase.from("cobranzas_cuentas").update(cambios).eq("id", cuenta.id)
    setGuardandoConfig(false)
    if (error) {
      toaster.create({ title: "No se guardó la configuración", description: error.message, type: "error", duration: 5000 })
      return
    }
    setCuenta(prev => ({ ...prev, ...cambios }))
    toaster.create({ title: "Configuración guardada", type: "success", duration: 2000 })
  }

  const exportar = () =>
    exportarPlanilla([cuenta], meses, `Cobranza ${cuenta.Pacientes?.Nombre_Completo || pacienteId}.xlsx`)

  // ── Render ────────────────────────────────────────────────────────────────

  if (cargando) {
    return <Box display="flex" justifyContent="center" py={20}><Spinner size="xl" color="teal.500" /></Box>
  }

  if (!cuenta) {
    return (
      <Box px={6} py={10} textAlign="center">
        <Text color="text.muted" mb={4}>Este paciente no tiene cuenta de cobranza.</Text>
        <Button colorPalette="teal" size="sm" onClick={() => navigate("/cobranzas")}>Volver a Cobranzas</Button>
      </Box>
    )
  }

  const t = totalesCuenta(meses, cuenta)
  const visibles = meses.filter(m => filtro === "todos" || (filtro === "saldo" ? saldoMes(m) > 0 : aRevisar(m)))
  const cantRevisar = meses.filter(aRevisar).length
  const todosSeleccionados = visibles.length > 0 && visibles.every(m => seleccion.has(m.id))
  const toggleSeleccion = (id, marcado) =>
    setSeleccion(prev => { const s = new Set(prev); marcado ? s.add(id) : s.delete(id); return s })

  return (
    <Box px={6} py={6} maxW="1600px" mx="auto">
      <Toaster />

      <HStack mb={5} justify="space-between" flexWrap="wrap" gap={3}>
        <Box>
          <Text fontSize="sm" color="teal.600" cursor="pointer" onClick={() => navigate("/cobranzas")} mb={1}>← Cobranzas</Text>
          <Heading size="lg" color="text.main">{cuenta.Pacientes?.Nombre_Completo}</Heading>
          <Text fontSize="sm" color="text.muted">
            {[cuenta.Pacientes?.Obra_social, cuenta.Pacientes?.numero_afiliado && `Afiliado ${cuenta.Pacientes.numero_afiliado}`].filter(Boolean).join(" · ")}
          </Text>
        </Box>
        <Button size="sm" variant="outline" colorPalette="teal" onClick={exportar}>Exportar Excel</Button>
      </HStack>

      <Grid templateColumns={{ base: "1fr 1fr", md: "repeat(4, 1fr)" }} gap={4} mb={5}>
        <Resumen label="Facturado" valor={formatPesos(t.facturado)} />
        <Resumen label="Cobrado" valor={formatPesos(t.cobrado)} color="green.600" />
        <Resumen label={`Saldo adeudado (${t.mesesConSaldo} meses)`} valor={formatPesos(t.saldo)} color={t.saldo > 0 ? "red.500" : "green.600"} />
        <Resumen label="Honorarios pendientes" valor={formatPesos(t.honorariosPendientes)} color={t.honorariosPendientes > 0 ? "orange.500" : undefined} />
      </Grid>

      {/* Configuración */}
      <Card.Root borderRadius="xl" boxShadow="sm" mb={5}>
        <Card.Body>
          <Grid templateColumns={{ base: "1fr", md: "2fr 0.7fr 1fr 1fr" }} gap={3} alignItems="end">
            <FieldRoot>
              <FieldLabel fontSize="xs">Cobertura</FieldLabel>
              <Input size="sm" bg="bg.muted" value={config.cobertura} onChange={e => setConfig(c => ({ ...c, cobertura: e.target.value }))} />
            </FieldRoot>
            <FieldRoot>
              <FieldLabel fontSize="xs">% honorarios (meses nuevos)</FieldLabel>
              <Input size="sm" bg="bg.muted" inputMode="decimal" value={config.porcentaje} onChange={e => setConfig(c => ({ ...c, porcentaje: e.target.value.replace(/[^\d.]/g, "") }))} />
            </FieldRoot>
            <FieldRoot>
              <FieldLabel fontSize="xs">Honorario inicial (mes y medio)</FieldLabel>
              <Input size="sm" bg="bg.muted" inputMode="decimal" placeholder="$" value={config.honorarioInicial} onChange={e => setConfig(c => ({ ...c, honorarioInicial: e.target.value }))} />
            </FieldRoot>
            <FieldRoot>
              <FieldLabel fontSize="xs">Honorario inicial abonado el</FieldLabel>
              <Input size="sm" bg="bg.muted" type="date" value={config.honorarioInicialAbonado} onChange={e => setConfig(c => ({ ...c, honorarioInicialAbonado: e.target.value }))} />
            </FieldRoot>
            <FieldRoot gridColumn={{ md: "span 3" }}>
              <FieldLabel fontSize="xs">Observaciones de la cuenta</FieldLabel>
              <Input size="sm" bg="bg.muted" value={config.observaciones} onChange={e => setConfig(c => ({ ...c, observaciones: e.target.value }))} />
            </FieldRoot>
            <Button size="sm" colorPalette="teal" onClick={guardarConfig} loading={guardandoConfig}>Guardar configuración</Button>
          </Grid>
        </Card.Body>
      </Card.Root>

      {/* Barra de acciones */}
      <HStack mb={3} justify="space-between" flexWrap="wrap" gap={3}>
        <HStack gap={2}>
          {[["todos", "Todos"], ["saldo", "Con saldo"], ["revisar", `A revisar (${cantRevisar})`]].map(([key, label]) => (
            <Button key={key} size="xs" borderRadius="full" colorPalette={key === "revisar" ? "orange" : "gray"}
              variant={filtro === key ? "solid" : "outline"} onClick={() => setFiltro(key)}>
              {label}
            </Button>
          ))}
        </HStack>
        <Button size="sm" colorPalette="teal" variant="outline" onClick={agregarMes}>+ Agregar mes</Button>
      </HStack>

      {seleccion.size > 0 && (
        <Card.Root borderRadius="xl" mb={3} border="1px solid" borderColor="teal.300" bg="bg.muted">
          <Card.Body py={3}>
            <Grid templateColumns={{ base: "1fr", lg: "auto 1fr auto 1fr" }} gap={3} alignItems="center">
              <Text fontSize="sm" fontWeight="600" color="text.main">{seleccion.size} meses seleccionados</Text>
              <HStack gap={2} flexWrap="wrap">
                <Input size="sm" type="date" w="150px" bg="bg.panel" value={cobro.fecha} onChange={e => setCobro(c => ({ ...c, fecha: e.target.value }))} />
                <Input size="sm" w="170px" bg="bg.panel" inputMode="decimal" placeholder="Monto por mes (vacío = total)"
                  value={cobro.monto} onChange={e => setCobro(c => ({ ...c, monto: e.target.value }))} />
                <NativeSelect.Root size="sm" w="140px">
                  <NativeSelect.Field bg="bg.panel" value={cobro.pagador} onChange={e => setCobro(c => ({ ...c, pagador: e.target.value }))}>
                    {PAGADORES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Button size="sm" colorPalette="teal" onClick={registrarCobro} loading={aplicando}>Registrar cobro</Button>
              </HStack>
              <Box display={{ base: "none", lg: "block" }} w="1px" h="28px" bg="border.subtle" />
              <HStack gap={2} flexWrap="wrap">
                <Input size="sm" type="date" w="150px" bg="bg.panel" value={fechaHonorarios} onChange={e => setFechaHonorarios(e.target.value)} />
                <Button size="sm" colorPalette="orange" variant="outline" onClick={marcarHonorarios} loading={aplicando}>Honorarios abonados</Button>
              </HStack>
            </Grid>
          </Card.Body>
        </Card.Root>
      )}

      {/* Grilla de meses */}
      <Card.Root boxShadow="md" borderRadius="xl">
        <Card.Body p={0}>
          {meses.length === 0 ? (
            <Box textAlign="center" py={12}>
              <Text color="text.faint" mb={3}>Sin meses cargados.</Text>
              <Button size="sm" colorPalette="teal" onClick={agregarMes}>+ Agregar el primero</Button>
            </Box>
          ) : (
            <Box overflowX="auto">
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row bg="bg.muted">
                    <Table.ColumnHeader pl={3} w="32px">
                      <CheckboxRoot size="sm" checked={todosSeleccionados}
                        onCheckedChange={e => setSeleccion(e.checked ? new Set(visibles.map(m => m.id)) : new Set())}>
                        <CheckboxHiddenInput />
                        <CheckboxControl />
                      </CheckboxRoot>
                    </Table.ColumnHeader>
                    {["Período", "Factura", "Importe", "Presentada", "Lugar", "Cobrado el", "Cobrado", "Pagó", "Saldo", "Estado", "%", "Honorarios", "Hon. abonados", "Observaciones", ""].map(h => (
                      <Table.ColumnHeader key={h} fontWeight="600" fontSize="xs" whiteSpace="nowrap">{h}</Table.ColumnHeader>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {visibles.map(m => {
                    const estado = ESTADOS_MES[estadoMes(m)]
                    const revisar = aRevisar(m)
                    return (
                      <Table.Row key={m.id} bg={revisar ? "orange.50" : undefined} _dark={revisar ? { bg: "orange.950" } : undefined}>
                        <Table.Cell pl={3}>
                          <CheckboxRoot size="sm" checked={seleccion.has(m.id)} onCheckedChange={e => toggleSeleccion(m.id, !!e.checked)}>
                            <CheckboxHiddenInput />
                            <CheckboxControl />
                          </CheckboxRoot>
                        </Table.Cell>
                        <Table.Cell fontWeight="600" fontSize="sm" whiteSpace="nowrap">{formatPeriodo(m.periodo)}</Table.Cell>
                        <Table.Cell><CampoTexto w="90px" valor={m.numero_factura} onGuardar={v => guardarMes(m.id, { numero_factura: v })} /></Table.Cell>
                        <Table.Cell><CampoMonto w="105px" valor={m.importe} onGuardar={v => guardarMes(m.id, { importe: v })} /></Table.Cell>
                        <Table.Cell>
                          <Input size="xs" type="date" w="125px" bg="bg.panel" value={m.fecha_presentacion || ""}
                            onChange={e => guardarMes(m.id, { fecha_presentacion: e.target.value || null })} />
                        </Table.Cell>
                        <Table.Cell>
                          <NativeSelect.Root size="xs" w="115px">
                            <NativeSelect.Field bg="bg.panel" value={m.lugar_presentacion || ""} onChange={e => guardarMes(m.id, { lugar_presentacion: e.target.value || null })}>
                              <option value="">—</option>
                              {/* Conserva valores importados que no están en la lista */}
                              {[...new Set([...LUGARES_PRESENTACION, m.lugar_presentacion].filter(Boolean))].map(l => <option key={l} value={l}>{l}</option>)}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                        </Table.Cell>
                        <Table.Cell>
                          <Input size="xs" type="date" w="125px" bg="bg.panel" value={m.fecha_cobro || ""}
                            onChange={e => guardarMes(m.id, { fecha_cobro: e.target.value || null })} />
                        </Table.Cell>
                        <Table.Cell><CampoMonto w="105px" valor={m.importe_cobrado} onGuardar={v => guardarMes(m.id, { importe_cobrado: v })} /></Table.Cell>
                        <Table.Cell>
                          <NativeSelect.Root size="xs" w="105px">
                            <NativeSelect.Field bg="bg.panel" value={m.pagador || ""} onChange={e => guardarMes(m.id, { pagador: e.target.value || null })}>
                              <option value="">—</option>
                              {PAGADORES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                        </Table.Cell>
                        <Table.Cell textAlign="right" fontSize="sm" fontWeight="600" whiteSpace="nowrap" color={saldoMes(m) > 0 ? "red.500" : "text.muted"}>
                          {m.importe ? formatPesos(saldoMes(m)) : "—"}
                        </Table.Cell>
                        <Table.Cell>
                          <Badge colorPalette={estado.color} variant="subtle" borderRadius="full" px={2} fontSize="xs">{estado.label}</Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <CampoTexto w="50px" valor={String(m.porcentaje_honorarios)} inputMode="decimal"
                            onGuardar={v => {
                              const p = Number(v)
                              if (v !== null && Number.isFinite(p) && p >= 0 && p <= 100) guardarMes(m.id, { porcentaje_honorarios: p })
                            }} />
                        </Table.Cell>
                        <Table.Cell textAlign="right" fontSize="sm" whiteSpace="nowrap"
                          color={honorariosMes(m) > 0 && !m.honorarios_abonados_el ? "orange.500" : "text.muted"}>
                          {honorariosMes(m) > 0 ? formatPesos(honorariosMes(m)) : "—"}
                        </Table.Cell>
                        <Table.Cell>
                          <Input size="xs" type="date" w="125px" bg="bg.panel" value={m.honorarios_abonados_el || ""}
                            onChange={e => guardarMes(m.id, { honorarios_abonados_el: e.target.value || null })} />
                        </Table.Cell>
                        <Table.Cell>
                          <HStack gap={1}>
                            <CampoTexto minW="220px" valor={m.observaciones} onGuardar={v => guardarMes(m.id, { observaciones: v })} />
                            {revisar && (
                              <Button size="2xs" colorPalette="orange" variant="ghost" title="Quitar la marca de revisar"
                                onClick={() => guardarMes(m.id, { observaciones: m.observaciones.replace(MARCA_REVISAR, "") || null })}>
                                ✓
                              </Button>
                            )}
                          </HStack>
                        </Table.Cell>
                        <Table.Cell pr={3}>
                          {confirmarBorrar === m.id ? (
                            <HStack gap={0}>
                              <Button size="2xs" colorPalette="red" onClick={() => borrarMes(m.id)}>Borrar</Button>
                              <Button size="2xs" variant="ghost" onClick={() => setConfirmarBorrar(null)}>No</Button>
                            </HStack>
                          ) : (
                            <Button size="2xs" variant="ghost" colorPalette="red" onClick={() => setConfirmarBorrar(m.id)}>✕</Button>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Box>
          )}
        </Card.Body>
      </Card.Root>
    </Box>
  )
}
