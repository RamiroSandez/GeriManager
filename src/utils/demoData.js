import { supabase } from "../services/supabase"

const diasAtras = (n) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

const fechaMes = (mes, dia) => {
  const now = new Date()
  const año = mes === "anterior" && now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const m = mes === "anterior"
    ? (now.getMonth() === 0 ? 12 : now.getMonth())
    : now.getMonth() + 1
  return `${año}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

const PACIENTES = [
  {
    Nombre_Completo: "María Luisa García", dni: "5423891", Obra_social: "PAMI",
    numero_afiliado: "P-4523891", fecha_nacimiento: "1948-03-15",
    diagnostico: "Enfermedad de Alzheimer en estadío moderado",
    motivo_ingreso: "Deterioro cognitivo progresivo, familia sin posibilidad de cuidado domiciliario",
    antecedentes: "Hipertensión arterial, hipotiroidismo",
    nombre_contacto: "Laura García", telefono_contacto: "11-4523-8901",
  },
  {
    Nombre_Completo: "Roberto Fernández", dni: "4187234", Obra_social: "OSDE",
    numero_afiliado: "OSDE-4187234", fecha_nacimiento: "1944-08-22",
    diagnostico: "Enfermedad de Parkinson con temblor en reposo y rigidez muscular",
    motivo_ingreso: "Dificultades de movilidad y riesgo de caídas en domicilio",
    antecedentes: "Diabetes tipo 2 controlada",
    nombre_contacto: "Carlos Fernández", telefono_contacto: "11-6234-5678",
  },
  {
    Nombre_Completo: "Elena Beatriz Martínez", dni: "6891234", Obra_social: "IOMA",
    numero_afiliado: "IOMA-6891234", fecha_nacimiento: "1951-11-10",
    diagnostico: "Hipertensión arterial crónica, dislipemia",
    motivo_ingreso: "Solicitud familiar para supervisión médica permanente",
    antecedentes: "Cirugía de vesícula 2018",
    nombre_contacto: "Pedro Martínez", telefono_contacto: "221-4567-890",
  },
  {
    Nombre_Completo: "Carlos Alberto López", dni: "3456789", Obra_social: "PAMI",
    numero_afiliado: "P-3456789", fecha_nacimiento: "1938-05-30",
    diagnostico: "Diabetes tipo 2 insulinodependiente, retinopatía diabética",
    motivo_ingreso: "Control metabólico y administración de insulina",
    antecedentes: "Infarto agudo de miocardio 2015, HTA",
    nombre_contacto: "Ana López", telefono_contacto: "11-2345-6789",
  },
  {
    Nombre_Completo: "Ana Rosa Rodríguez", dni: "8234567", Obra_social: "Swiss Medical",
    numero_afiliado: "SM-8234567", fecha_nacimiento: "1955-02-14",
    diagnostico: "Artrosis de cadera bilateral, hipertensión arterial",
    motivo_ingreso: "Recuperación post-quirúrgica de prótesis de cadera derecha",
    antecedentes: "Osteoporosis, fractura de muñeca 2022",
    nombre_contacto: "Marcelo Rodríguez", telefono_contacto: "11-8765-4321",
  },
  {
    Nombre_Completo: "Jorge Héctor Pérez", dni: "3987654", Obra_social: "PAMI",
    numero_afiliado: "P-3987654", fecha_nacimiento: "1941-09-07",
    diagnostico: "EPOC severo, cor pulmonale",
    motivo_ingreso: "Necesidad de oxigenoterapia domiciliaria y fisioterapia respiratoria",
    antecedentes: "Ex fumador 40 años, HTA",
    nombre_contacto: "Mónica Pérez", telefono_contacto: "11-9876-5432",
  },
  {
    Nombre_Completo: "Marta Susana González", dni: "5678901", Obra_social: "Medicus",
    numero_afiliado: "MED-5678901", fecha_nacimiento: "1947-07-18",
    diagnostico: "Demencia senil moderada-severa, inmovilismo parcial",
    motivo_ingreso: "Deambulación inestable, desorientación temporo-espacial y riesgo de fuga",
    antecedentes: "ACV isquémico 2019",
    nombre_contacto: "Ricardo González", telefono_contacto: "11-1234-9876",
  },
  {
    Nombre_Completo: "Luis Antonio Sánchez", dni: "2345678", Obra_social: "PAMI",
    numero_afiliado: "P-2345678", fecha_nacimiento: "1934-12-03",
    diagnostico: "Insuficiencia cardíaca congestiva, fibrilación auricular crónica",
    motivo_ingreso: "Control cardiológico, tratamiento diurético y anticoagulante",
    antecedentes: "Bypass coronario 2010, marcapasos 2018",
    nombre_contacto: "Susana Sánchez", telefono_contacto: "11-5678-1234",
  },
]

const MEDICAMENTOS = [
  { nombre: "Enalapril", presentacion: "Comprimidos 10mg", dosis_estandar: "1 comprimido en ayunas" },
  { nombre: "Metformina", presentacion: "Comprimidos 500mg", dosis_estandar: "1 comprimido con el almuerzo" },
  { nombre: "Omeprazol", presentacion: "Cápsulas 20mg", dosis_estandar: "1 cápsula antes del desayuno" },
  { nombre: "Aspirina", presentacion: "Comprimidos 100mg", dosis_estandar: "1 comprimido con el desayuno" },
  { nombre: "Losartán", presentacion: "Comprimidos 50mg", dosis_estandar: "1 comprimido por la mañana" },
]

const GASTOS = [
  { categoria: "medicamentos", descripcion: "Compra mensual de medicamentos", monto: 850000, proveedor: "Farmacia del Centro", fecha: fechaMes("actual", 2) },
  { categoria: "alimentacion", descripcion: "Compras supermercado semanal", monto: 420000, proveedor: "Carrefour", fecha: fechaMes("actual", 5) },
  { categoria: "higiene", descripcion: "Pañales y artículos de higiene personal", monto: 280000, proveedor: "Distribuidora Salud", fecha: fechaMes("actual", 8) },
  { categoria: "personal", descripcion: "Sueldo enfermera turno noche", monto: 1200000, proveedor: null, fecha: fechaMes("actual", 10) },
  { categoria: "medicamentos", descripcion: "Compra mensual de medicamentos", monto: 780000, proveedor: "Farmacia del Centro", fecha: fechaMes("anterior", 3) },
  { categoria: "alimentacion", descripcion: "Compras supermercado semanal", monto: 380000, proveedor: "Carrefour", fecha: fechaMes("anterior", 10) },
  { categoria: "mantenimiento", descripcion: "Reparación sistema de calefacción", monto: 350000, proveedor: "Técnico Martínez", fecha: fechaMes("anterior", 15) },
  { categoria: "personal", descripcion: "Sueldo enfermera turno noche", monto: 1150000, proveedor: null, fecha: fechaMes("anterior", 20) },
  { categoria: "higiene", descripcion: "Pañales y artículos de higiene personal", monto: 250000, proveedor: "Distribuidora Salud", fecha: fechaMes("anterior", 28) },
]

// Signos vitales para los últimos 7 días — algunos fuera de rango para mostrar alertas
function generarSignos(pacienteIdx) {
  const registros = []
  const dias = [0, 2, 4, 6]
  for (const d of dias) {
    const base = {
      fecha: diasAtras(d),
      presion_maxima: 125, presion_minima: 78, temperatura: 36.5, pulso: 72, respiracion: 16,
    }
    // Carlos (idx 3): presión alta el día 0
    if (pacienteIdx === 3 && d === 0) base.presion_maxima = 158
    // Jorge (idx 5): respiración baja el día 2
    if (pacienteIdx === 5 && d === 2) base.respiracion = 9
    // Luis (idx 7): pulso alto el día 4
    if (pacienteIdx === 7 && d === 4) base.pulso = 112
    registros.push(base)
  }
  return registros
}

export async function cargarDemoData(geriatricoId) {
  // 1. Medicamentos
  const { data: meds, error: errMeds } = await supabase
    .from("medicamentos")
    .insert(MEDICAMENTOS.map(m => ({ ...m, geriatrico_id: geriatricoId })))
    .select("id")
  if (errMeds) return { error: errMeds }

  // 2. Pacientes
  const { data: pacs, error: errPacs } = await supabase
    .from("Pacientes")
    .insert(PACIENTES.map(p => ({ ...p, geriatrico_id: geriatricoId, estado: "activo" })))
    .select("id")
  if (errPacs) return { error: errPacs }

  const medIds = meds.map(m => m.id)
  const pacIds = pacs.map(p => p.id)

  // 3. Asignar medicamentos a pacientes
  const asignaciones = [
    { paciente_id: pacIds[0], medicamento_id: medIds[0] }, // María: Enalapril
    { paciente_id: pacIds[0], medicamento_id: medIds[2] }, // María: Omeprazol
    { paciente_id: pacIds[1], medicamento_id: medIds[4] }, // Roberto: Losartán
    { paciente_id: pacIds[2], medicamento_id: medIds[0] }, // Elena: Enalapril
    { paciente_id: pacIds[2], medicamento_id: medIds[3] }, // Elena: Aspirina
    { paciente_id: pacIds[3], medicamento_id: medIds[1] }, // Carlos: Metformina
    { paciente_id: pacIds[3], medicamento_id: medIds[2] }, // Carlos: Omeprazol
    { paciente_id: pacIds[4], medicamento_id: medIds[4] }, // Ana: Losartán
    { paciente_id: pacIds[5], medicamento_id: medIds[2] }, // Jorge: Omeprazol
    { paciente_id: pacIds[6], medicamento_id: medIds[0] }, // Marta: Enalapril
    { paciente_id: pacIds[7], medicamento_id: medIds[3] }, // Luis: Aspirina
    { paciente_id: pacIds[7], medicamento_id: medIds[4] }, // Luis: Losartán
  ]
  const { error: errMedPac } = await supabase.from("paciente_medicamentos").insert(asignaciones)
  if (errMedPac) return { error: errMedPac }

  // 4. Signos vitales (pacientes 0, 1, 3, 5, 7)
  const signosInsert = []
  for (const idx of [0, 1, 3, 5, 7]) {
    for (const reg of generarSignos(idx)) {
      signosInsert.push({ ...reg, paciente_id: pacIds[idx] })
    }
  }
  const { error: errSignos } = await supabase.from("registro_signos_vitales").insert(signosInsert)
  if (errSignos) return { error: errSignos }

  // 5. Gastos
  const { error: errGastos } = await supabase
    .from("gastos")
    .insert(GASTOS.map(g => ({ ...g, geriatrico_id: geriatricoId })))
  if (errGastos) return { error: errGastos }

  localStorage.setItem(`geri-demo-${geriatricoId}`, "loaded")
  return { error: null }
}

export async function limpiarDemoData(geriatricoId) {
  const { data: pacs } = await supabase
    .from("Pacientes")
    .select("id")
    .eq("geriatrico_id", geriatricoId)

  const pacIds = (pacs || []).map(p => p.id)

  if (pacIds.length > 0) {
    await Promise.all([
      supabase.from("registro_signos_vitales").delete().in("paciente_id", pacIds),
      supabase.from("registro_medicacion_diaria").delete().in("paciente_id", pacIds),
      supabase.from("paciente_medicamentos").delete().in("paciente_id", pacIds),
      supabase.from("amparos").delete().in("paciente_id", pacIds),
      supabase.from("eventos").delete().in("paciente_id", pacIds),
      supabase.from("documentos").delete().in("paciente_id", pacIds),
    ])
    await supabase.from("Pacientes").delete().eq("geriatrico_id", geriatricoId)
  }

  await Promise.all([
    supabase.from("medicamentos").delete().eq("geriatrico_id", geriatricoId),
    supabase.from("gastos").delete().eq("geriatrico_id", geriatricoId),
  ])

  localStorage.removeItem(`geri-demo-${geriatricoId}`)
  return { error: null }
}
