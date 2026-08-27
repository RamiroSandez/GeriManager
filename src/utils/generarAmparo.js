import { supabase } from "../services/supabase"

// ─── Números a letras (para montos en pesos) ─────────────────────────────────

const _U = ["","UN","DOS","TRES","CUATRO","CINCO","SEIS","SIETE","OCHO","NUEVE","DIEZ","ONCE","DOCE","TRECE","CATORCE","QUINCE","DIECISÉIS","DIECISIETE","DIECIOCHO","DIECINUEVE"]
const _V = ["VEINTE","VEINTIÚN","VEINTIDÓS","VEINTITRÉS","VEINTICUATRO","VEINTICINCO","VEINTISÉIS","VEINTISIETE","VEINTIOCHO","VEINTINUEVE"]
const _D = ["","","VEINTE","TREINTA","CUARENTA","CINCUENTA","SESENTA","SETENTA","OCHENTA","NOVENTA"]
const _C = ["","CIENTO","DOSCIENTOS","TRESCIENTOS","CUATROCIENTOS","QUINIENTOS","SEISCIENTOS","SETECIENTOS","OCHOCIENTOS","NOVECIENTOS"]

const _menorMil = (n) => {
  if (n === 0) return ""
  if (n === 100) return "CIEN"
  const c = Math.floor(n / 100), r = n % 100
  let s = c > 0 ? _C[c] : ""
  if (r > 0) {
    if (s) s += " "
    if (r < 20) s += _U[r]
    else if (r < 30) s += _V[r - 20]
    else { s += _D[Math.floor(r / 10)]; if (r % 10 > 0) s += " Y " + _U[r % 10] }
  }
  return s
}

const numeroALetras = (input) => {
  const n = parseInt(String(input).replace(/[.,\s]/g, ""))
  if (!n || isNaN(n)) return ""
  const mill = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1_000)
  const resto = n % 1_000
  const partes = []
  if (mill === 1) partes.push("UN MILLÓN")
  else if (mill > 1) partes.push(_menorMil(mill) + " MILLONES")
  if (miles === 1) partes.push("MIL")
  else if (miles > 1) partes.push(_menorMil(miles) + " MIL")
  if (resto > 0) partes.push(_menorMil(resto))
  return partes.join(" ") + " PESOS"
}

const formatMiles = (valor) => {
  const n = parseInt(String(valor).replace(/[.,\s]/g, ""))
  return isNaN(n) ? String(valor ?? "") : new Intl.NumberFormat("es-AR").format(n)
}

const MESES_LARGOS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

const fechaLarga = () => {
  const d = new Date()
  return `${d.getDate()} de ${MESES_LARGOS[d.getMonth()]} ${d.getFullYear()}`
}

const formatFechaCorta = (iso) => {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  return `${d}-${m}-${y}`
}

const direccionCompleta = (geriatrico) => {
  const partes = [geriatrico.direccion, geriatrico.localidad].filter(Boolean)
  let linea = partes.join(" – ")
  if (geriatrico.telefono) linea += (linea ? " – " : "") + `Teléfono ${geriatrico.telefono}`
  return linea
}

// ─── Estilos compartidos ─────────────────────────────────────────────────────

