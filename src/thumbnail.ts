// Rasterizes the live editor SVG into a PNG data URL so gallery/project
// thumbnails are pixel-accurate screenshots of the real board, not a
// separately maintained re-implementation of the renderer.

const THUMB_WIDTH = 340

export async function svgToThumbnail(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('width')
  clone.removeAttribute('height')

  const viewBox = svg.viewBox.baseVal
  const width = viewBox && viewBox.width ? viewBox.width : svg.clientWidth
  const height = viewBox && viewBox.height ? viewBox.height : svg.clientHeight
  if (!width || !height) throw new Error('SVG has no intrinsic size')

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const xml = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Failed to rasterize SVG'))
      image.src = url
    })

    const scale = THUMB_WIDTH / width
    const canvas = document.createElement('canvas')
    canvas.width = THUMB_WIDTH
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}
