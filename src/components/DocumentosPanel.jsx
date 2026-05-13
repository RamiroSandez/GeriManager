import { useState, useEffect, useRef } from "react"
import { supabase } from "../services/supabase"
import {
  Box,
  Button,
  Card,
  FieldLabel,
  FieldRoot,
  HStack,
  NativeSelect,
  Spinner,
  Stack,
  Badge,
  Text,
  Textarea,
} from "@chakra-ui/react"
import { toaster } from "./toaster"
import { TIPOS_DOCUMENTO, COLOR_TIPO_DOCUMENTO } from "../utils/constants"

export default function DocumentosPanel({ pacienteId }) {
  const [documentos, setDocumentos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [tipoSeleccionado, setTipoSeleccionado] = useState("dni")
  const [notasDoc, setNotasDoc] = useState("")
  const fileInputRef = useRef()

  const fetchDocumentos = async () => {
    const { data, error } = await supabase
      .from("documentos")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("subido_at", { ascending: false })
    if (!error) setDocumentos(data || [])
    setCargando(false)
  }

  useEffect(() => { fetchDocumentos() }, [pacienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setSubiendo(true)
    const ext = file.name.split(".").pop()
    const filePath = `${pacienteId}/${tipoSeleccionado}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(filePath, file)

    if (uploadError) {
      toaster.create({ title: "Error al subir archivo", description: uploadError.message, type: "error", duration: 4000 })
      setSubiendo(false)
      fileInputRef.current.value = ""
      return
    }

    const { error: dbError } = await supabase.from("documentos").insert({
      paciente_id: pacienteId,
      tipo: tipoSeleccionado,
      nombre_archivo: file.name,
      storage_path: filePath,
      notas: notasDoc || null,
    })

    if (dbError) {
      toaster.create({ title: "Error al registrar documento", description: dbError.message, type: "error", duration: 4000 })
    } else {
      await supabase.from("eventos").insert({
        paciente_id: pacienteId,
        tipo: "documento_subido",
        descripcion: `Documento subido: ${TIPOS_DOCUMENTO[tipoSeleccionado]} — ${file.name}`,
      })
      toaster.create({ title: "Documento subido correctamente", type: "success", duration: 3000 })
      setNotasDoc("")
      fetchDocumentos()
    }

    setSubiendo(false)
    fileInputRef.current.value = ""
  }

  const eliminarDocumento = async (doc) => {
    const { error: storageError } = await supabase.storage
      .from("documentos")
      .remove([doc.storage_path])

    if (storageError) {
      toaster.create({ title: "Error al eliminar archivo", description: storageError.message, type: "error", duration: 4000 })
      return
    }

    await supabase.from("documentos").delete().eq("id", doc.id)
    toaster.create({ title: "Documento eliminado", type: "success", duration: 3000 })
    fetchDocumentos()
  }

  const getPublicUrl = (path) => {
    const { data } = supabase.storage.from("documentos").getPublicUrl(path)
    return data.publicUrl
  }

  return (
    <Stack gap={5}>
      {/* Sección de carga */}
      <Card.Root borderRadius="lg" bg="bg.hover" border="1px solid" borderColor="border.subtle">
        <Card.Body>
          <Text fontWeight="600" mb={3} color="teal.600">Subir nuevo documento</Text>
          <Stack gap={3}>
            <FieldRoot>
              <FieldLabel fontSize="sm">Tipo de documento</FieldLabel>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={tipoSeleccionado}
                  onChange={e => setTipoSeleccionado(e.target.value)}
                  bg="bg.panel"
                >
                  {Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </FieldRoot>
            <FieldRoot>
              <FieldLabel fontSize="sm">Notas (opcional)</FieldLabel>
              <Textarea
                value={notasDoc}
                onChange={e => setNotasDoc(e.target.value)}
                placeholder="Observaciones sobre este documento..."
                rows={2}
                bg="bg.panel"
              />
            </FieldRoot>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleUpload}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
            <Button
              colorPalette="teal"
              alignSelf="flex-start"
              loading={subiendo}
              onClick={() => fileInputRef.current?.click()}
            >
              Seleccionar archivo y subir
            </Button>
          </Stack>
        </Card.Body>
      </Card.Root>

      {/* Lista de documentos */}
      <Box>
        <Text fontWeight="600" mb={3}>
          Documentos subidos ({documentos.length})
        </Text>
        {cargando ? (
          <Box display="flex" justifyContent="center" py={6}>
            <Spinner color="teal.500" />
          </Box>
        ) : documentos.length === 0 ? (
          <Text color="text.faint" textAlign="center" py={8}>
            No hay documentos subidos aún.
          </Text>
        ) : (
          <Stack gap={2}>
            {documentos.map(doc => (
              <HStack
                key={doc.id}
                p={3}
                bg="bg.panel"
                borderRadius="lg"
                border="1px solid"
                borderColor="border.subtle"
                boxShadow="xs"
                justify="space-between"
                flexWrap="wrap"
                gap={2}
              >
                <HStack gap={3}>
                  <Badge
                    colorPalette={COLOR_TIPO_DOCUMENTO[doc.tipo] || "gray"}
                    variant="subtle"
                    borderRadius="md"
                    px={2}
                    fontSize="xs"
                    whiteSpace="nowrap"
                  >
                    {TIPOS_DOCUMENTO[doc.tipo] || doc.tipo}
                  </Badge>
                  <Box>
                    <Text fontSize="sm" fontWeight="500">{doc.nombre_archivo}</Text>
                    {doc.notas && (
                      <Text fontSize="xs" color="text.muted">{doc.notas}</Text>
                    )}
                    <Text fontSize="xs" color="text.faint">
                      {new Date(doc.subido_at).toLocaleDateString("es-AR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                      })}
                    </Text>
                  </Box>
                </HStack>
                <HStack gap={2}>
                  <Button
                    size="xs"
                    variant="outline"
                    colorPalette="teal"
                    onClick={() => window.open(getPublicUrl(doc.storage_path), "_blank")}
                  >
                    Ver
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    colorPalette="red"
                    onClick={() => eliminarDocumento(doc)}
                  >
                    Eliminar
                  </Button>
                </HStack>
              </HStack>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  )
}
