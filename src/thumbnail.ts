// Rasterizes the live editor SVG into a PNG data URL so gallery/project
// thumbnails are pixel-accurate screenshots of the real board, not a
// separately maintained re-implementation of the renderer.

const THUMB_WIDTH = 340

// The live canvas SVG pads the board asymmetrically (full margin on top,
// a thin gap at the bottom) so the front/back cards stack tightly. For a
// standalone thumbnail we instead crop tightly to the board's own bounding
// box with no padding, so the board fills the thumbnail edge-to-edge like
// a card photo.
export async function svgToThumbnail(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('width')
  clone.removeAttribute('height')

  // The board rect's own clipPath is a sibling of the content <g> (both
  // children of <svg>), not an ancestor — so the board's on-screen position
  // has to come from the <g data-board-group> that actually draws the board,
  // marked explicitly since it can't be found by walking up from the clipPath.
  const boardClipRect = svg.querySelector<SVGRectElement>('clipPath#boardClip rect')
  const boardGroup = svg.querySelector<SVGGElement>('g[data-board-group]')
  let width: number
  let height: number

  if (boardClipRect && boardGroup) {
    const boardW = boardClipRect.width.baseVal.value
    const boardH = boardClipRect.height.baseVal.value
    const rx = boardClipRect.rx.baseVal.value
    const ry = boardClipRect.ry.baseVal.value
    const transform = boardGroup.transform.baseVal.consolidate()
    const tx = transform ? transform.matrix.e : 0
    const ty = transform ? transform.matrix.f : 0
    width = boardW
    height = boardH
    clone.setAttribute('viewBox', `${tx} ${ty} ${width} ${height}`)

    // Clip to the board's own rounded-rect shape so corners don't show the
    // page background, and drop the editor-only outline stroke that reads
    // as a thick border/margin once rasterized at thumbnail scale.
    const clonedGroup = clone.querySelector<SVGGElement>('g[data-board-group]')
    if (clonedGroup) {
      const cropClipId = 'thumbCrop'
      const clipPath = clone.ownerDocument!.createElementNS('http://www.w3.org/2000/svg', 'clipPath')
      clipPath.setAttribute('id', cropClipId)
      const clipRect = clone.ownerDocument!.createElementNS('http://www.w3.org/2000/svg', 'rect')
      clipRect.setAttribute('x', '0'); clipRect.setAttribute('y', '0')
      clipRect.setAttribute('width', String(boardW)); clipRect.setAttribute('height', String(boardH))
      clipRect.setAttribute('rx', String(rx)); clipRect.setAttribute('ry', String(ry))
      clipPath.appendChild(clipRect)
      clone.querySelector('defs')?.appendChild(clipPath)
      clonedGroup.setAttribute('clip-path', `url(#${cropClipId})`)
      clonedGroup.querySelectorAll('rect[stroke]').forEach(r => r.removeAttribute('stroke'))
    }
  } else {
    const viewBox = svg.viewBox.baseVal
    width = viewBox && viewBox.width ? viewBox.width : svg.clientWidth
    height = viewBox && viewBox.height ? viewBox.height : svg.clientHeight
  }
  if (!width || !height) throw new Error('SVG has no intrinsic size')

  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
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