const css = `
  * { box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    font-size: 11pt;
    color: #111;
    margin: 0;
    padding: 0;
    line-height: 1.6;
  }
  .pagina {
    max-width: 720px;
    margin: 0 auto;
    padding: 36px 48px;
  }

  /* Encabezado */
  .hdr {
    text-align: center;
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 14px;
    margin-bottom: 24px;
  }
  .hdr-nombre {
    font-size: 14pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 3px;
  }
  .hdr-director {
    font-size: 9pt;
    color: #666;
    margin-bottom: 6px;
  }
  .hdr-titulo {
    font-size: 12pt;
    font-weight: bold;
    text-decoration: underline;
    margin-top: 8px;
  }

  /* Fecha */
  .fecha {
    text-align: right;
    font-size: 10pt;
    color: #444;
    margin-bottom: 20px;
  }

  /* Secciones */
  .seccion { margin-bottom: 20px; }
  .seccion-titulo {
    font-size: 9pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #555;
    border-bottom: 1.5px solid #ccc;
    padding-bottom: 4px;
    margin-bottom: 12px;
  }

  /* Grilla de campos */
  .grilla   { display: grid; grid-template-columns: 1fr 1fr;     gap: 12px 28px; margin-bottom: 8px; }
  .grilla-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px 20px; margin-bottom: 8px; }
  .full { grid-column: 1 / -1; }
  .campo-lbl {
    font-size: 8pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #777;
    margin-bottom: 2px;
  }
  .campo-val {
    font-size: 10.5pt;
    border-bottom: 1px solid #bbb;
    padding-bottom: 3px;
    min-height: 20px;
  }

  /* Texto corrido */
  .texto {
    font-size: 10.5pt;
    line-height: 1.75;
    text-align: justify;
    margin-bottom: 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .texto-ind {
    font-size: 10.5pt;
    line-height: 1.75;
    text-align: justify;
    margin-bottom: 10px;
    margin-left: 30px;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Lista de medicación */
  .med-lista { list-style: none; margin: 0; padding: 0; }
  .med-lista li {
    font-size: 10.5pt;
    padding: 5px 8px;
    border-bottom: 1px dotted #ddd;
  }
  .med-lista li:last-child { border-bottom: none; }

  /* Tabla */
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 16px; }
  thead th {
    background: #f2f2f2;
    border: 1px solid #ccc;
    padding: 7px 10px;
    font-weight: bold;
    font-size: 9.5pt;
    text-align: left;
  }
  tbody td { border: 1px solid #ddd; padding: 6px 10px; }
  tbody tr:nth-child(even) { background: #fafafa; }
  tfoot td { border: 1px solid #ccc; padding: 7px 10px; font-weight: bold; background: #eef7ee; }
  tr { page-break-inside: avoid; break-inside: avoid; }

  /* Aviso */
  .aviso {
    background: #fffce8;
    border-left: 3px solid #cca800;
    padding: 10px 14px;
    font-size: 9.5pt;
    margin-bottom: 16px;
    border-radius: 2px;
    line-height: 1.6;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Firmas dobles */
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 52px; page-break-inside: avoid; break-inside: avoid; }
  .firma-box { text-align: center; }
  .firma-box .linea { border-top: 1.5px solid #222; padding-top: 6px; margin-top: 48px; }
  .firma-box .lbl { font-size: 9.5pt; color: #555; }

  /* Informe de deuda / Recibo de pago */
  .hdr-deuda {
    font-size: 15pt;
    font-weight: bold;
    letter-spacing: 0.12em;
    color: #963634;
    margin-bottom: 4px;
  }
  .direccion-deuda {
    font-size: 9pt;
    color: #963634;
    margin-bottom: 22px;
  }
  .campo-linea {
    font-size: 10.5pt;
    margin-bottom: 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .tabla-facturas th, .tabla-facturas td {
    border: 1px solid #333;
    padding: 8px 10px;
    font-size: 9.5pt;
    text-align: left;
    vertical-align: top;
  }
  .tabla-facturas th { font-weight: bold; background: #fff; }
  .tabla-facturas tr:nth-child(even) { background: #fff; }
  .tabla-total { width: auto; margin: 4px 0 24px 0; }
  .tabla-total td {
    border: 1px solid #333;
    padding: 8px 16px;
    font-weight: bold;
    font-size: 10.5pt;
  }
  .texto-deuda {
    font-size: 10.5pt;
    line-height: 1.6;
    text-align: justify;
    margin-bottom: 14px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .firma-deuda {
    margin-top: 40px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .firma-deuda div { font-size: 10.5pt; }
`

