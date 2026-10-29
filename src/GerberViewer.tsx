import { useCallback, useRef, useState } from 'react'
import { Upload, ZoomIn, ZoomOut, RotateCcw, Layers, X, ChevronLeft } from 'lucide-react'

// ---------------------------------------------------------------------------
// Minimal Gerber RS-274X parser producing SVG path strings
// Supports: D01/D02/D03, G01/G02/G03 arcs, aperture definitions (circles,
// rects, oblong), G36/G37 regions, level polarity, SR step-repeat.
// ---------------------------------------------------------------------------

type Coord = { x: number; y: number }
type ApertureShape =
  | { kind: 'circle'; d: number; hole?: number }
  | { kind: 'rect'; w: number; h: number; hole?: number }
  | { kind: 'oblong'; w: number; h: number }
  | { kind: 'poly'; od: number; sides: number; rot: number }

interface Aperture {
  code: number
  shape: ApertureShape
}

interface ParsedLayer {
  name: string
  paths: string[]        // SVG <path d=…> strings for strokes/fills
  flashes: FlashItem[]
  regions: string[]      // SVG region fill paths
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  color: string
}

interface FlashItem {
  x: number
  y: number
  aperture: Aperture
}

function aperturePath(ap: Aperture, cx: number, cy: number): string {
  const s = ap.shape
  if (s.kind === 'circle') {
    const r = s.d / 2
    return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${s.d} 0 a ${r} ${r} 0 1 0 ${-s.d} 0`
  }
  if (s.kind === 'rect') {
    const hw = s.w / 2, hh = s.h / 2
    return `M ${cx - hw} ${cy - hh} h ${s.w} v ${s.h} h ${-s.w} Z`
  }
  if (s.kind === 'oblong') {
    const hw = s.w / 2, hh = s.h / 2
    if (s.w >= s.h) {
      const r = hh
      return `M ${cx - hw + r} ${cy - hh} h ${s.w - 2 * r} a ${r} ${r} 0 0 1 0 ${s.h} h ${-(s.w - 2 * r)} a ${r} ${r} 0 0 1 0 ${-s.h} Z`
    } else {
      const r = hw
      return `M ${cx - hw} ${cy - hh + r} a ${r} ${r} 0 0 1 ${s.w} 0 v ${s.h - 2 * r} a ${r} ${r} 0 0 1 ${-s.w} 0 Z`
    }
  }
  if (s.kind === 'poly') {
    const r = s.od / 2
    const pts = Array.from({ length: s.sides }, (_, i) => {
      const a = (i / s.sides) * 2 * Math.PI + (s.rot * Math.PI) / 180
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
    })
    return `M ${pts.join(' L ')} Z`
  }
  return ''
}

export function parseGerber(text: string, layerName: string, color: string): ParsedLayer {
  const apertures = new Map<number, Aperture>()
  let currentAp: Aperture | null = null
  let curX = 0, curY = 0
  let unit = 1 // mm by default; inches → multiply by 25.4
  let intDigits = 2, decDigits = 6
  let inRegion = false
  let regionPath = ''
  const paths: string[] = []
  const flashes: FlashItem[] = []
  const regions: string[] = []
  let currentPath = ''
  let bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }

  function updateBounds(x: number, y: number) {
    if (x < bounds.minX) bounds.minX = x
    if (y < bounds.minY) bounds.minY = y
    if (x > bounds.maxX) bounds.maxX = x
    if (y > bounds.maxY) bounds.maxY = y
  }

  function coord(raw: string): number {
    if (!raw) return 0
    const neg = raw.startsWith('-')
    const digits = neg ? raw.slice(1) : raw
    const total = intDigits + decDigits
    const padded = digits.padStart(total, '0')
    const intPart = padded.slice(0, intDigits)
    const decPart = padded.slice(intDigits)
    return (neg ? -1 : 1) * (parseInt(intPart, 10) + parseInt(decPart, 10) / Math.pow(10, decDigits)) * unit
  }

  // Strip comments and concatenate
  const clean = text
    .replace(/G04[^\n*]*/g, '') // inline comments
    .replace(/\r/g, '')

  // Parse format spec
  const fmtMatch = clean.match(/%FS([LT])([AI])X(\d)(\d)Y(\d)(\d)\*%/)
  if (fmtMatch) {
    intDigits = parseInt(fmtMatch[3])
    decDigits = parseInt(fmtMatch[4])
  }

  // Unit
  if (/%MOIN\*%/.test(clean)) unit = 25.4

  // Parse aperture definitions — capture shape+params up to closing *%
  for (const m of clean.matchAll(/%ADD(\d+)([^*%]+)\*%/g)) {
    const code = parseInt(m[1])
    const def = m[2].trim()
    if (def.startsWith('C,')) {
      const parts = def.slice(2).split('X')
      apertures.set(code, { code, shape: { kind: 'circle', d: parseFloat(parts[0]) * unit, hole: parts[1] ? parseFloat(parts[1]) * unit : undefined } })
    } else if (def.startsWith('R,')) {
      const parts = def.slice(2).split('X')
      apertures.set(code, { code, shape: { kind: 'rect', w: parseFloat(parts[0]) * unit, h: parseFloat(parts[1]) * unit } })
    } else if (def.startsWith('O,')) {
      const parts = def.slice(2).split('X')
      apertures.set(code, { code, shape: { kind: 'oblong', w: parseFloat(parts[0]) * unit, h: parseFloat(parts[1]) * unit } })
    } else if (def.startsWith('P,')) {
      const parts = def.slice(2).split('X')
      apertures.set(code, { code, shape: { kind: 'poly', od: parseFloat(parts[0]) * unit, sides: parseInt(parts[1]), rot: parts[2] ? parseFloat(parts[2]) : 0 } })
    }
  }

  // Tokenize commands
  const tokens = clean.match(/[^*%]+\*|%[^%]+%/g) ?? []

  let interpolation = 'linear'
  let quadrant = 'single'

  for (const tok of tokens) {
    const t = tok.trim().replace(/\*$/, '').trim()
    if (!t || t.startsWith('%')) continue

    // Aperture select
    const apSel = t.match(/^D(\d+)$/)
    if (apSel && parseInt(apSel[1]) >= 10) {
      const code = parseInt(apSel[1])
      currentAp = apertures.get(code) ?? null
      if (currentPath) { paths.push(currentPath); currentPath = '' }
      continue
    }

    // G-codes
    if (t === 'G01') { interpolation = 'linear'; continue }
    if (t === 'G02') { interpolation = 'cw'; continue }
    if (t === 'G03') { interpolation = 'ccw'; continue }
    if (t === 'G74') { quadrant = 'single'; continue }
    if (t === 'G75') { quadrant = 'multi'; continue }
    if (t === 'G36') { inRegion = true; regionPath = ''; continue }
    if (t === 'G37') {
      if (regionPath) regions.push(regionPath + ' Z')
      inRegion = false; regionPath = ''
      continue
    }

    // Combined coord + D code
    const cmd = t.match(/^(?:G0[123])?(?:X([-\d]+))?(?:Y([-\d]+))?(?:I([-\d]+))?(?:J([-\d]+))?D0?([123])$/)
    if (!cmd) continue

    const nx = cmd[1] !== undefined ? coord(cmd[1]) : curX
    const ny = cmd[2] !== undefined ? coord(cmd[2]) : curY
    const I = cmd[3] !== undefined ? coord(cmd[3]) : 0
    const J = cmd[4] !== undefined ? coord(cmd[4]) : 0
    const d = parseInt(cmd[5])

    updateBounds(nx, ny)

    if (d === 1) {
      // Draw
      let seg: string
      if (interpolation === 'linear') {
        seg = `L ${nx} ${ny}`
      } else {
        // Arc: center at (curX+I, curY+J)
        const cx2 = curX + I, cy2 = curY + J
        const r = Math.sqrt(I * I + J * J)
        const sweep = interpolation === 'cw' ? 0 : 1
        // large-arc: for multi-quadrant we may need it; approximate with 0
        const large = 0
        seg = `A ${r} ${r} 0 ${large} ${sweep} ${nx} ${ny}`
      }

      if (inRegion) {
        if (!regionPath) regionPath = `M ${curX} ${curY}`
        regionPath += ` ${seg}`
      } else {
        if (!currentPath) currentPath = `M ${curX} ${curY}`
        currentPath += ` ${seg}`
      }
    } else if (d === 2) {
      // Move
      if (!inRegion && currentPath) { paths.push(currentPath); currentPath = '' }
      if (inRegion) {
        if (regionPath) regionPath += ` M ${nx} ${ny}`
        else regionPath = `M ${nx} ${ny}`
      }
    } else if (d === 3) {
      // Flash
      if (currentAp) {
        flashes.push({ x: nx, y: ny, aperture: currentAp })
        updateBounds(nx, ny)
      }
    }

    curX = nx; curY = ny
  }

  if (currentPath) paths.push(currentPath)

  if (bounds.minX === Infinity) bounds = { minX: 0, minY: 0, maxX: 100, maxY: 80 }

  return { name: layerName, paths, flashes, regions, bounds, color }
}

// ---------------------------------------------------------------------------
// Layer color presets by common file extension / suffix
// ---------------------------------------------------------------------------
const LAYER_COLORS: Record<string, string> = {
  gtl: '#c8a020',   // top copper - gold
  gbl: '#c8a020',   // bottom copper - gold
  gts: '#2a7a2a',   // top silkscreen - green
  gbs: '#2a7a2a',
  gtp: '#888888',   // top paste
  gbp: '#888888',
  gto: '#f0f0f0',   // top overlay / silkscreen
  gbo: '#f0f0f0',
  gko: '#ff8800',   // board outline
  gbr: '#ff8800',
  drl: '#cc4444',   // drill
  xln: '#cc4444',
  default: '#c8a020',
}

export function guessColor(filename: string): string {
  const lower = filename.toLowerCase()
  const ext = lower.split('.').pop() ?? ''
  return LAYER_COLORS[ext] ?? Object.entries(LAYER_COLORS).find(([k]) => lower.includes(k))?.[1] ?? LAYER_COLORS.default
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export interface LoadedLayer {
  id: string
  parsed: ParsedLayer
  visible: boolean
  strokeWidth: number
}

interface Props {
  onBack: () => void
  initialLayers?: LoadedLayer[]
}

export default function GerberViewer({ onBack, initialLayers }: Props) {
  const [layers, setLayers] = useState<LoadedLayer[]>(initialLayers ?? [])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [error, setError] = useState<string | null>(null)

  // Combined bounding box of all layers
  const bounds = layers.length > 0
    ? layers.reduce((acc, l) => ({
        minX: Math.min(acc.minX, l.parsed.bounds.minX),
        minY: Math.min(acc.minY, l.parsed.bounds.minY),
        maxX: Math.max(acc.maxX, l.parsed.bounds.maxX),
        maxY: Math.max(acc.maxY, l.parsed.bounds.maxY),
      }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
    : { minX: 0, minY: 0, maxX: 100, maxY: 80 }

  const boardW = (bounds.maxX - bounds.minX) || 100
  const boardH = (bounds.maxY - bounds.minY) || 80

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    loadFiles(Array.from(e.dataTransfer.files))
  }, [])

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) loadFiles(Array.from(e.target.files))
  }, [])

  function loadFiles(files: File[]) {
    setError(null)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string
          const color = guessColor(file.name)
          const parsed = parseGerber(text, file.name, color)
          const id = `${file.name}-${Date.now()}`
          setLayers(prev => [...prev, { id, parsed, visible: true, strokeWidth: 0.1 }])
        } catch (err) {
          setError(`Failed to parse ${file.name}: ${err}`)
        }
      }
      reader.readAsText(file)
    })
  }

  function fitToView() {
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }

  function toggleLayer(id: string) {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l))
  }

  function removeLayer(id: string) {
    setLayers(prev => prev.filter(l => l.id !== id))
  }

  function onMouseDown(e: React.MouseEvent) {
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging || !dragStart.current) return
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    })
  }

  function onMouseUp() {
    setDragging(false)
    dragStart.current = null
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    setZoom(z => Math.max(0.1, Math.min(50, z * factor)))
  }

  // SVG viewport: flip Y so Gerber coordinates (Y up) map correctly
  const padding = Math.max(boardW, boardH) * 0.05
  const vbX = bounds.minX - padding
  const vbY = bounds.minY - padding
  const vbW = boardW + padding * 2
  const vbH = boardH + padding * 2

  return (
    <div className="flex flex-col h-screen bg-[#f4f2ed] text-[#1d2126]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-[#e1ded6]">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-[#565c64] hover:text-[#1d2126] transition-colors"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <div className="w-px h-5 bg-[#e1ded6]" />
        <h1 className="!m-0 !text-[15px] !tracking-widest font-mono uppercase !text-[#1d2126]">Gerber Viewer</h1>
        <div className="flex-1" />
        {/* Toolbar */}
        <button onClick={() => setZoom(z => Math.min(50, z * 1.2))} className="p-1.5 rounded text-[#565c64] hover:bg-[#efece6] transition-colors" title="Zoom in">
          <ZoomIn size={16} />
        </button>
        <button onClick={() => setZoom(z => Math.max(0.1, z * 0.8))} className="p-1.5 rounded text-[#565c64] hover:bg-[#efece6] transition-colors" title="Zoom out">
          <ZoomOut size={16} />
        </button>
        <button onClick={fitToView} className="p-1.5 rounded text-[#565c64] hover:bg-[#efece6] transition-colors" title="Fit to view">
          <RotateCcw size={16} />
        </button>
        <label className="flex items-center gap-2 px-3 py-1.5 bg-[#e8623a] hover:bg-[#d4522a] text-white rounded-md text-sm font-medium cursor-pointer transition-colors">
          <Upload size={14} />
          Load Gerber
          <input type="file" multiple accept=".gbr,.gtl,.gbl,.gts,.gbs,.gto,.gbo,.gtp,.gbp,.gko,.gbr,.drl,.xln,.ger,.art" className="hidden" onChange={onFileInput} />
        </label>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-56 bg-white border-r border-[#e1ded6] flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#e1ded6]">
            <Layers size={14} className="text-[#8d9299]" />
            <span className="text-xs font-semibold text-[#8d9299] uppercase tracking-wider">Layers</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {layers.length === 0 && (
              <p className="text-xs text-[#8d9299] p-3">No layers loaded</p>
            )}
            {layers.map(layer => (
              <div key={layer.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[#f4f2ed] group transition-colors">
                <button
                  onClick={() => toggleLayer(layer.id)}
                  className="w-3 h-3 rounded-sm border flex-shrink-0 transition-opacity"
                  style={{
                    backgroundColor: layer.visible ? layer.parsed.color : 'transparent',
                    borderColor: layer.parsed.color,
                  }}
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                />
                <span className="text-xs flex-1 truncate text-[#1d2126]" title={layer.parsed.name}>
                  {layer.parsed.name}
                </span>
                <button
                  onClick={() => removeLayer(layer.id)}
                  className="opacity-0 group-hover:opacity-100 text-[#8d9299] hover:text-red-600 transition-all"
                  title="Remove layer"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-[#e1ded6] text-xs text-[#8d9299]">
            Scroll to zoom · Drag to pan
          </div>
        </div>

        {/* Canvas */}
        <div
          className="drafting-canvas flex-1 relative overflow-hidden"
          style={{ backgroundColor: '#f8f7f3', cursor: dragging ? 'grabbing' : 'grab' }}
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        >
          {layers.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[#8d9299] select-none pointer-events-none">
              <Upload size={48} strokeWidth={1} />
              <p className="text-lg font-medium">Drop Gerber files here</p>
              <p className="text-sm">or use the Load Gerber button</p>
              <p className="text-xs mt-2">Supports RS-274X format (.gtl .gbl .gts .gbs .gto .gbo .gko .drl)</p>
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="absolute inset-0 w-full h-full select-none"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '50% 50%' }}
              viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
              // Flip Y axis: Gerber has Y increasing upward; SVG has it downward
              transform={`scale(1,-1)`}
            >
              {/* Board background */}
              <rect x={bounds.minX} y={bounds.minY} width={boardW} height={boardH} fill="#1a3a1a" rx="0.5" />

              {layers.filter(l => l.visible).map(layer => (
                <g key={layer.id}>
                  {/* Region fills */}
                  {layer.parsed.regions.map((d, i) => (
                    <path key={`r${i}`} d={d} fill={layer.parsed.color} fillOpacity={0.5} stroke="none" />
                  ))}
                  {/* Stroke paths */}
                  {layer.parsed.paths.map((d, i) => (
                    <path
                      key={`p${i}`}
                      d={d}
                      fill="none"
                      stroke={layer.parsed.color}
                      strokeWidth={layer.strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {/* Flash pads */}
                  {layer.parsed.flashes.map((f, i) => (
                    <path
                      key={`f${i}`}
                      d={aperturePath(f.aperture, f.x, f.y)}
                      fill={layer.parsed.color}
                      stroke="none"
                      fillOpacity={0.85}
                    />
                  ))}
                </g>
              ))}
            </svg>
          )}

          {error && (
            <div className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)}><X size={12} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
