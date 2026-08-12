import { BOARD_COLORS, type BoardColorKey } from './colors'
import { type PCBProject } from './pcb-card-editor'
import { saveProject } from './projectStore'

interface Props {
  onBack: () => void
  onEdit: () => void
  onOpenProject: (project: PCBProject) => void
}

interface GalleryEntry {
  project: PCBProject
  authorName: string
  authorRole: string
}

function normalizeLayersForThumb(project: PCBProject): PCBProject {
  return {
    ...project,
    elements: project.elements.map((e: any) => {
      if (e.layer === 'top') return { ...e, layer: e.type === 'text' ? 'topSilk' : 'topCopper' }
      if (e.layer === 'bottom') return { ...e, layer: 'bottomCopper' }
      return e
    }),
  }
}

let _id = 1
const uid = () => String(_id++)

const GALLERY: GalleryEntry[] = [
  {
    authorName: 'Ada Lovelace', authorRole: 'Firmware Engineer',
    project: {
      version: 1, board: { width: 85, height: 54, corner: 3 }, boardColorKey: 'green',
      elements: [
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 16, content: 'Ada Lovelace', font: 'sans', size: 4 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 23, content: 'Firmware Engineer', font: 'sans', size: 2.5 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 38, content: 'ada@lovelace.io', font: 'mono', size: 2 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 43, content: 'github.com/ada', font: 'mono', size: 2 },
        { id: uid(), type: 'trace', layer: 'top', points: [{ x: 5, y: 5 }, { x: 40, y: 5 }, { x: 40, y: 25 }], width: 0.3 },
        { id: uid(), type: 'trace', layer: 'top', points: [{ x: 40, y: 25 }, { x: 80, y: 25 }], width: 0.3 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 14, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 18, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 22, shape: 'rect', w: 1.6, h: 1.2 },
      ],
    },
  },
  {
    authorName: 'Max Planck', authorRole: 'RF / Antenna Design',
    project: {
      version: 1, board: { width: 85, height: 54, corner: 3 }, boardColorKey: 'blue',
      elements: [
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 16, content: 'Max Planck', font: 'sans', size: 4 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 23, content: 'RF / Antenna Design', font: 'sans', size: 2.5 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 38, content: 'max@planck.dev', font: 'mono', size: 2 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 43, content: 'planck-rf.com', font: 'mono', size: 2 },
        { id: uid(), type: 'trace', layer: 'top', points: [{ x: 8, y: 8 }, { x: 8, y: 46 }], width: 0.3 },
        { id: uid(), type: 'trace', layer: 'top', points: [{ x: 8, y: 27 }, { x: 77, y: 27 }], width: 0.3 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 14, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 18, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 22, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 26, shape: 'rect', w: 1.6, h: 1.2 },
      ],
    },
  },
  {
    authorName: 'Lise Meitner', authorRole: 'PCB Layout Artist',
    project: {
      version: 1, board: { width: 85, height: 54, corner: 3 }, boardColorKey: 'black',
      elements: [
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 16, content: 'Lise Meitner', font: 'sans', size: 4 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 23, content: 'PCB Layout Artist', font: 'sans', size: 2.5 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 38, content: 'lise@meitner.io', font: 'mono', size: 2 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 43, content: 'meitner.design', font: 'mono', size: 2 },
        { id: uid(), type: 'trace', layer: 'top', points: [{ x: 5, y: 49 }, { x: 60, y: 49 }, { x: 60, y: 5 }, { x: 80, y: 5 }], width: 0.3 },
        { id: uid(), type: 'trace', layer: 'bottom', points: [{ x: 5, y: 5 }, { x: 30, y: 5 }, { x: 30, y: 49 }], width: 0.3 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 14, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 18, shape: 'rect', w: 1.6, h: 1.2 },
      ],
    },
  },
  {
    authorName: 'Nikola Tesla', authorRole: 'Power Electronics',
    project: {
      version: 1, board: { width: 85, height: 54, corner: 3 }, boardColorKey: 'red',
      elements: [
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 16, content: 'Nikola Tesla', font: 'sans', size: 4 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 23, content: 'Power Electronics', font: 'sans', size: 2.5 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 38, content: 'nikola@tesla.dev', font: 'mono', size: 2 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 43, content: 'tesla-power.io', font: 'mono', size: 2 },
        { id: uid(), type: 'trace', layer: 'top', points: [{ x: 5, y: 35 }, { x: 35, y: 35 }, { x: 35, y: 8 }, { x: 80, y: 8 }], width: 0.5 },
        { id: uid(), type: 'trace', layer: 'top', points: [{ x: 5, y: 46 }, { x: 70, y: 46 }], width: 0.5 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 14, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 18, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 22, shape: 'rect', w: 1.6, h: 1.2 },
      ],
    },
  },
  {
    authorName: 'Grace Hopper', authorRole: 'Systems Programmer',
    project: {
      version: 1, board: { width: 85, height: 54, corner: 3 }, boardColorKey: 'purple',
      elements: [
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 16, content: 'Grace Hopper', font: 'sans', size: 4 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 23, content: 'Systems Programmer', font: 'sans', size: 2.5 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 38, content: 'grace@hopper.io', font: 'mono', size: 2 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 43, content: 'hopper.systems', font: 'mono', size: 2 },
        { id: uid(), type: 'trace', layer: 'top', points: [{ x: 5, y: 32 }, { x: 55, y: 32 }, { x: 55, y: 49 }], width: 0.3 },
        { id: uid(), type: 'trace', layer: 'bottom', points: [{ x: 5, y: 8 }, { x: 75, y: 8 }], width: 0.3 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 14, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 18, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 22, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 26, shape: 'rect', w: 1.6, h: 1.2 },
      ],
    },
  },
  {
    authorName: 'Alan Turing', authorRole: 'Digital Logic',
    project: {
      version: 1, board: { width: 85, height: 54, corner: 3 }, boardColorKey: 'yellow',
      elements: [
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 16, content: 'Alan Turing', font: 'sans', size: 4 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 23, content: 'Digital Logic', font: 'sans', size: 2.5 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 38, content: 'alan@turing.dev', font: 'mono', size: 2 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 43, content: 'turing.computer', font: 'mono', size: 2 },
        { id: uid(), type: 'trace', layer: 'top', points: [{ x: 22, y: 5 }, { x: 22, y: 49 }], width: 0.3 },
        { id: uid(), type: 'trace', layer: 'top', points: [{ x: 22, y: 27 }, { x: 75, y: 27 }, { x: 75, y: 49 }], width: 0.3 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 14, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 18, shape: 'rect', w: 1.6, h: 1.2 },
      ],
    },
  },
  {
    authorName: 'Claude Shannon', authorRole: 'Signal Integrity',
    project: {
      version: 1, board: { width: 85, height: 54, corner: 3 }, boardColorKey: 'white',
      elements: [
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 16, content: 'Claude Shannon', font: 'sans', size: 4 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 23, content: 'Signal Integrity', font: 'sans', size: 2.5 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 38, content: 'claude@shannon.io', font: 'mono', size: 2 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 43, content: 'shannon.signals', font: 'mono', size: 2 },
        { id: uid(), type: 'trace', layer: 'top', points: [{ x: 5, y: 20 }, { x: 40, y: 20 }, { x: 40, y: 46 }, { x: 80, y: 46 }], width: 0.3 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 14, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 18, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 22, shape: 'rect', w: 1.6, h: 1.2 },
      ],
    },
  },
  {
    authorName: 'Hedy Lamarr', authorRole: 'Wireless Systems',
    project: {
      version: 1, board: { width: 85, height: 54, corner: 3 }, boardColorKey: 'green',
      elements: [
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 16, content: 'Hedy Lamarr', font: 'sans', size: 4 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 23, content: 'Wireless Systems', font: 'sans', size: 2.5 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 38, content: 'hedy@lamarr.dev', font: 'mono', size: 2 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 43, content: 'lamarr-wireless.io', font: 'mono', size: 2 },
        { id: uid(), type: 'trace', layer: 'top', points: [{ x: 10, y: 10 }, { x: 75, y: 10 }, { x: 75, y: 46 }], width: 0.3 },
        { id: uid(), type: 'trace', layer: 'bottom', points: [{ x: 5, y: 46 }, { x: 50, y: 46 }, { x: 50, y: 10 }], width: 0.3 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 18, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 22, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 26, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 30, shape: 'rect', w: 1.6, h: 1.2 },
      ],
    },
  },
  {
    authorName: 'John von Neumann', authorRole: 'Architecture',
    project: {
      version: 1, board: { width: 85, height: 54, corner: 3 }, boardColorKey: 'black',
      elements: [
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 16, content: 'John von Neumann', font: 'sans', size: 4 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 23, content: 'Architecture', font: 'sans', size: 2.5 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 38, content: 'john@vonneumann.io', font: 'mono', size: 2 },
        { id: uid(), type: 'text', layer: 'top', x: 14, y: 43, content: 'vonneumann.arch', font: 'mono', size: 2 },
        { id: uid(), type: 'trace', layer: 'top', points: [{ x: 5, y: 40 }, { x: 38, y: 40 }, { x: 38, y: 8 }, { x: 80, y: 8 }], width: 0.3 },
        { id: uid(), type: 'trace', layer: 'bottom', points: [{ x: 5, y: 8 }, { x: 20, y: 8 }, { x: 20, y: 46 }, { x: 60, y: 46 }], width: 0.3 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 14, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 18, shape: 'rect', w: 1.6, h: 1.2 },
        { id: uid(), type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 22, shape: 'rect', w: 1.6, h: 1.2 },
      ],
    },
  },
]

