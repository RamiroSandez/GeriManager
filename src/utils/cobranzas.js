// Cálculos de la cuenta corriente de cobranzas (facturación mensual a la obra social).
// Saldo, estado y honorarios se derivan siempre de los datos cargados: no se guardan.

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

export const LUGARES_PRESENTACION = ["UGL", "Mesa de entradas", "Correo electrónico", "Otro"]

export const PAGADORES = [
  { key: "obra_social", label: "Obra social" },
  { key: "familiar", label: "Familiar" },
  { key: "otro", label: "Otro" },
]

export const ESTADOS_MES = {
  pagado: { label: "Pagado", color: "green" },
  parcial: { label: "Parcial", color: "orange" },
  pendiente: { label: "Pendiente", color: "red" },
  sin_facturar: { label: "Sin facturar", color: "gray" },
}

const n = (v) => Number(v) || 0

// "2025-03-01" -> "Mar 25"
export const formatPeriodo = (periodo) => {
  const [y, m] = periodo.split("-").map(Number)
  return `${MESES_CORTOS[m - 1]} ${String(y).slice(2)}`
}

// Primer día del mes siguiente, en formato ISO
export const periodoSiguiente = (periodo) => {
  const [y, m] = periodo.split("-").map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

export const periodoActual = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

export const formatPesos = (monto) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n(monto))

export const formatFecha = (iso) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : ""

// Monto escrito en formato argentino ("2.618.357,49" o "$ 1.500.000") -> número, o null si está vacío
export const parseMonto = (texto) => {
  const limpio = String(texto ?? "").replace(/[^\d,]/g, "").replace(",", ".")
  if (!limpio) return null
  const valor = Number(limpio)
  return Number.isFinite(valor) ? valor : null
}

// Número -> texto editable en formato argentino (sin símbolo)
export const montoATexto = (monto) =>
  monto === null || monto === undefined || monto === ""
    ? ""
    : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(monto))

export const saldoMes = (mes) => (mes.importe ? n(mes.importe) - n(mes.importe_cobrado) : 0)

export const estadoMes = (mes) => {
  if (!mes.importe) return "sin_facturar"
  if (n(mes.importe_cobrado) >= n(mes.importe)) return "pagado"
  return n(mes.importe_cobrado) > 0 ? "parcial" : "pendiente"
}

// Honorarios = % sobre lo efectivamente cobrado (así se calculaba en la planilla)
export const honorariosMes = (mes) => (n(mes.importe_cobrado) * n(mes.porcentaje_honorarios)) / 100

export const honorariosPendientesMes = (mes) => (mes.honorarios_abonados_el ? 0 : honorariosMes(mes))

// Totales de una cuenta; el honorario inicial suma a pendientes mientras no tenga fecha de pago
export function totalesCuenta(meses, cuenta = {}) {
  const t = meses.reduce((acc, m) => {
    acc.facturado += n(m.importe)
    acc.cobrado += n(m.importe_cobrado)
    acc.saldo += saldoMes(m)
    acc.mesesConSaldo += saldoMes(m) > 0 ? 1 : 0
    acc.honorarios += honorariosMes(m)
    acc.honorariosPendientes += honorariosPendientesMes(m)
    if (m.fecha_cobro && (!acc.ultimoCobro || m.fecha_cobro > acc.ultimoCobro)) acc.ultimoCobro = m.fecha_cobro
    return acc
  }, { facturado: 0, cobrado: 0, saldo: 0, mesesConSaldo: 0, honorarios: 0, honorariosPendientes: 0, ultimoCobro: null })

  if (cuenta.honorario_inicial && !cuenta.honorario_inicial_abonado_el) t.honorariosPendientes += n(cuenta.honorario_inicial)
  return t
}
