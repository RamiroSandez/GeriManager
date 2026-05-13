const estilosBase = `
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; padding: 0; }
  .pagina { max-width: 700px; margin: 0 auto; padding: 40px 48px; }
  h1 { font-size: 15px; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 4px; }
  h2 { font-size: 13px; font-weight: bold; text-align: center; margin-bottom: 24px; text-decoration: underline; }
  .encabezado { text-align: center; margin-bottom: 28px; border-bottom: 2px solid #333; padding-bottom: 14px; }
  .fecha { text-align: right; margin-bottom: 20px; font-size: 12px; }
  .campo { margin-bottom: 10px; }
  .campo label { font-weight: bold; font-size: 11px; text-transform: uppercase; color: #444; }
  .campo .valor { border-bottom: 1px solid #aaa; min-height: 18px; padding: 2px 0; margin-top: 2px; font-size: 12px; }
  .grilla { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 16px; }
  .grilla-triple { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px 16px; margin-bottom: 16px; }
  .full { grid-column: 1 / -1; }
  .seccion-titulo { font-weight: bold; font-size: 11px; text-transform: uppercase; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 20px 0 10px; letter-spacing: 0.04em; }
  .parrafo { text-align: justify; line-height: 1.7; margin-bottom: 12px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table th { background: #f0f0f0; border: 1px solid #ccc; padding: 6px 10px; font-size: 11px; text-align: left; }
  table td { border: 1px solid #ccc; padding: 6px 10px; font-size: 12px; }
  table tr:nth-child(even) { background: #fafafa; }
  .total-row td { font-weight: bold; background: #e8f4e8; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 60px; }
  .firma-box { text-align: center; }
  .firma-linea { border-top: 1.5px solid #333; padding-top: 6px; margin-top: 50px; }
  .firma-label { font-size: 11px; color: #444; }
  .aviso { background: #f9f9e8; border: 1px solid #d4c400; border-radius: 4px; padding: 10px 14px; font-size: 11px; margin-bottom: 16px; }
`

const encabezado = (geriatrico, titulo) => `
  <div class="encabezado">
    <h1>${geriatrico.nombre || "Residencia Geriátrica"}</h1>
    ${geriatrico.nombre_director ? `<div style="font-size:11px;color:#555;">Director/a: ${geriatrico.nombre_director}</div>` : ""}
    <h2>${titulo}</h2>
  </div>
`

const datosPaciente = (p) => `
  <div class="seccion-titulo">Datos del paciente</div>
  <div class="grilla">
    <div class="campo">
      <div class="label">Apellido y Nombre</div>
      <div class="valor">${p.nombre}</div>
    </div>
    <div class="campo">
      <div class="label">DNI</div>
      <div class="valor">${p.dni}</div>
    </div>
    <div class="campo">
      <div class="label">Fecha de Nacimiento</div>
      <div class="valor">${p.fecha_nacimiento ? new Date(p.fecha_nacimiento + "T12:00:00").toLocaleDateString("es-AR") : "—"}</div>
    </div>
    <div class="campo">
      <div class="label">Edad</div>
      <div class="valor">${p.edad ? p.edad + " años" : "—"}</div>
    </div>
    <div class="campo">
      <div class="label">Obra Social</div>
      <div class="valor">${p.obra_social || "—"}</div>
    </div>
    <div class="campo">
      <div class="label">N° de Afiliado</div>
      <div class="valor">${p.numero_afiliado || "—"}</div>
    </div>
  </div>
`

const firmas = (geriatrico) => `
  <div class="firmas">
    <div class="firma-box">
      <div class="firma-linea"></div>
      <div class="firma-label">Firma del Titular / Responsable</div>
    </div>
    <div class="firma-box">
      <div class="firma-linea"></div>
      <div class="firma-label">${geriatrico.nombre_director || "Director/a"}</div>
    </div>
  </div>
`

// ─── Plantilla 1: Resumen de Historia Clínica ───────────────────────────────