// ─── Bloques reutilizables ────────────────────────────────────────────────────

const htmlHead = () =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="pagina">`

const htmlFoot = () => `</div></body></html>`

const encabezado = (geriatrico, titulo, mostrarDirector = true) => `
  <div class="hdr">
    <div class="hdr-nombre">${geriatrico.nombre || "Residencia Geriátrica"}</div>
    ${mostrarDirector && geriatrico.nombre_director ? `<div class="hdr-director">Director/a: ${geriatrico.nombre_director}</div>` : ""}
    <div class="hdr-titulo">${titulo}</div>
  </div>
`

const fechaDiv = (fecha) =>
  `<div class="fecha">Buenos Aires, ${fecha}</div>`

const datosPaciente = (p) => {
  const fnac = p.fecha_nacimiento
    ? new Date(p.fecha_nacimiento + "T12:00:00").toLocaleDateString("es-AR")
    : "—"
  return `
    <div class="seccion">
      <div class="seccion-titulo">Datos del paciente</div>
      <div class="grilla">
        <div class="full">
          <div class="campo-lbl">Apellido y Nombre</div>
          <div class="campo-val">${p.nombre}</div>
        </div>
        <div>
          <div class="campo-lbl">DNI</div>
          <div class="campo-val">${p.dni}</div>
        </div>
        <div>
          <div class="campo-lbl">Fecha de Nacimiento</div>
          <div class="campo-val">${fnac}</div>
        </div>
        <div>
          <div class="campo-lbl">Edad</div>
          <div class="campo-val">${p.edad ? p.edad + " años" : "—"}</div>
        </div>
        <div>
          <div class="campo-lbl">Obra Social</div>
          <div class="campo-val">${p.obra_social || "—"}</div>
        </div>
        <div>
          <div class="campo-lbl">N° de Afiliado</div>
          <div class="campo-val">${p.numero_afiliado || "—"}</div>
        </div>
      </div>
    </div>
  `
}

const datosPacienteMinimo = (p) => `
  <div class="seccion">
    <div class="seccion-titulo">Datos del paciente</div>
    <div class="grilla">
      <div class="full">
        <div class="campo-lbl">Apellido y Nombre</div>
        <div class="campo-val">${p.nombre}</div>
      </div>
      <div class="full">
        <div class="campo-lbl">DNI</div>
        <div class="campo-val">${p.dni}</div>
      </div>
    </div>
  </div>
`

// Sigla o número romano corto (HTA, DBT, EPOC, II, IV) — se preserva tal cual.
const esAcronimo = (palabra) => /^[A-ZÁÉÍÓÚÑ0-9]{2,5}$/.test(palabra)

const capitalizarFrase = (texto) => {
  const t = texto.trim()
  if (!t) return t
  return t
    .split(" ")
    .map((palabra, i) => {
      const limpio = palabra.replace(/[^\p{L}\p{N}]/gu, "")
      if (esAcronimo(limpio)) return palabra
      const minuscula = palabra.toLowerCase()
      return i === 0 ? minuscula.charAt(0).toUpperCase() + minuscula.slice(1) : minuscula
    })
    .join(" ")
}

const listaDesdeTexto = (texto) =>
  String(texto || "")
    .split(/[,\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(capitalizarFrase)

const imgFirma = (geriatrico) => geriatrico.firma_url
  ? `<img src="${geriatrico.firma_url}" alt="Firma" style="max-width:180px; max-height:70px; display:block; margin:0 auto 4px auto;" />`
  : `<div class="linea"></div>`

const firmasDobles = (geriatrico) => `
  <div class="firmas">
    <div class="firma-box">
      <div class="linea"></div>
      <div class="lbl">Firma del Titular / Responsable</div>
    </div>
    <div class="firma-box">
      ${imgFirma(geriatrico)}
      <div class="lbl">${geriatrico.nombre_director || "Director/a"}</div>
    </div>
  </div>