// ── Thumbnail rendered from real project data ──────────────────────────────

const LAYER_COLORS: Record<string, string> = {
  topCopper: '', bottomCopper: '', topSilk: '', bottomSilk: '',
}

function CardThumb({ entry }: { entry: GalleryEntry }) {
  const { project, authorName } = entry
  const bc = BOARD_COLORS.find(c => c.key === project.boardColorKey)!
  const isLight = project.boardColorKey === 'white' || project.boardColorKey === 'yellow'
  const silkColor = isLight ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.88)'

  const glowMap: Record<string, string> = {
    green: '#0d9e5270', blue: '#1a5cd470', black: '#6b6e7150',
    red: '#d4444470', purple: '#a80d9070', yellow: '#c8b40470', white: '#cccccc50',
  }

  // scale: board is 85×54mm, thumbnail viewBox is 170×108 (×2)
  const S = 2
  const W = 85 * S
  const H = 54 * S

  const traces = project.elements.filter((e: any) => e.type === 'trace')
  const pads = project.elements.filter((e: any) => e.type === 'pad')
  const texts = project.elements.filter((e: any) => e.type === 'text')

  return (
    <div className="gallery-card" style={{
      background: bc.fill,
      boxShadow: `0 0 14px 2px ${glowMap[project.boardColorKey]}, 0 0 36px 4px ${glowMap[project.boardColorKey]}55`,
    }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* dot grid */}
        {Array.from({ length: 12 }, (_, row) =>
          Array.from({ length: 20 }, (_, col) => (
            <circle key={`${row}-${col}`}
              cx={col * 9 + 5} cy={row * 9 + 5} r="1"
              fill={bc.dot} opacity="0.45" />
          ))
        )}

        {/* bottom copper traces */}
        {traces.filter((e: any) => e.layer === 'bottomCopper').map((e: any, i: number) => (
          <polyline key={i}
            points={e.points.map((p: any) => `${p.x * S},${p.y * S}`).join(' ')}
            fill="none" stroke={bc.copper} strokeWidth={e.width * S * 1.5}
            strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        ))}

        {/* top copper traces */}
        {traces.filter((e: any) => e.layer === 'topCopper').map((e: any, i: number) => (
          <polyline key={i}
            points={e.points.map((p: any) => `${p.x * S},${p.y * S}`).join(' ')}
            fill="none" stroke={bc.copper} strokeWidth={e.width * S * 1.5}
            strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* vias at trace joints */}
        {traces.flatMap((e: any) =>
          e.points.slice(1, -1).map((p: any, i: number) => (
            <g key={`via-${e.id}-${i}`}>
              <circle cx={p.x * S} cy={p.y * S} r="4" fill="#18191b" />
              <circle cx={p.x * S} cy={p.y * S} r="4" fill="none" stroke={bc.copper} strokeWidth="1.5" />
            </g>
          ))
        )}

        {/* pads */}
        {pads.map((e: any, i: number) => (
          <rect key={i}
            x={e.x * S - e.w * S / 2} y={e.y * S - e.h * S / 2}
            width={e.w * S} height={e.h * S} rx="1"
            fill={bc.copper} opacity="0.85" />
        ))}

        {/* silkscreen text — first two text elements */}
        {texts.slice(0, 2).map((e: any, i: number) => (
          <text key={i}
            x={e.x * S} y={e.y * S}
            fontSize={e.size * S * 0.8}
            fill={silkColor}
            fontFamily="ui-monospace, monospace"
            fontWeight={i === 0 ? '600' : '400'}
          >{e.content}</text>
        ))}
      </svg>

      {/* corner marks */}
      <span className="gallery-corner tl" style={{ color: isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)' }}>REV 1.0</span>
      <span className="gallery-corner br" style={{ color: isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)' }}>{authorName.split(' ')[0].toUpperCase()}</span>
    </div>
  )
}

export default function GalleryPage({ onBack, onEdit, onOpenProject }: Props) {
  return (
    <div className="landing gallery-page">
      <nav className="lnav">
        <button className="lnav-logo" onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <span className="lnav-dot" />
          PCB Card Maker
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={onBack} style={{ padding: '8px 16px', fontSize: 13 }}>← Back</button>
          <button className="btn-primary" onClick={onEdit}>Start Editing</button>
        </div>
      </nav>

      <div className="gallery-header">
        <div className="section-label">Community Gallery</div>
        <h2>PCB business cards from the wild</h2>
        <p className="section-sub">Browse designs for inspiration. Click any card to open it in the editor.</p>
      </div>

      <div className="gallery-grid">
        {GALLERY.map((entry, i) => (
          <button
            key={i}
            className="gallery-item"
            onClick={() => {
              const saved = saveProject(`${entry.authorName} — ${entry.authorRole}`, entry.project)
              onOpenProject(saved.project)
            }}
            title={`${entry.authorName} — ${entry.authorRole}`}
          >
            <CardThumb entry={entry} />
            <div className="gallery-item-meta">
              <span className="gallery-item-name">{entry.authorName}</span>
              <span className="gallery-item-color">{entry.project.boardColorKey}</span>
            </div>
          </button>
        ))}
      </div>

      <footer className="lfooter">
        <span>PCB Card Maker — browser-based PCB business card designer</span>
        <span className="footer-tag">No account required</span>
      </footer>
    </div>
  )
}