function templateResumenHistoriaClinica(p, geriatrico, fecha) {
  const meds = p.medicacion?.length
    ? p.medicacion.map(m => `<li>${m}</li>`).join("")
    : "<li>Sin medicación registrada</li>"

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>${estilosBase}</style></head><body><div class="pagina">
  ${encabezado(geriatrico, "Resumen de Historia Clínica")}
  <div class="fecha">Buenos Aires, ${fecha}</div>
  ${datosPaciente(p)}
  <div class="seccion-titulo">Motivo de Ingreso</div>
  <div class="parrafo">${p.motivo_ingreso || "—"}</div>
  <div class="seccion-titulo">Diagnóstico Actual</div>
  <div class="parrafo">${p.diagnostico || "—"}</div>
  <div class="seccion-titulo">Antecedentes Médicos</div>
  <div class="parrafo">${p.antecedentes || "—"}</div>
  <div class="seccion-titulo">Medicación en Curso</div>
  <ul style="margin:0 0 16px 20px;line-height:1.8;font-size:12px;">${meds}</ul>
  <div class="parrafo" style="margin-top:24px;">
    El presente resumen ha sido elaborado en base a la ficha clínica del paciente obrante en el establecimiento,
    avalando la necesidad de internación y tratamiento geriátrico continuo.
  </div>
  ${firmas(geriatrico)}
  </div></body></html>`
}

// ─── Plantilla 2: Presupuesto ────────────────────────────────────────────────

function templatePresupuesto(p, geriatrico, fecha, items) {
  const filas = items.map(({ mes, monto }) =>
    `<tr><td>${mes}</td><td style="text-align:right;">$${monto}</td></tr>`
  ).join("")

  const totalNum = items.reduce((acc, i) => {
    const n = parseInt(String(i.monto).replace(/[.,\s]/g, ""))
    return acc + (isNaN(n) ? 0 : n)
  }, 0)

  const total = totalNum > 0
    ? new Intl.NumberFormat("es-AR").format(totalNum)
    : "—"

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>${estilosBase}</style></head><body><div class="pagina">
  ${encabezado(geriatrico, "Presupuesto de Prestaciones Geriátricas")}
  <div class="fecha">Buenos Aires, ${fecha}</div>
  ${datosPaciente(p)}
  <div class="seccion-titulo">Diagnóstico y Necesidad</div>
  <div class="parrafo">${p.diagnostico || "—"}</div>
  <div class="seccion-titulo">Detalle de Aranceles</div>
  <div class="aviso">Los valores expresados incluyen prestaciones de enfermería, alimentación, alojamiento,
  higiene y actividades recreativas conforme a los estándares del establecimiento.</div>
  <table>
    <thead><tr><th>Período</th><th style="text-align:right;">Arancel Mensual</th></tr></thead>
    <tbody>${filas}</tbody>
    <tfoot><tr class="total-row"><td><strong>Total período</strong></td><td style="text-align:right;"><strong>$${total}</strong></td></tr></tfoot>
  </table>
  <div class="parrafo">
    Los aranceles son actualizables conforme a la variación del índice de costos sectoriales
    e inflación publicada por organismos oficiales.
  </div>
  ${firmas(geriatrico)}
  </div></body></html>`
}

// ─── Plantilla 3: Informe de Deuda ──────────────────────────────────────────

