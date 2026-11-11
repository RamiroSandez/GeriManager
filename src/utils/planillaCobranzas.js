// Importación y exportación de la planilla de cobranzas en Excel (una hoja por paciente).
//
// La importación acepta la planilla "tal cual" la usaba el equipo: encabezados con nombres
// variables, columnas en distinto orden según la hoja, montos como texto y el problema de
// Excel que convierte "oct 23" en el 23/10 del año en curso. Todo lo que no se puede
// interpretar con seguridad va a observaciones con la marca "⚠ Revisar".
// La exportación genera el mismo formato, así que el archivo exportado se puede reimportar.

import { formatPeriodo } from "./cobranzas"

const MESES_TXT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const MARCA_REVISAR = "⚠ Revisar"

const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
const pad = (x) => String(x).padStart(2, "0")
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

// Orden importa: la primera regla que coincide se queda con la columna
const ROLES_COLUMNA = [
  ["periodo", /per.?odo/],
  ["fechaCobro", /pagad[oa] el/],
  ["cobrado", /monto (cobrado|pagado)|parcial|partical/],
  ["importe", /^monto( factura)?$/],
  ["presentacion", /presenta/],
  ["numeroFactura", /factura/],
  ["lugar", /lugar/],
  ["saldo", /saldo/],
  ["porcentaje", /^%$/],
  ["honorarios", /%|honorarios/],
  ["abonado", /abonado/],
  ["observaciones", /observ/],
  ["cobertura", /cobertura/],
]

// Roles que se interpretan como dato del mes; el resto de las columnas pasa a observaciones
const ROLES_DEL_MES = new Set(["periodo", "fechaCobro", "cobrado", "importe", "presentacion", "numeroFactura", "lugar", "saldo", "porcentaje", "honorarios", "abonado"])

const nombreColumna = (col) => (col < 26 ? String.fromCharCode(65 + col) : `${String.fromCharCode(64 + Math.floor(col / 26))}${String.fromCharCode(65 + (col % 26))}`)

// ¿El valor coincide con cobrado × % (tolerancia 2%)? Sirve para descartar honorarios redundantes
const coincide = (valor, esperado) => Math.abs(valor - esperado) <= Math.max(100, esperado * 0.02)

// ── Lectura de celdas ───────────────────────────────────────────────────────

// Normaliza una celda de SheetJS. Las fechas se leen como número de serie + formato
// para no depender de la zona horaria del navegador.
function leerCelda(cell, SSF) {
  if (!cell || cell.v === null || cell.v === undefined || cell.v === "") return null
  if (cell.t === "n" && cell.z && SSF.is_date(cell.z)) {
    const p = SSF.parse_date_code(cell.v)
    return { tipo: "fecha", y: p.y, m: p.m, d: p.d }
  }
  if (cell.t === "n") return { tipo: "num", v: cell.v }
  const texto = String(cell.v).trim()
  return texto ? { tipo: "texto", v: texto } : null
}

const textoCelda = (c) => {
  if (!c) return ""
  if (c.tipo === "fecha") return `${pad(c.d)}/${pad(c.m)}/${c.y}`
  if (c.tipo === "num") return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(c.v)
  return c.v
}

// "3.700.000", "3.800,000", "2.618.357,49" y "236,905.11" -> número
function leerMonto(c) {
  if (!c) return null
  if (c.tipo === "num") return c.v
  if (c.tipo !== "texto") return null
  const t = c.v.replace(/[$\s]/g, "")
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t)) return Number(t.replace(/,/g, ""))
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(t)) return Number(t.replace(/\./g, "").replace(",", "."))
  if (/^[\d.,]+$/.test(t)) return Number(t.replace(/[.,]/g, ""))
  return null
}

// Fecha real o fecha escrita dentro de un texto ("transf 24/2/25", "pagado 15/01/25")
function leerFecha(c) {
  if (!c) return null
  if (c.tipo === "fecha") return iso(c.y, c.m, c.d)
  if (c.tipo !== "texto") return null
  const m = c.v.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (!m) return null
  const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  return iso(anio, Number(m[2]), Number(m[1]))
}

