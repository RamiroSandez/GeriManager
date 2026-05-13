import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "../services/supabase"
import { logError } from "../utils/log"

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [geriatrico, setGeriatrico] = useState(null)
  const [rol, setRol] = useState(null)
  const [cargando, setCargando] = useState(true)
  const fetchGeriatrico = async (userId) => {
    const { data: ownedList } = await supabase
      .from("geriatricos")
      .select("*")
      .eq("user_id", userId)
      .limit(1)

    const owned = ownedList?.[0] || null
    if (owned) { setGeriatrico(owned); setRol("admin"); return owned }

    const { data: membership } = await supabase
      .from("miembros_geriatrico")
      .select("rol, geriatrico_id, geriatricos(*)")
      .eq("user_id", userId)
      .maybeSingle()

    if (membership?.geriatricos) {
      setGeriatrico(membership.geriatricos)
      setRol(membership.rol)
      return membership.geriatricos
    }

    setGeriatrico(null)
    setRol(null)
    return null
  }


  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchGeriatrico(session.user.id)
            .catch(() => {})
            .finally(() => setCargando(false))
        } else {
          setCargando(false)
        }
      })
      .catch(() => setCargando(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchGeriatrico(session.user.id).catch(() => {})
      } else {
        setGeriatrico(null)
        setRol(null)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loginConEmail = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const recuperarPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const crearGeriatrico = async ({ nombreGeriatrico, nombreDirector, telefono }) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { error: new Error("No hay sesión activa") }

    const { error } = await supabase.from("geriatricos").insert({
      user_id: currentUser.id,
      nombre: nombreGeriatrico,
      nombre_director: nombreDirector,
      telefono: telefono || null,
    })
    if (error) {
      logError("crear_geriatrico", error.message, { userId: currentUser.id })
      return { error }
    }

    const geriatricoCreado = await fetchGeriatrico(currentUser.id)
    if (!geriatricoCreado) {
      logError("crear_geriatrico_fetch", "Geriátrico insertado pero no encontrado al releer", { userId: currentUser.id })
    }
    return { error: null }
  }

  const aceptarInvitacion = async (invitacion) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { error: new Error("No hay sesión activa") }

    const { error: errorMember } = await supabase.from("miembros_geriatrico").insert({
      geriatrico_id: invitacion.geriatrico_id,
      user_id: currentUser.id,
      rol: invitacion.rol,
      nombre: currentUser.user_metadata?.full_name || null,
      email: currentUser.email,
    })
    if (errorMember) return { error: errorMember }

    await supabase.from("invitaciones").update({ aceptada: true }).eq("id", invitacion.id)
    await fetchGeriatrico(currentUser.id)
    return { error: null }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setGeriatrico(null)
    setRol(null)
  }

  const refreshGeriatrico = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (currentUser) await fetchGeriatrico(currentUser.id)
  }

  const setupPendiente = !cargando && !!user && !geriatrico

  return (
    <AuthContext.Provider value={{ user, geriatrico, rol, cargando, setupPendiente, loginConEmail, recuperarPassword, crearGeriatrico, aceptarInvitacion, logout, refreshGeriatrico }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
