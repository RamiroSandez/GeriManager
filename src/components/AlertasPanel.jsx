import { useState, useEffect, useCallback } from "react"
import { Box, Text, Badge, Spinner } from "@chakra-ui/react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../services/supabase"
import { useAuth } from "../contexts/AuthContext"

const THRESHOLDS = {
  presion_maxima: { min: 90, max: 140, label: "Presión sistólica" },
  presion_minima: { min: 60, max: 90, label: "Presión diastólica" },
  temperatura:    { min: 35.0, max: 38.0, label: "Temperatura" },
  pulso:          { min: 60, max: 100, label: "Pulso" },
  respiracion:    { min: 12, max: 20, label: "Respiración" },
}

function IconBell({ hasAlertas }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      {hasAlertas && <circle cx="18" cy="5" r="4" fill="#ef4444" stroke="none" />}
    </svg>
  )
}

function SectionTitle({ label, color }) {
  return (
    <Text fontSize="10px" fontWeight="700" color={color} textTransform="uppercase"
      letterSpacing="wider" px={3} pt={3} pb={1}>
      {label}
    </Text>
  )
}

function AlertaItem({ emoji, titulo, subtitulo, color, onClick }) {
  return (
    <Box
      px={3} py={2.5} display="flex" alignItems="flex-start" gap={2.5}
      cursor={onClick ? "pointer" : "default"}
      _hover={{ bg: "bg.hover" }}
      onClick={onClick}
      transition="background 0.12s"
    >
      <Text fontSize="sm" mt="1px">{emoji}</Text>
      <Box>
        <Text fontSize="xs" fontWeight="600" color="text.main" lineHeight="1.3">{titulo}</Text>
        {subtitulo && <Text fontSize="10px" color="text.muted" lineHeight="1.4" mt={0.5}>{subtitulo}</Text>}
      </Box>
    </Box>
  )
}