// Período "como lo escribió el usuario". Si Excel lo convirtió en fecha con día 20-31,
// ese día es en realidad el año ("oct 23" -> 23/10/2026 -> octubre 2023).
function leerPeriodo(c) {
  if (!c) return null
  if (c.tipo === "fecha") return { y: c.d >= 20 ? 2000 + c.d : c.y, m: c.m }
  if (c.tipo !== "texto") return null
  const t = norm(c.v)
  const idx = MESES_TXT.findIndex(p => t.startsWith(p))
  if (idx < 0) return null
  const anio = t.match(/(\d{2,4})\s*$/)
  return { y: anio ? (anio[1].length === 2 ? 2000 + Number(anio[1]) : Number(anio[1])) : null, m: idx + 1 }
}

const mesSiguiente = ({ y, m }) => (m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 })

// ── Importación ─────────────────────────────────────────────────────────────

function leerGrilla(ws, XLSX) {
  if (!ws["!ref"]) return []
  const rango = XLSX.utils.decode_range(ws["!ref"])
  const filas = []
  for (let r = 0; r <= rango.e.r; r++) {
    const fila = []
    for (let c = 0; c <= rango.e.c; c++) fila.push(leerCelda(ws[XLSX.utils.encode_cell({ r, c })], XLSX.SSF))
    filas.push(fila)
  }
  return filas
}

// Busca la fila de encabezados en las primeras filas; sin encabezado asume Período | Monto | Presentación
function detectarColumnas(grilla) {
  for (let r = 0; r < Math.min(3, grilla.length); r++) {
    const textos = grilla[r].map(c => (c?.tipo === "texto" ? norm(c.v) : ""))
    if (!textos.some(t => /per.?odo/.test(t))) continue

    const roles = {}
    const etiquetas = {}
    let porcentajeEncabezado = null
    grilla[r].forEach((c, col) => {
      etiquetas[col] = c ? textoCelda(c).replace(/:\s*$/, "") : `Col ${nombreColumna(col)}`
      // Encabezado numérico tipo 0,05: es la columna de honorarios y su porcentaje
      if (c?.tipo === "num" && c.v > 0 && c.v < 1) {
        if (roles.honorarios === undefined) roles.honorarios = col
        porcentajeEncabezado = c.v * 100
        return
      }
      const regla = ROLES_COLUMNA.find(([rol, re]) => roles[rol] === undefined && re.test(textos[col]))
      if (regla) roles[regla[0]] = col
    })
    return { filaEncabezado: r, roles, etiquetas, porcentajeEncabezado }
  }
  const etiquetas = Object.fromEntries((grilla[0] || []).map((_, col) => [col, `Col ${nombreColumna(col)}`]))
  return { filaEncabezado: -1, roles: { periodo: 0, importe: 1, presentacion: 2 }, etiquetas, porcentajeEncabezado: null }
}

