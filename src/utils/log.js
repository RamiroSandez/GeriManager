import { supabase } from "../services/supabase"

export async function logError(contexto, mensaje, { geriatricoId, userId } = {}) {
  await supabase.from("logs").insert({
    nivel: "error",
    contexto,
    mensaje: typeof mensaje === "string" ? mensaje : JSON.stringify(mensaje),
    geriatrico_id: geriatricoId || null,
    user_id: userId || null,
  })
}

export async function logInfo(contexto, mensaje, { geriatricoId, userId } = {}) {
  await supabase.from("logs").insert({
    nivel: "info",
    contexto,
    mensaje: typeof mensaje === "string" ? mensaje : JSON.stringify(mensaje),
    geriatrico_id: geriatricoId || null,
    user_id: userId || null,
  })
}