export default function AlertasPanel() {
  const { geriatrico } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [alertas, setAlertas] = useState({ signos: [], medicacion: [], cumpleanos: [], amparos: [] })
  const [lastSeenTotal, setLastSeenTotal] = useState(
    () => parseInt(localStorage.getItem("geri-alertas-seen") || "0")
  )

  const marcarVisto = (n) => {
    setLastSeenTotal(n)
    localStorage.setItem("geri-alertas-seen", String(n))
  }

  const fetchAlertas = useCallback(async () => {
    if (!geriatrico?.id) return
    setCargando(true)

    const today = new Date().toISOString().split("T")[0]
    const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: pacientesData } = await supabase
      .from("Pacientes")
      .select("id, Nombre_Completo, fecha_nacimiento, estado")
      .eq("geriatrico_id", geriatrico.id)
      .or("estado.eq.activo,estado.is.null")

    const activoIds = (pacientesData ?? []).map(p => p.id)

    if (activoIds.length === 0) {
      setAlertas({ signos: [], medicacion: [], cumpleanos: [], amparos: [] })
      setCargando(false)
      return
    }

    const [
      { data: signosData },
      { data: medRegistroHoy },
      { data: pacienteMeds },
      { data: amparosData },
    ] = await Promise.all([
      supabase.from("registro_signos_vitales").select("*, Pacientes(Nombre_Completo, id)").gte("fecha", hace7).in("paciente_id", activoIds),
      supabase.from("registro_medicacion_diaria").select("paciente_id, medicamento_id").eq("fecha", today).in("paciente_id", activoIds),
      supabase.from("paciente_medicamentos").select("paciente_id, medicamento_id").in("paciente_id", activoIds),
      supabase.from("amparos").select("id, tipo, created_at, Pacientes(Nombre_Completo, id)").eq("geriatrico_id", geriatrico.id).lte("created_at", hace30).order("created_at", { ascending: false }).limit(10),
    ])

    // --- Signos vitales fuera de rango (últimos 7 días) ---
    const alertasSignos = []
    for (const reg of signosData ?? []) {
      for (const [campo, { min, max, label }] of Object.entries(THRESHOLDS)) {
        const val = reg[campo]
        if (val == null || val <= 0) continue
        if (val > max) {
          alertasSignos.push({ paciente: reg.Pacientes?.Nombre_Completo, pacienteId: reg.Pacientes?.id, msg: `${label} alta: ${val}`, fecha: reg.fecha })
        } else if (val < min) {
          alertasSignos.push({ paciente: reg.Pacientes?.Nombre_Completo, pacienteId: reg.Pacientes?.id, msg: `${label} baja: ${val}`, fecha: reg.fecha })
        }
      }
    }

    // --- Medicación sin administrar hoy ---
    const registradosHoy = new Set((medRegistroHoy ?? []).map(r => `${r.paciente_id}-${r.medicamento_id}`))
    const pacienteConMedPendiente = new Map()
    for (const pm of pacienteMeds ?? []) {
      const key = `${pm.paciente_id}-${pm.medicamento_id}`
      if (!registradosHoy.has(key)) {
        const p = pacientesData?.find(x => x.id === pm.paciente_id)
        if (p) pacienteConMedPendiente.set(pm.paciente_id, p.Nombre_Completo)
      }
    }
    const alertasMedicacion = Array.from(pacienteConMedPendiente.entries()).map(([id, nombre]) => ({ pacienteId: id, nombre }))

    // --- Cumpleaños hoy ---
    const todayMMDD = today.slice(5)
    const cumpleanos = (pacientesData ?? []).filter(p => p.fecha_nacimiento?.slice(5) === todayMMDD)

    // --- Amparos sin actualizar (>30 días) ---
    const tipoLabel = { resumen_historia_clinica: "Resumen HC", presupuesto: "Presupuesto", informe_deuda: "Informe Deuda", recibo_pago: "Recibo de Pago", propuesta_prestaciones: "Propuesta" }
    const alertasAmparos = (amparosData ?? []).map(a => ({
      id: a.id, paciente: a.Pacientes?.Nombre_Completo, pacienteId: a.Pacientes?.id,
      tipo: tipoLabel[a.tipo] ?? a.tipo,
      dias: Math.floor((Date.now() - new Date(a.created_at)) / (1000 * 60 * 60 * 24))
    }))

    setAlertas({ signos: alertasSignos, medicacion: alertasMedicacion, cumpleanos, amparos: alertasAmparos })
    setCargando(false)
  }, [geriatrico?.id])

  // Fetch al montar y cada 2 minutos en background
  useEffect(() => {
    if (!geriatrico?.id) return
    fetchAlertas()
    const interval = setInterval(fetchAlertas, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [geriatrico?.id]) // eslint-disable-line

  // Fetch fresco al abrir el panel
  useEffect(() => { if (open) fetchAlertas() }, [open, fetchAlertas])

  const total = alertas.signos.length + alertas.medicacion.length + alertas.cumpleanos.length + alertas.amparos.length
  const hayNuevas = total > lastSeenTotal

  const fmtFecha = (iso) => {
    const [, m, d] = iso.split("-")
    return `${d}/${m}`
  }

  return (
    <Box position="relative">
      {/* Campana */}
      <Box
        onClick={() => {
          if (open) {
            setOpen(false)
            marcarVisto(total)
          } else {
            setOpen(true)
          }
        }}
        cursor="pointer"
        px={2} py={2}
        borderRadius="lg"
        color={open ? "teal.600" : "text.muted"}
        _hover={{ bg: "bg.hover", color: "teal.600" }}
        transition="all 0.15s"
        position="relative"
      >
        <IconBell hasAlertas={hayNuevas} />
        {hayNuevas && !open && (
          <Box
            position="absolute" top="4px" right="4px"
            w="16px" h="16px" borderRadius="full"
            bg="red.500" color="white"
            fontSize="9px" fontWeight="700"
            display="flex" alignItems="center" justifyContent="center"
          >
            {(total - lastSeenTotal) > 9 ? "9+" : (total - lastSeenTotal)}
          </Box>
        )}
      </Box>

      {/* Panel desplegable */}
      {open && (
        <>
          {/* Overlay para cerrar al hacer click fuera */}
          <Box position="fixed" inset={0} zIndex={199} onClick={() => { setOpen(false); marcarVisto(total) }} />
          <Box
            position="fixed"
            top="16px"
            right="16px"
            w="300px"
            maxH="480px"
            bg="bg.panel"
            borderRadius="xl"
            boxShadow="0 8px 32px rgba(0,0,0,0.18)"
            border="1px solid"
            borderColor="border.subtle"
            zIndex={200}
            overflowY="auto"
          >
            <Box px={3} pt={3} pb={2} borderBottom="1px solid" borderColor="border.subtle">
              <Text fontWeight="700" fontSize="sm" color="text.main">Centro de alertas</Text>
              <Text fontSize="10px" color="text.muted">Hoy · Últimos 7 días</Text>
            </Box>

            {cargando ? (
              <Box display="flex" justifyContent="center" py={6}><Spinner size="sm" color="teal.500" /></Box>
            ) : total === 0 ? (
              <Box px={3} py={6} textAlign="center">
                <Text fontSize="2xl">✅</Text>
                <Text fontSize="sm" color="text.muted" mt={1}>Sin alertas activas</Text>
              </Box>
            ) : (
              <>
                {/* Signos vitales */}
                {alertas.signos.length > 0 && (
                  <Box>
                    <SectionTitle label={`Signos vitales (${alertas.signos.length})`} color="red.500" />
                    {alertas.signos.slice(0, 5).map((a, i) => (
                      <AlertaItem key={i} emoji="🩺"
                        titulo={a.paciente}
                        subtitulo={`${a.msg} — ${fmtFecha(a.fecha)}`}
                        onClick={() => { setOpen(false); navigate(`/paciente/${a.pacienteId}`) }}
                      />
                    ))}
                    {alertas.signos.length > 5 && (
                      <Text fontSize="10px" color="text.faint" px={3} pb={2}>+{alertas.signos.length - 5} más...</Text>
                    )}
                  </Box>
                )}

                {/* Medicación pendiente */}
                {alertas.medicacion.length > 0 && (
                  <Box borderTop={alertas.signos.length > 0 ? "1px solid" : undefined} borderColor="border.subtle">
                    <SectionTitle label={`Medicación pendiente hoy (${alertas.medicacion.length})`} color="orange.500" />
                    {alertas.medicacion.slice(0, 5).map((a, i) => (
                      <AlertaItem key={i} emoji="💊"
                        titulo={a.nombre}
                        subtitulo="Sin registro de medicación hoy"
                        onClick={() => { setOpen(false); navigate(`/paciente/${a.pacienteId}`) }}
                      />
                    ))}
                    {alertas.medicacion.length > 5 && (
                      <Text fontSize="10px" color="text.faint" px={3} pb={2}>+{alertas.medicacion.length - 5} más...</Text>
                    )}
                  </Box>
                )}

                {/* Cumpleaños */}
                {alertas.cumpleanos.length > 0 && (
                  <Box borderTop="1px solid" borderColor="border.subtle">
                    <SectionTitle label="Cumpleaños hoy" color="teal.500" />
                    {alertas.cumpleanos.map((p, i) => (
                      <AlertaItem key={i} emoji="🎂"
                        titulo={p.Nombre_Completo}
                        subtitulo="¡Hoy es su cumpleaños!"
                        onClick={() => { setOpen(false); navigate(`/paciente/${p.id}`) }}
                      />
                    ))}
                  </Box>
                )}

                {/* Amparos por actualizar */}
                {alertas.amparos.length > 0 && (
                  <Box borderTop="1px solid" borderColor="border.subtle">
                    <SectionTitle label={`Amparos sin actualizar (${alertas.amparos.length})`} color="yellow.600" />
                    {alertas.amparos.slice(0, 4).map((a, i) => (
                      <AlertaItem key={i} emoji="📄"
                        titulo={`${a.paciente} — ${a.tipo}`}
                        subtitulo={`Hace ${a.dias} días`}
                        onClick={() => { setOpen(false); navigate("/amparos") }}
                      />
                    ))}
                    {alertas.amparos.length > 4 && (
                      <Text fontSize="10px" color="text.faint" px={3} pb={2}>+{alertas.amparos.length - 4} más...</Text>
                    )}
                  </Box>
                )}
              </>
            )}

            <Box px={3} py={2} borderTop="1px solid" borderColor="border.subtle">
              <Text
                fontSize="10px" color="teal.600" fontWeight="600" cursor="pointer"
                _hover={{ textDecoration: "underline" }}
                onClick={() => { setOpen(false); fetchAlertas() }}
              >
                Actualizar alertas
              </Text>
            </Box>
          </Box>
        </>
      )}
    </Box>
  )
}
