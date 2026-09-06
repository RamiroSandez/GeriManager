const fechaHoy = () => new Date().toLocaleDateString("es-AR")

const paginaTexto = (texto) => `
  <!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12pt; color: #111; margin: 0; padding: 56px 48px; line-height: 1.8; }
    .fecha { text-align: right; font-size: 10pt; color: #444; margin-bottom: 28px; }
    .mensaje { white-space: pre-wrap; }
  </style></head><body>
    <div class="fecha">${fechaHoy()}</div>
    <div class="mensaje">${texto}</div>
  </body></html>
`

const PDF_OPTS_TEXTO = {
  margin: 0,
  image: { type: "jpeg", quality: 0.98 },
  html2canvas: { scale: 2 },
  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
}

async function textoAPdfBytes(texto) {
  const html2pdf = (await import("html2pdf.js")).default
  const container = document.createElement("div")
  container.innerHTML = paginaTexto(texto)
  const pdf = await html2pdf().set(PDF_OPTS_TEXTO).from(container).toPdf().get("pdf")
  return pdf.output("arraybuffer")
}

// Nuestros propios PDFs generados (nunca vienen encriptados) se pueden copiar tal cual.
async function copiarPaginasDePdf(PDFDocument, mergedDoc, bytes) {
  const doc = await PDFDocument.load(bytes)
  const paginas = await mergedDoc.copyPages(doc, doc.getPageIndices())
  paginas.forEach(p => mergedDoc.addPage(p))
}

async function agregarImagenBytesComoPagina(mergedDoc, bytes, esPng) {
  const img = esPng ? await mergedDoc.embedPng(bytes) : await mergedDoc.embedJpg(bytes)

  const pagina = mergedDoc.addPage([595.28, 841.89]) // A4 en puntos
  const { width: pw, height: ph } = pagina.getSize()
  const margen = 40
  const maxW = pw - margen * 2
  const maxH = ph - margen * 2
  const escala = Math.min(maxW / img.width, maxH / img.height, 1)
  const w = img.width * escala
  const h = img.height * escala
  pagina.drawImage(img, {
    x: (pw - w) / 2,
    y: (ph - h) / 2,
    width: w,
    height: h,
  })
}

async function agregarImagenArchivoComoPagina(mergedDoc, file) {
  const bytes = await file.arrayBuffer()
  await agregarImagenBytesComoPagina(mergedDoc, bytes, file.type === "image/png")
}

// PDFs subidos por el usuario (ej: facturas de ARCA) pueden venir encriptados/protegidos.
// pdf-lib no sabe desencriptar el contenido de esas paginas, asi que las renderizamos
// con pdf.js (que si soporta PDFs protegidos) y las insertamos como imagen.
async function rasterizarPdfYAgregar(mergedDoc, bytes, soloPrimeraPagina = false) {
  const pdfjsLib = await import("pdfjs-dist")
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
  const totalPaginas = soloPrimeraPagina ? 1 : pdf.numPages
  for (let i = 1; i <= totalPaginas; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92))
    const imgBytes = await blob.arrayBuffer()
    await agregarImagenBytesComoPagina(mergedDoc, imgBytes, false)
  }
}

// entradas: [{ facturaFile, constanciaTipo: "imagen" | "texto", constanciaFile, constanciaTexto }]
export async function generarPdfCombinado(entradas) {
  const { PDFDocument } = await import("pdf-lib")
  const mergedDoc = await PDFDocument.create()

  for (const entrada of entradas) {
    if (entrada.facturaFile) {
      const bytes = await entrada.facturaFile.arrayBuffer()
      // La factura de ARCA trae Original/Duplicado/Triplicado; solo nos interesa la primera pagina.
      await rasterizarPdfYAgregar(mergedDoc, bytes, true)
    }

    if (entrada.constanciaTipo === "imagen" && entrada.constanciaFile) {
      if (entrada.constanciaFile.type === "application/pdf") {
        const bytes = await entrada.constanciaFile.arrayBuffer()
        await rasterizarPdfYAgregar(mergedDoc, bytes)
      } else {
        await agregarImagenArchivoComoPagina(mergedDoc, entrada.constanciaFile)
      }
    } else if (entrada.constanciaTipo === "texto" && entrada.constanciaTexto?.trim()) {
      const bytes = await textoAPdfBytes(entrada.constanciaTexto.trim())
      await copiarPaginasDePdf(PDFDocument, mergedDoc, bytes)
    }
  }

  return mergedDoc.save()
}

export function descargarBytesComoPdf(bytes, nombreArchivo) {
  const blob = new Blob([bytes], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}