function importarHoja(nombreHoja, grilla, porcentajeDefecto) {
  const { filaEncabezado, roles, etiquetas, porcentajeEncabezado } = detectarColumnas(grilla)
  const usadas = new Set() // "fila:col" ya interpretadas como datos de la cuenta
  const cuenta = { cobertura: null, observaciones: [] }
  const avisos = []
  const rolDeColumna = Object.fromEntries(Object.entries(roles).map(([rol, col]) => [col, rol]))

  // Datos de la cuenta escritos en cualquier lugar de la hoja
  grilla.forEach((fila, r) => fila.forEach((c, col) => {
    if (c?.tipo !== "texto" || r <= filaEncabezado) return
    const t = norm(c.v)
    if (/^cobertura/.test(t)) {
      usadas.add(`${r}:${col}`) // etiqueta suelta tipo "cobertura máxima"
    } else if (!cuenta.cobertura && !/mes y medio|inicial/.test(t) && (col === roles.cobertura || /hogar|categor/.test(t))) {
      // Las notas de "mes y medio inicial" no son cobertura: quedan en observaciones del mes
      cuenta.cobertura = c.v
      usadas.add(`${r}:${col}`)
    }
  }))

  // Primera pasada: valores crudos de cada fila con período
  const crudas = []
  let porcentajeMarcado = null
  for (let r = filaEncabezado + 1; r < grilla.length; r++) {
    const fila = grilla[r]
    const celda = (rol) => (roles[rol] !== undefined ? fila[roles[rol]] : null)
    if (!celda("periodo")) {
      const valores = fila.filter(Boolean)
      // Fila separadora con 0,08: desde el mes siguiente cambia el porcentaje
      if (valores.length === 1 && valores[0].tipo === "num" && valores[0].v > 0 && valores[0].v < 1) {
        porcentajeMarcado = valores[0].v * 100
      } else {
        fila.forEach((c, col) => {
          if (c && !usadas.has(`${r}:${col}`)) cuenta.observaciones.push(textoCelda(c))
        })
      }
      continue
    }
    crudas.push({ r, fila, celda, porcentajeMarcado })
  }
  if (crudas.length === 0) return { hoja: nombreHoja, cuenta: null, meses: [], avisos: ["Hoja sin meses"] }

  // Porcentaje inicial: el que surge de los datos (honorarios / cobrado, entre 1% y 20%),
  // si no el del encabezado; si la hoja tiene el cambio a 8% marcado, antes se cobraba 5%
  const ratio = (c) => c.celda("honorarios")?.tipo === "num" && leerMonto(c.celda("cobrado"))
    ? (c.celda("honorarios").v / leerMonto(c.celda("cobrado"))) * 100
    : null
  const muestra = crudas.find(c => !c.porcentajeMarcado && ratio(c) >= 1 && ratio(c) <= 20)
  const hayCambio = crudas.some(c => c.porcentajeMarcado)
  let porcentajeInicial = muestra ? Math.round(ratio(muestra) * 2) / 2 : porcentajeEncabezado
  if (porcentajeInicial === null) {
    porcentajeInicial = hayCambio ? 5 : porcentajeDefecto
    avisos.push(`Se asumió ${porcentajeInicial}% de honorarios${hayCambio ? " antes del cambio de porcentaje" : ""}`)
  }

  // Segunda pasada: armar cada mes
  const meses = []
  const vistos = new Set()
  let anterior = null
  for (const { r, fila, celda, porcentajeMarcado: marcado } of crudas) {
    const obs = []
    let revisar = false

    // Período: se confía en la secuencia mes a mes, que corrige los años mal convertidos
    const leido = leerPeriodo(celda("periodo"))
    let periodo
    if (anterior) {
      const esperado = mesSiguiente(anterior)
      if (!leido || leido.m === esperado.m) {
        periodo = esperado
        if (!leido) { obs.push(`Período escrito "${textoCelda(celda("periodo"))}"`); revisar = true }
      } else {
        periodo = { y: leido.y ?? esperado.y, m: leido.m }
        obs.push(`Período fuera de secuencia ("${textoCelda(celda("periodo"))}")`)
        revisar = true
      }
    } else if (leido?.y) {
      periodo = leido
    } else {
      avisos.push(`No se pudo leer el primer período ("${textoCelda(celda("periodo"))}")`)
      return { hoja: nombreHoja, cuenta: null, meses: [], avisos }
    }
    anterior = periodo
    const periodoIso = iso(periodo.y, periodo.m, 1)
    if (vistos.has(periodoIso)) { avisos.push(`${formatPeriodo(periodoIso)} repetido: se omitió la fila ${r + 1}`); continue }
    vistos.add(periodoIso)

    const porcentaje = marcado ?? porcentajeInicial
    const importe = leerMonto(celda("importe"))
    const mes = {
      periodo: periodoIso,
      numero_factura: celda("numeroFactura") ? textoCelda(celda("numeroFactura")) : null,
      importe,
      fecha_presentacion: null,
      lugar_presentacion: celda("lugar") ? textoCelda(celda("lugar")) : null,
      fecha_cobro: null,
      importe_cobrado: null,
      porcentaje_honorarios: celda("porcentaje")?.tipo === "num" ? celda("porcentaje").v : porcentaje,
      honorarios_abonados_el: null,
    }

    // Presentación: fecha o lugar ("UGL")
    const pres = celda("presentacion")
    if (pres?.tipo === "fecha") mes.fecha_presentacion = leerFecha(pres)
    else if (pres && /ugl/i.test(pres.v)) mes.lugar_presentacion = "UGL"
    else if (pres) obs.push(`Presentación: ${textoCelda(pres)}`)

    // Cobro
    const fc = celda("fechaCobro")
    mes.fecha_cobro = leerFecha(fc)
    if (fc && !mes.fecha_cobro) obs.push(`Cobro: ${textoCelda(fc)}`)
    const cob = celda("cobrado")
    if (cob?.tipo === "texto" && /^t(otal)?$/i.test(cob.v)) mes.importe_cobrado = importe
    else if (leerMonto(cob) !== null) mes.importe_cobrado = leerMonto(cob)
    else if (cob) obs.push(`Cobrado: ${textoCelda(cob)}`)
    if (importe && mes.importe_cobrado > importe) {
      obs.push("Cobrado mayor al importe facturado")
      revisar = true
    }

    // Honorarios: se recalculan con el %; el valor de la planilla sirve para controlar o deducir el cobro
    const hon = celda("honorarios")?.tipo === "num" ? celda("honorarios").v : null
    if (hon !== null) {
      const esperado = ((mes.importe_cobrado ?? 0) * mes.porcentaje_honorarios) / 100
      if (mes.importe_cobrado === null && importe) {
        const deducido = (hon * 100) / mes.porcentaje_honorarios
        if (Math.abs(deducido - importe) <= importe * 0.02) {
          mes.importe_cobrado = importe
          obs.push("Cobro deducido de los honorarios")
        } else if (deducido < importe) {
          mes.importe_cobrado = Math.round(deducido * 100) / 100
          obs.push("Cobro deducido de los honorarios")
        } else {
          obs.push(`Honorarios en planilla: ${textoCelda(celda("honorarios"))} (¿pago agrupado?)`)
        }
        revisar = true
      } else if (!coincide(hon, esperado)) {
        obs.push(`Honorarios en planilla: ${textoCelda(celda("honorarios"))}`)
        revisar = true
      }
    }

    const ab = celda("abonado")
    if (ab) {
      const fechaAb = leerFecha(ab)
      if (fechaAb) {
        mes.honorarios_abonados_el = fechaAb
        if (ab.tipo === "texto") obs.push(`Honorarios: ${ab.v}`)
      } else if (/^(si|abonad|pagad)/.test(norm(ab.v ?? ""))) {
        mes.honorarios_abonados_el = mes.fecha_cobro || periodoIso
        obs.push("Honorarios abonados (sin fecha en la planilla)")
      } else {
        obs.push(`Honorarios: ${textoCelda(ab)}`)
      }
    }

    // El saldo se recalcula; si la planilla decía otra cosa, se avisa (a veces ahí había honorarios)
    const saldoPlanilla = celda("saldo")?.tipo === "num" ? celda("saldo").v : null
    if (saldoPlanilla !== null && importe && !coincide(saldoPlanilla, importe - (mes.importe_cobrado ?? 0))) {
      if (mes.importe_cobrado === null && coincide(saldoPlanilla, (importe * mes.porcentaje_honorarios) / 100)) {
        mes.importe_cobrado = importe
        obs.push("Cobro deducido de los honorarios anotados en Saldo")
      } else {
        obs.push(`Saldo en planilla: ${textoCelda(celda("saldo"))}`)
      }
      revisar = true
    }

    // Columnas sin rol (notas sueltas, pagos agrupados): nada se pierde
    const honorariosEsperados = ((mes.importe_cobrado ?? 0) * mes.porcentaje_honorarios) / 100
    fila.forEach((c, col) => {
      if (!c || usadas.has(`${r}:${col}`)) return
      const rol = rolDeColumna[col]
      if (ROLES_DEL_MES.has(rol)) return
      if (rol === "observaciones") { obs.push(textoCelda(c)); return }
      // Honorarios anotados en otra columna que coinciden con el cálculo: redundantes
      if (c.tipo === "num" && honorariosEsperados && coincide(c.v, honorariosEsperados)) return
      obs.push(`${etiquetas[col] || "Nota"}: ${textoCelda(c)}`)
      if ((c.tipo === "num" && c.v >= 1000) || (c.tipo === "texto" && /pagad/.test(norm(c.v)) && mes.importe_cobrado === null)) revisar = true
    })

    const textoObs = obs.join(" · ")
    mes.observaciones = revisar ? `${MARCA_REVISAR} · ${textoObs}` : (textoObs || null)
    meses.push(mes)
  }

  return {
    hoja: nombreHoja,
    cuenta: {
      ...cuenta,
      porcentaje_honorarios: meses.at(-1)?.porcentaje_honorarios ?? porcentajeDefecto,
      observaciones: cuenta.observaciones.join(" · ") || null,
    },
    meses,
    avisos,
    aRevisar: meses.filter(m => m.observaciones?.startsWith(MARCA_REVISAR)).length,
  }
}