`

const firmaDirectorSolo = (geriatrico) => `
  <div class="firmas" style="grid-template-columns: 1fr; max-width: 260px; margin-left: auto; margin-right: auto;">
    <div class="firma-box">
      ${imgFirma(geriatrico)}
      <div class="lbl" style="font-weight: bold; color: #222;">${geriatrico.nombre_director || "Director/a"}</div>
      <div class="lbl">Director/a Institucional</div>
    </div>
  </div>
`

// ─── Plantilla 1: Resumen de Historia Clínica ───────────────────────────────

function templateResumenHistoriaClinica(p, geriatrico, fecha) {
  const medItems = p.medicacion?.length
    ? p.medicacion.map(m => `<li>${m}</li>`).join("")
    : "<li>Sin medicación registrada</li>"

  const diagnosticoItems = listaDesdeTexto(p.diagnostico)
  const diagnosticoHtml = diagnosticoItems.length
    ? diagnosticoItems.map(d => `<li>${d}</li>`).join("")
    : "<li>—</li>"

  const antecedentesItems = listaDesdeTexto(p.antecedentes)
  const antecedentesHtml = antecedentesItems.length
    ? antecedentesItems.map(a => `<li>${a}</li>`).join("")
    : "<li>—</li>"

  const fnac = p.fecha_nacimiento
    ? new Date(p.fecha_nacimiento + "T12:00:00").toLocaleDateString("es-AR")
    : "—"

  return `
    ${htmlHead()}

    <div class="hdr">
      <div class="hdr-nombre" style="font-style:italic;">Residencia Geriátrica "Del Este"</div>
    </div>

    ${fechaDiv(fecha)}

    <div class="seccion">
      <div class="seccion-titulo">Resumen de Historia Clínica</div>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Datos del Paciente</div>
      <div class="grilla">
        <div class="full">
          <div class="campo-lbl">Nombre y Apellido</div>
          <div class="campo-val">${p.nombre}</div>
        </div>
        <div>
          <div class="campo-lbl">DNI</div>
          <div class="campo-val">${p.dni}</div>
        </div>
        <div>
          <div class="campo-lbl">Edad</div>
          <div class="campo-val">${p.edad ? p.edad + " años" : "—"}</div>
        </div>
        <div>
          <div class="campo-lbl">Fecha de Nacimiento</div>
          <div class="campo-val">${fnac}</div>
        </div>
        <div>
          <div class="campo-lbl">Obra Social</div>
          <div class="campo-val">${p.obra_social || "—"}</div>
        </div>
        <div>
          <div class="campo-lbl">Motivo de Ingreso</div>
          <div class="campo-val">${p.motivo_ingreso || "—"}</div>
        </div>
      </div>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Diagnóstico Actual</div>
      <ul class="med-lista">${diagnosticoHtml}</ul>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Antecedentes</div>
      <ul class="med-lista">${antecedentesHtml}</ul>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Resumen de Evolución</div>
      <div class="texto">
        Persona con buena adaptación. Actualmente el establecimiento es apropiado al estado de evolución
        de la patología del paciente. El estado del mismo amerita asistencia y cuidado permanente por 3eros
        para la realización de las AVD básicas (alimentación, aseo, medicación).
      </div>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Indicaciones Médicas</div>
      <div class="texto-ind">
        Mantener régimen de vida y controles médicos. Limitar novedades y perturbaciones en la vida diaria
        porque se asusta con facilidad y puede desembocar en brotes. Se indica continuar internación en la
        misma institución y sostener el tratamiento, para su adaptación e integración al medio en que se
        encuentra. Mantener atención exclusiva profesional las 24 hs. Se indica continuar con actividades
        de centro de día para estimulación. Se contraindica la interrupción del tratamiento y traslado por
        riesgo para la salud y afectación a nivel psíquico y cognitivo.
      </div>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Medicación</div>
      <ul class="med-lista">${medItems}</ul>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Prestaciones Requeridas</div>
      <div class="texto">
        Requiere prestaciones de Hogar permanente Categoría A con centro de día. Servicio de Medicina Clínica
        con controles de rutina semanal y resumen de historia clínica por semana. Enfermería las 24 hs.
        Médico, Nutricionista. Hotelería (lavado, planchado de ropa y ropa de cama). Sesiones de Psicología
        1 vez por semana. Sesiones de Musicoterapia. Sesiones de Recreo terapia.
      </div>
    </div>

    ${htmlFoot()}
  `
}

// ─── Plantilla 2: Presupuesto ────────────────────────────────────────────────

function templatePresupuesto(p, geriatrico, fecha, items) {
  const filas = items.map(({ mes, monto }) =>
    `<tr><td>${mes}</td><td style="text-align:right;">$${formatMiles(monto)}</td></tr>`
  ).join("")

  const totalNum = items.reduce((acc, i) => {
    const n = parseInt(String(i.monto).replace(/[.,\s]/g, ""))
    return acc + (isNaN(n) ? 0 : n)
  }, 0)

  const total = totalNum > 0
    ? new Intl.NumberFormat("es-AR").format(totalNum)
    : "—"

  return `
    ${htmlHead()}
    ${encabezado(geriatrico, "Presupuesto de Prestaciones Geriátricas", false)}
    ${fechaDiv(fecha)}
    ${datosPacienteMinimo(p)}

    <div class="seccion">
      <div class="seccion-titulo">Detalle de Aranceles</div>
      <div class="aviso">
        Los valores expresados incluyen prestaciones de enfermería, alimentación, alojamiento,
        higiene y actividades recreativas conforme a los estándares del establecimiento.
      </div>
      <table>
        <thead><tr><th>Período</th><th style="text-align:right;">Arancel Mensual</th></tr></thead>
        <tbody>${filas}</tbody>
        <tfoot>
          <tr>
            <td><strong>Total período</strong></td>
            <td style="text-align:right;"><strong>$${total}</strong></td>
          </tr>
        </tfoot>
      </table>
      <div class="texto">
        Los aranceles son actualizables conforme a la variación del índice de costos sectoriales
        e inflación publicada por organismos oficiales.
      </div>
    </div>

    ${firmaDirectorSolo(geriatrico)}
    ${htmlFoot()}
  `
}

// ─── Plantillas 3 y 3b: Informe de Deuda / Recibo de Pago ───────────────────

const PARRAFO_MORA = `
  Como consecuencias de los constantes aumentos de costos que debemos afrontar para brindar los servicios
  a los residentes, la falta de pago en tiempo y forma de las facturas ocasiona un grave perjuicio financiero
  a esta institución, por lo que se solicita se adopten las medidas para obtener el pronto pago de las mismas
  y se requiere que se dispongan las medidas necesarias para evitar se continúen produciendo reiterados
  retrasos en los pagos estableciendo la implementación de los mecanismos que resulten conducentes al pago
  de las mismas en tiempo y forma.
