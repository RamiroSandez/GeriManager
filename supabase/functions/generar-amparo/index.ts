import { serve } from "https://deno.land/std@0.170.0/http/server.ts"

const TEMPLATE_IDS: Record<string, string> = {
  resumen_historia_clinica: "148LbUTSyofdAs625zdr1FPSgMtMRFAzVRCrmOnsFTcE",
  presupuesto: "1Ufa6kkS01kys2yZnQSjEBP54vg3NBWiiqqbFNghFLi0",
  informe_deuda: "1ajhujyE4wSc8e34tPKpOT_z-b5YvbUh-AdLB3VmPupo",
  propuesta_prestaciones: "1CTB9_0bnoM-OZo5bvmzAl6zcQsFSZTSl2GviLjzmSBM",
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function getServiceAccountToken(): Promise<string> {
  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL")!
  const privateKeyRaw = Deno.env.get("GOOGLE_PRIVATE_KEY")!
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n")

  const header = { alg: "RS256", typ: "JWT" }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")

  const headerB64 = encode(header)
  const payloadB64 = encode(payload)
  const signingInput = `${headerB64}.${payloadB64}`

  const pemBody = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "")
  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  )

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")

  const jwt = `${signingInput}.${sigB64}`

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error(`Token error: ${JSON.stringify(tokenData)}`)
  return tokenData.access_token
}

const buildReemplazos = (paciente: any, geriatrico: any, extras: any, edad: number | string, medicacion: string, fecha: string): [string, string][] => [
  ["{fecha_amparo}", fecha],
  ["{nombre_completo}", paciente.nombre || ""],
  ["{dni}", paciente.dni || ""],
  ["{edad}", String(edad)],
  ["{fecha_nacimiento}", paciente.fecha_nacimiento || ""],
  ["{obra_social}", paciente.obra_social || ""],
  ["{numero_afiliado}", paciente.numero_afiliado || ""],
  ["{motivo_ingreso}", paciente.motivo_ingreso || ""],
  ["{diagnóstico_actual}", paciente.diagnostico || ""],
  ["{diagnostico_actual}", paciente.diagnostico || ""],
  ["{antecedentes}", paciente.antecedentes || ""],
  ["{medicación}", medicacion],
  ["{medicacion}", medicacion],
  ["{nombre_geriatrico}", geriatrico.nombre || ""],
  ["{nombre_director}", geriatrico.nombre_director || ""],
  ["{item_presupuesto}", extras.item_presupuesto || ""],
  ["{monto_letras}", extras.monto_letras || ""],
  ["{monto_numerico}", extras.monto_numerico || ""],
  ["{periodo}", extras.periodo || ""],
]