// Lee un archivo .xlsx y devuelve una propuesta de importación por hoja
export async function leerPlanilla(file, porcentajeDefecto = 8) {
  const XLSX = await import("xlsx")
  const wb = XLSX.read(await file.arrayBuffer(), { cellNF: true, cellDates: false })
  return wb.SheetNames.map(nombre => importarHoja(nombre, leerGrilla(wb.Sheets[nombre], XLSX), porcentajeDefecto))
}

// Sugiere el paciente cuyo nombre contiene todas las palabras del nombre de la hoja ("BARR olga 05")
export function sugerirPaciente(nombreHoja, pacientes) {
  const tokens = norm(nombreHoja).split(/[^a-zñ]+/).filter(t => t.length >= 3)
  if (tokens.length === 0) return null
  const candidatos = pacientes.filter(p => {
    const palabras = norm(p.Nombre_Completo || "").split(/\s+/)
    return tokens.every(t => palabras.some(w => w.startsWith(t)))
  })
  return candidatos.length === 1 ? candidatos[0] : null
}

// ── Exportación ─────────────────────────────────────────────────────────────

const ENCABEZADOS = [
  "Período", "Factura Nro", "monto", "Fecha de presentación de factura", "Lugar", "Pagada el dia",
  "monto cobrado", "Saldo", "%", "Honorarios", "Abonado el", "Observaciones",
]

