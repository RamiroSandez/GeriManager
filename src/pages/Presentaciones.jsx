import { useState } from "react"
import {
  Box, Button, Card, FieldLabel, FieldRoot,
  Heading, HStack, Input, NativeSelect, Stack, Text, Textarea,
} from "@chakra-ui/react"
import { Toaster, toaster } from "../components/toaster"
import { generarPdfCombinado, descargarBytesComoPdf } from "../utils/combinarPdf"

const entradaVacia = () => ({
  id: crypto.randomUUID(),
  etiqueta: "",
  facturaFile: null,
  constanciaTipo: "imagen",
  constanciaFile: null,
  constanciaTexto: "",
})

const MENSAJE_PLACEHOLDER =
  "Estimados, deben presentar la factura en la UGL correspondiente, en este caso la UGL CABA.\nSaludos."

const fileInputStyle = {
  fontSize: "13px",
  padding: "6px",
  width: "100%",
  borderRadius: "8px",
  border: "1px solid var(--chakra-colors-border-subtle, #e2e8f0)",
  background: "var(--chakra-colors-bg-panel, white)",
}

export default function Presentaciones() {
  const [nombreArchivo, setNombreArchivo] = useState("")
  const [entradas, setEntradas] = useState(() => [entradaVacia()])
  const [generando, setGenerando] = useState(false)

  const setCampo = (id, campo, val) =>
    setEntradas(prev => prev.map(e => e.id === id ? { ...e, [campo]: val } : e))

  const agregarEntrada = () => setEntradas(prev => [...prev, entradaVacia()])
  const quitarEntrada = (id) => setEntradas(prev => prev.filter(e => e.id !== id))

  const generar = async () => {
    const sinFactura = entradas.some(e => !e.facturaFile)
    if (sinFactura) {
      toaster.create({ title: "Falta subir la factura en alguna entrada", type: "warning", duration: 3000 })
      return
    }
    setGenerando(true)
    try {
      const bytes = await generarPdfCombinado(entradas)
      descargarBytesComoPdf(bytes, `${nombreArchivo.trim() || "Presentacion"}.pdf`)
      toaster.create({ title: "PDF combinado generado", type: "success", duration: 2500 })
    } catch (err) {
      toaster.create({ title: "Error al generar el PDF", description: err.message, type: "error", duration: 5000 })
    }
    setGenerando(false)
  }

  return (
    <Box px={6} py={6}>
      <Toaster />

      <Box mb={6}>
        <Heading size="lg" color="text.main">Presentaciones</Heading>
        <Text fontSize="sm" color="text.muted">
          Uní cada factura con su constancia de presentación en un solo PDF, listo para enviar.
        </Text>
      </Box>

      <Card.Root borderRadius="xl" boxShadow="md">
        <Card.Body>
          <FieldRoot mb={5} maxW="360px">
            <FieldLabel fontSize="sm">Nombre del archivo a descargar</FieldLabel>
            <Input
              value={nombreArchivo}
              onChange={e => setNombreArchivo(e.target.value)}
              placeholder="Ej: Barrionuevo Olga - Presentación"
              bg="bg.muted"
            />
          </FieldRoot>

          <Stack gap={4}>
            {entradas.map((e, i) => (
              <Box key={e.id} p={4} border="1px solid" borderColor="border.subtle" borderRadius="lg" bg="bg.muted">
                <HStack justify="space-between" mb={3}>
                  <Text fontSize="sm" fontWeight="700" color="teal.600">Factura {i + 1}</Text>
                  {entradas.length > 1 && (
                    <Button size="xs" variant="ghost" colorPalette="red" onClick={() => quitarEntrada(e.id)}>
                      Quitar
                    </Button>
                  )}
                </HStack>

                <Stack gap={3}>
                  <FieldRoot>
                    <FieldLabel fontSize="sm">Etiqueta (opcional, solo para tu referencia)</FieldLabel>
                    <Input
                      size="sm" bg="bg.panel" placeholder="Ej: Diciembre 2025"
                      value={e.etiqueta}
                      onChange={ev => setCampo(e.id, "etiqueta", ev.target.value)}
                    />
                  </FieldRoot>

                  <FieldRoot required>
                    <FieldLabel fontSize="sm">PDF de la factura (ARCA)</FieldLabel>
                    <input
                      type="file" accept="application/pdf" style={fileInputStyle}
                      onChange={ev => setCampo(e.id, "facturaFile", ev.target.files[0] || null)}
                    />
                  </FieldRoot>

                  <FieldRoot>
                    <FieldLabel fontSize="sm">Constancia de presentación</FieldLabel>
                    <NativeSelect.Root size="sm">
                      <NativeSelect.Field
                        value={e.constanciaTipo}
                        onChange={ev => setCampo(e.id, "constanciaTipo", ev.target.value)}
                        bg="bg.panel"
                      >
                        <option value="imagen">Subir captura / PDF</option>
                        <option value="texto">Escribir el mensaje</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </FieldRoot>

                  {e.constanciaTipo === "imagen" ? (
                    <input
                      type="file" accept="image/*,application/pdf" style={fileInputStyle}
                      onChange={ev => setCampo(e.id, "constanciaFile", ev.target.files[0] || null)}
                    />
                  ) : (
                    <Textarea
                      size="sm" bg="bg.panel" rows={3}
                      placeholder={MENSAJE_PLACEHOLDER}
                      value={e.constanciaTexto}
                      onChange={ev => setCampo(e.id, "constanciaTexto", ev.target.value)}
                    />
                  )}
                </Stack>
              </Box>
            ))}

            <Button size="sm" variant="ghost" colorPalette="teal" alignSelf="flex-start" onClick={agregarEntrada}>
              + Agregar factura
            </Button>
          </Stack>

          <Button mt={6} colorPalette="teal" onClick={generar} loading={generando}>
            Generar PDF combinado
          </Button>
        </Card.Body>
      </Card.Root>
    </Box>
  )
}