function templateInformeDeuda(p, geriatrico, fecha, extras) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>${estilosBase}</style></head><body><div class="pagina">
  ${encabezado(geriatrico, "Informe de Deuda")}
  <div class="fecha">Buenos Aires, ${fecha}</div>
  ${datosPaciente(p)}
  <div class="seccion-titulo">Detalle de la Deuda</div>
  <div class="grilla">
    <div class="campo">
      <div class="label">Período adeudado</div>
      <div class="valor">${extras.periodo || "—"}</div>
    </div>
    <div class="campo">
      <div class="label">Obra Social</div>
      <div class="valor">${p.obra_social || "—"}</div>
    </div>
  </div>
  <div class="campo" style="margin-bottom:16px;">
    <div class="label">Monto adeudado</div>
    <div class="valor" style="font-size:15px;font-weight:bold;">${extras.monto_numerico || "—"}</div>
  </div>
  <div class="campo" style="margin-bottom:24px;">
    <div class="label">Monto en letras</div>
    <div class="valor">${extras.monto_letras || "—"}</div>
  </div>
  <div class="parrafo">
    Por medio del presente, la dirección de ${geriatrico.nombre || "la residencia"} informa
    a la Obra Social <strong>${p.obra_social || "indicada"}</strong> que, a la fecha, se registra
    una deuda en concepto de prestaciones geriátricas correspondiente al período ${extras.periodo || "indicado"},
    por la suma total de <strong>${extras.monto_numerico || "—"}</strong>
    (${extras.monto_letras || "—"}).
  </div>
  <div class="parrafo">
    Se solicita la regularización de la situación a la brevedad posible,
    a fin de garantizar la continuidad de las prestaciones al afiliado.
  </div>
  ${firmas(geriatrico)}
  </div></body></html>`
}

// ─── Plantilla 4: Propuesta de Prestaciones ─────────────────────────────────

function templatePropuestaPrestaciones(p, geriatrico, fecha) {
  const meds = p.medicacion?.length
    ? p.medicacion.map(m => `<li>${m}</li>`).join("")
    : "<li>Sin medicación registrada</li>"

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>${estilosBase}</style></head><body><div class="pagina">
  ${encabezado(geriatrico, "Propuesta de Prestaciones Geriátricas")}
  <div class="fecha">Buenos Aires, ${fecha}</div>
  ${datosPaciente(p)}
  <div class="seccion-titulo">Justificación Clínica</div>
  <div class="parrafo">
    En atención al estado de salud del/la paciente <strong>${p.nombre}</strong>,
    con diagnóstico de <strong>${p.diagnostico || "patología crónica"}</strong>,
    el equipo médico del establecimiento considera necesaria la continuidad de la internación geriátrica
    con las prestaciones detalladas a continuación.
  </div>
  <div class="seccion-titulo">Prestaciones Requeridas</div>
  <table>
    <thead><tr><th>Prestación</th><th>Descripción</th></tr></thead>
    <tbody>
      <tr><td>Internación geriátrica</td><td>Alojamiento, supervisión 24hs, higiene y confort</td></tr>
      <tr><td>Enfermería</td><td>Administración de medicación y controles de signos vitales</td></tr>
      <tr><td>Alimentación</td><td>4 comidas diarias adaptadas a requerimientos clínicos</td></tr>
      <tr><td>Actividades terapéuticas</td><td>Estimulación cognitiva y actividades recreativas</td></tr>
      <tr><td>Servicio social</td><td>Acompañamiento y coordinación con familia</td></tr>
    </tbody>
  </table>
  <div class="seccion-titulo">Medicación en Curso</div>
  <ul style="margin:0 0 16px 20px;line-height:1.8;font-size:12px;">${meds}</ul>
  <div class="seccion-titulo">Antecedentes</div>
  <div class="parrafo">${p.antecedentes || "—"}</div>
  <div class="parrafo" style="margin-top:16px;">
    Se solicita a la Obra Social <strong>${p.obra_social || "correspondiente"}</strong>
    la aprobación y cobertura de las prestaciones descriptas, indispensables para mantener
    la calidad de vida y el adecuado tratamiento del/la paciente.
  </div>
  ${firmas(geriatrico)}
  </div></body></html>`
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
    medicacion: Array.isArray(paciente.medicacion)
      ? paciente.medicacion
      : typeof paciente.medicacion === "string"
        ? paciente.medicacion.split("\n").filter(m => m.trim())
        : [],
  }

  const g = {
    nombre: geriatrico?.nombre || "",
    nombre_director: geriatrico?.nombre_director || "",
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

    case "propuesta_prestaciones":
      return templatePropuestaPrestaciones(p, g, fecha)

    default:
      throw new Error(`Tipo de documento no válido: ${tipo}`)
  }
}
