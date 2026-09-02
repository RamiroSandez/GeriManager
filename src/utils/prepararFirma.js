const UMBRAL_FONDO = 235 // pixeles mas claros que esto se consideran fondo blanco
const PADDING = 15

// Recorta la imagen al area donde hay trazo y vuelve transparente el fondo claro,
// para que la firma no quede perdida en un lienzo en blanco ni con un recuadro blanco.
export async function prepararFirma(file) {
  const img = await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = URL.createObjectURL(file)
  })

  const full = document.createElement("canvas")
  full.width = img.width
  full.height = img.height
  const fullCtx = full.getContext("2d")
  fullCtx.drawImage(img, 0, 0)

  const imgData = fullCtx.getImageData(0, 0, full.width, full.height)
  const data = imgData.data

  let minX = full.width, minY = full.height, maxX = 0, maxY = 0

  for (let y = 0; y < full.height; y++) {
    for (let x = 0; x < full.width; x++) {
      const i = (y * full.width + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      const esFondo = a < 10 || (r > UMBRAL_FONDO && g > UMBRAL_FONDO && b > UMBRAL_FONDO)
      if (esFondo) {
        data[i + 3] = 0
      } else {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    URL.revokeObjectURL(img.src)
    return file // no se detecto trazo, dejamos el archivo original tal cual
  }

  fullCtx.putImageData(imgData, 0, 0)

  minX = Math.max(0, minX - PADDING)
  minY = Math.max(0, minY - PADDING)
  maxX = Math.min(full.width, maxX + PADDING)
  maxY = Math.min(full.height, maxY + PADDING)

  const recorte = document.createElement("canvas")
  recorte.width = maxX - minX
  recorte.height = maxY - minY
  recorte.getContext("2d").drawImage(full, minX, minY, recorte.width, recorte.height, 0, 0, recorte.width, recorte.height)

  URL.revokeObjectURL(img.src)

  const blob = await new Promise(resolve => recorte.toBlob(resolve, "image/png"))
  return new File([blob], "firma.png", { type: "image/png" })
}