`

function documentoFacturas(p, geriatrico, { lineaMonto, labelTotal, totalValor, mostrarAbonado }) {
  const facturas = geriatrico._facturas || []

  const filas = facturas.map(f => `
    <tr>
      <td>${f.periodo || "—"}</td>
      <td>${f.factura || "—"}</td>
      <td style="text-align:right;">${f.importeTotal ? formatMiles(f.importeTotal) : "—"}</td>
      <td>${f.fechaPresentada ? formatFechaCorta(f.fechaPresentada) : "—"}</td>
      ${mostrarAbonado ? `<td style="text-align:right;">${f.importeAbonado ? formatMiles(f.importeAbonado) : ""}</td>` : ""}
    </tr>
  `).join("")

  return `
    ${htmlHead()}

    <div class="hdr-deuda">${geriatrico.nombre || "Residencia Geriátrica"}</div>
    <div class="direccion-deuda">${direccionCompleta(geriatrico)}</div>

    <div class="campo-linea">Fecha: ${fechaLarga()}</div>
    <div class="campo-linea">Paciente: ${p.nombre}</div>
    <div class="campo-linea">${lineaMonto}</div>

    <div class="campo-linea">Informamos detalle:</div>

    <table class="tabla-facturas">
      <thead>
        <tr>
          <th>Período Prestación</th>
          <th>Factura Nro</th>
          <th>Importe Total Factura</th>
          <th>Presentada el día</th>
          ${mostrarAbonado ? "<th>Importe Abonado</th>" : ""}
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>

    <table class="tabla-total">
      <tr><td>${labelTotal}</td><td>$${formatMiles(totalValor)}</td></tr>
    </table>

    <div class="texto-deuda">La liquidación es sin calcular intereses.</div>
    <div class="texto-deuda">${PARRAFO_MORA}</div>

    <div class="campo-linea">Saluda atentamente,</div>

    <div class="firma-deuda">
      ${geriatrico.firma_url ? `<img src="${geriatrico.firma_url}" alt="Firma" style="max-width:180px; max-height:70px; display:block; margin-bottom:4px;" />` : ""}
      <div style="font-weight:bold;">${geriatrico.nombre_director || "Director/a"}</div>
      <div>Director/a Institucional</div>
    </div>

    ${htmlFoot()}
  `
}

function templateInformeDeuda(p, geriatrico, fecha, extras) {
  const facturas = extras.facturas || []
  const totalAdeudado = facturas.reduce((acc, f) => acc + (parseInt(String(f.importeTotal).replace(/\D/g, "")) || 0), 0)
  const letras = numeroALetras(totalAdeudado)

  return documentoFacturas(p, { ...geriatrico, _facturas: facturas }, {
    lineaMonto: `Total Adeudado: ${letras ? `${letras}.` : "—"}`,
    labelTotal: "TOTAL ADEUDADO",
    totalValor: totalAdeudado,
    mostrarAbonado: false,
  })
}

function templateReciboPago(p, geriatrico, fecha, extras) {
  const facturas = extras.facturas || []
  const totalRecibido = facturas.reduce((acc, f) => acc + (parseInt(String(f.importeAbonado).replace(/\D/g, "")) || 0), 0)

  return documentoFacturas(p, { ...geriatrico, _facturas: facturas }, {
    lineaMonto: `Recibimos la suma de $${formatMiles(totalRecibido)}`,
    labelTotal: "TOTAL",
    totalValor: totalRecibido,
    mostrarAbonado: true,
  })
}

// ─── Plantilla 4: Propuesta de Prestaciones ─────────────────────────────────

function templatePropuestaPrestaciones(p, geriatrico, fecha) {
  const medItems = p.medicacion?.length
    ? p.medicacion.map(m => `<li>${m}</li>`).join("")
    : "<li>Sin medicación registrada</li>"

  return `
    ${htmlHead()}
    ${encabezado(geriatrico, "Propuesta de Prestaciones Geriátricas")}
    ${fechaDiv(fecha)}
    ${datosPaciente(p)}

    <div class="seccion">
      <div class="seccion-titulo">Justificación Clínica</div>
      <div class="texto">
        En atención al estado de salud del/la paciente <strong>${p.nombre}</strong>,
        con diagnóstico de <strong>${p.diagnostico || "patología crónica"}</strong>,
        el equipo médico del establecimiento considera necesaria la continuidad de la internación geriátrica
        con las prestaciones detalladas a continuación.
      </div>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Prestaciones Requeridas</div>
      <table>
        <thead><tr><th>Prestación</th><th>Descripción</th></tr></thead>
        <tbody>
          <tr><td>Internación geriátrica</td><td>Alojamiento, supervisión 24 hs, higiene y confort</td></tr>
          <tr><td>Enfermería</td><td>Administración de medicación y controles de signos vitales</td></tr>
          <tr><td>Alimentación</td><td>4 comidas diarias adaptadas a requerimientos clínicos</td></tr>
          <tr><td>Actividades terapéuticas</td><td>Estimulación cognitiva y actividades recreativas</td></tr>
          <tr><td>Servicio social</td><td>Acompañamiento y coordinación con familia</td></tr>
        </tbody>
      </table>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Medicación en Curso</div>
      <ul class="med-lista">${medItems}</ul>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Antecedentes</div>
      <div class="texto">${p.antecedentes || "—"}</div>
    </div>

    <div class="seccion">
      <div class="texto">
        Se solicita a la Obra Social <strong>${p.obra_social || "correspondiente"}</strong>
        la aprobación y cobertura de las prestaciones descriptas, indispensables para mantener
        la calidad de vida y el adecuado tratamiento del/la paciente.
      </div>
    </div>

    ${firmasDobles(geriatrico)}
    ${htmlFoot()}
  `
}

// ─── Función principal ───────────────────────────────────────────────────────

export function generarAmparo(tipo, paciente, geriatrico, extras = {}) {
  const fecha = new Date().toLocaleDateString("es-AR")
  const edad = paciente.fecha_nacimiento
    ? Math.floor((Date.now() - new Date(paciente.fecha_nacimiento).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  const p = {
    nombre: paciente.Nombre_Completo || paciente.nombre || "",
    dni: paciente.dni || "",
    obra_social: paciente.Obra_social || paciente.obra_social || "",
    numero_afiliado: paciente.numero_afiliado || "",
    fecha_nacimiento: paciente.fecha_nacimiento || "",
    diagnostico: paciente.diagnostico || "",
    motivo_ingreso: paciente.motivo_ingreso || "",
    antecedentes: paciente.antecedentes || "",
    edad,
    medicacion: (() => {
      const relacional = paciente.paciente_medicamentos
      if (Array.isArray(relacional) && relacional.length > 0) {
        return relacional.map(pm => {
          const partes = [pm.medicamento?.nombre || ""]
          if (pm.dosis) partes.push(pm.dosis)
          if (pm.frecuencia) partes.push(pm.frecuencia)
          if (pm.via) partes.push(`vía ${pm.via}`)
          return partes.filter(Boolean).join(" - ")
        })
      }
      if (Array.isArray(paciente.medicacion)) return paciente.medicacion
      if (typeof paciente.medicacion === "string") return paciente.medicacion.split("\n").filter(m => m.trim())
      return []
    })(),
  }

  const g = {
    nombre: geriatrico?.nombre || "",
    nombre_director: geriatrico?.nombre_director || "",
    direccion: geriatrico?.direccion || "",
    localidad: geriatrico?.localidad || "",
    telefono: geriatrico?.telefono || "",
    firma_url: geriatrico?.firma_path
      ? supabase.storage.from("documentos").getPublicUrl(geriatrico.firma_path).data.publicUrl
      : "",
  }

  switch (tipo) {
    case "resumen_historia_clinica":
      return templateResumenHistoriaClinica(p, g, fecha)

    case "presupuesto": {
      const items = (extras.item_presupuesto || "")
        .split("<br>")
        .filter(Boolean)
        .map(linea => {
          const [mes, monto] = linea.split(": $")
          return { mes: (mes || "").replace(/-/g, "/"), monto: monto || "" }
        })
      return templatePresupuesto(p, g, fecha, items)
    }

    case "informe_deuda":
      return templateInformeDeuda(p, g, fecha, extras)

    case "recibo_pago":
      return templateReciboPago(p, g, fecha, extras)

    case "propuesta_prestaciones":
      return templatePropuestaPrestaciones(p, g, fecha)

    default:
      throw new Error(`Tipo de documento no válido: ${tipo}`)
  }
}