const templateResumenHistoriaClinica = (p: Record<string, string>) => `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; margin: 50px 60px; color: #000; line-height: 1.5; }
  .titulo { text-align: center; font-weight: bold; font-style: italic; text-decoration: underline; font-size: 13pt; margin-bottom: 20px; }
  p { margin: 0 0 6px 0; }
  b { font-weight: bold; }
  .justificado { text-align: justify; }
  .indentado { margin-left: 36px; text-align: justify; }
  .firma { margin-top: 48px; }
</style>
</head>
<body>
  <div class="titulo">Residencia Geriátrica "Del Este"</div>

  <p><b>Fecha:</b> ${p.fecha_amparo}</p>

  <p>&nbsp;</p>
  <p><b>RESUMEN DE HISTORIA CLÍNICA</b></p>
  <p>&nbsp;</p>

  <p><b>Datos Paciente</b></p>
  <p>&nbsp;</p>

  <p><b>Nombre y apellido:</b>${p.nombre_completo}</p>
  <p><b>DNI:</b> ${p.dni}</p>
  <p><b>Edad:</b> ${p.edad} años</p>
  <p><b>Fecha de Nacimiento:</b> ${p.fecha_nacimiento}</p>
  <p><b>Obra Social:</b> ${p.obra_social}</p>
  <p><b>Motivo de ingreso:</b> ${p.motivo_ingreso}</p>
  <p>&nbsp;</p>

  <p><b>Diagnóstico actual:<u>${p.diagnostico}</u>.</b></p>
  <p>&nbsp;</p>

  <p class="justificado"><b>Antecedentes:</b> ${p.antecedentes}.</p>
  <p class="justificado"><b>Resumen de evolución:</b> Persona con buena adaptación. Actualmente el establecimiento es apropiado al estado de evolución de la patología del paciente. El estado del mismo amerita asistencia y cuidado permanente por 3eros para la realización de las AVD básicas (alimentación, aseo, medicación).</p>
  <p>&nbsp;</p>

  <p><b>Indicaciones médicas:</b></p>
  <p class="indentado">Mantener régimen de vida y controles médicos. Limitar novedades y perturbaciones en la vida diaria porque se asusta con facilidad y puede desembocar en brotes. Se indica continuar internación en la misma institución y sostener el tratamiento, para su adaptación e integración al medio en que se encuentra. Mantener atención exclusiva profesional las 24 hs. Se indica continuar con actividades de centro de día para estimulación. Se contraindica la interrupción del tratamiento traslado por riesgo para la salud y afectación a nivel psíquico y cognitivo.</p>
  <p>&nbsp;</p>

  <p><b>Medicación:</b></p>
  <p>${p.medicacion}</p>
  <p>&nbsp;</p>

  <p><b>Prestaciones requeridas:</b></p>
  <p class="justificado">Requiere prestaciones de Hogar permanente Categoría A con centro de día. Servicio de Medicina Clínica con controles de rutina semanal y resumen de historia clínica por semana. Enfermería las 24hs. Médico, Nutricionista. Hotelería (lavado, planchado de ropa y ropa de cama). Sesiones de Psicología 1 vez por semana. Sesiones de Musicoterapia. Sesiones de Recreo terapia.</p>

  <div class="firma">
    <p><b><u>DR. OMAR M. MONTES</u></b></p>
    <p>M.N 54889</p>
  </div>
</body>
</html>`

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  try {
    const { paciente, tipo, geriatrico = {}, extras = {} } = await req.json()

    // Calcular edad y medicación (común a todos los tipos)
    const edad = paciente.fecha_nacimiento
      ? Math.floor((Date.now() - new Date(paciente.fecha_nacimiento).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : ""

    const medicacion = Array.isArray(paciente.medicacion)
      ? paciente.medicacion.join("<br>")
      : paciente.medicacion || ""

    const fecha = new Date().toLocaleDateString("es-AR")

    // Resumen de historia clínica: template inline (layout fijo, sin depender de Google Docs)
    if (tipo === "resumen_historia_clinica") {
      const html = templateResumenHistoriaClinica({
        fecha_amparo:    fecha,
        nombre_completo: paciente.nombre || "",
        dni:             paciente.dni || "",
        edad:            String(edad),
        fecha_nacimiento: paciente.fecha_nacimiento || "",
        obra_social:     paciente.obra_social || "",
        motivo_ingreso:  paciente.motivo_ingreso || "",
        diagnostico:     paciente.diagnostico || "",
        antecedentes:    paciente.antecedentes || "",
        medicacion,
      })
      return new Response(JSON.stringify({ html }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Resto de tipos: fetch desde Google Docs
    const templateId = TEMPLATE_IDS[tipo]
    if (!templateId) throw new Error(`Tipo de documento no válido o sin template asignado: ${tipo}`)

    const token = await getServiceAccountToken()

    const exportRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${templateId}/export?mimeType=text/html`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!exportRes.ok) {
      const errText = await exportRes.text()
      throw new Error(`Error exportando template: ${errText}`)
    }

    let html = await exportRes.text()

    // Normalizar entidades HTML dentro de placeholders
    html = html.replace(/\{[^}]{1,60}\}/g, (match) =>
      match
        .replace(/&aacute;/g, "á").replace(/&#225;/g, "á")
        .replace(/&eacute;/g, "é").replace(/&#233;/g, "é")
        .replace(/&iacute;/g, "í").replace(/&#237;/g, "í")
        .replace(/&oacute;/g, "ó").replace(/&#243;/g, "ó")
        .replace(/&uacute;/g, "ú").replace(/&#250;/g, "ú")
        .replace(/&ntilde;/g, "ñ").replace(/&#241;/g, "ñ")
    )

    const reemplazos = buildReemplazos(paciente, geriatrico, extras, edad, medicacion, fecha)
    for (const [placeholder, value] of reemplazos) {
      html = html.split(placeholder).join(value)
    }

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