// Fecha ISO -> celda de Excel (número de serie, sin depender de la zona horaria)
const celdaFecha = (isoFecha, z = "dd/mm/yyyy") => {
  if (!isoFecha) return null
  const [y, m, d] = isoFecha.split("-").map(Number)
  return { t: "n", v: (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000, z }
}
const celdaMonto = (v) => (v === null || v === undefined ? null : { t: "n", v: Number(v), z: "#,##0" })

function hojaPaciente(XLSX, cuenta, meses) {
  const filas = [[...ENCABEZADOS, null, "Cobertura"]]
  meses.forEach((m, i) => {
    const cobrado = Number(m.importe_cobrado) || 0
    const fila = [
      celdaFecha(m.periodo, "mmm-yy"),
      m.numero_factura,
      celdaMonto(m.importe),
      celdaFecha(m.fecha_presentacion),
      m.lugar_presentacion,
      celdaFecha(m.fecha_cobro),
      celdaMonto(m.importe_cobrado),
      m.importe ? celdaMonto(Number(m.importe) - cobrado) : null,
      { t: "n", v: Number(m.porcentaje_honorarios) },
      cobrado ? celdaMonto((cobrado * Number(m.porcentaje_honorarios)) / 100) : null,
      celdaFecha(m.honorarios_abonados_el),
      m.observaciones,
    ]
    // Cobertura a la derecha, como en la planilla original (se reimporta igual)
    if (i === 0) fila.push(null, cuenta.cobertura)
    filas.push(fila)
  })
  const ws = XLSX.utils.aoa_to_sheet(filas)
  ws["!cols"] = [10, 12, 13, 14, 10, 12, 13, 13, 5, 12, 12, 40, 2, 40].map(wch => ({ wch }))
  return ws
}

// Genera y descarga el Excel: una hoja por paciente, mismo formato que la planilla
export async function exportarPlanilla(cuentas, meses, nombreArchivo) {
  const XLSX = await import("xlsx")
  const wb = XLSX.utils.book_new()
  const usados = new Set()
  for (const cuenta of cuentas) {
    // Nombres de hoja: máx. 31 caracteres, sin caracteres prohibidos y sin repetir
    const base = (cuenta.Pacientes?.Nombre_Completo || `Paciente ${cuenta.paciente_id}`).replace(/[[\]:*?/\\]/g, "").slice(0, 28)
    let nombre = base
    for (let i = 2; usados.has(nombre.toLowerCase()); i++) nombre = `${base} ${i}`
    usados.add(nombre.toLowerCase())
    const propios = meses.filter(m => m.paciente_id === cuenta.paciente_id).sort((a, b) => a.periodo.localeCompare(b.periodo))
    XLSX.utils.book_append_sheet(wb, hojaPaciente(XLSX, cuenta, propios), nombre)
  }
  XLSX.writeFile(wb, nombreArchivo)
}
