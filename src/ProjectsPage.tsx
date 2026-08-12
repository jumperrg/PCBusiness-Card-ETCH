import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { BOARD_COLORS } from './colors'
import { type PCBProject } from './pcb-card-editor'
import { listProjects, deleteProject, type SavedProject } from './projectStore'

interface Props {
  onBack: () => void
  onEdit: () => void
  onOpenProject: (project: PCBProject) => void
}

interface ThumbEntry {
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

function CardThumb({ entry }: { entry: ThumbEntry }) {
  const { project, authorName } = entry
  const bc = BOARD_COLORS.find(c => c.key === project.boardColorKey)!
  const isLight = project.boardColorKey === 'white' || project.boardColorKey === 'yellow'
  const silkColor = isLight ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.88)'

  const glowMap: Record<string, string> = {
    green: '#0d9e5270', blue: '#1a5cd470', black: '#6b6e7150',
    red: '#d4444470', purple: '#a80d9070', yellow: '#c8b40470', white: '#cccccc50',
  }

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
      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: 12 }, (_, row) =>
          Array.from({ length: 20 }, (_, col) => (
            <circle key={`${row}-${col}`} cx={col * 9 + 5} cy={row * 9 + 5} r="1" fill={bc.dot} opacity="0.45" />
          ))
        )}
        {traces.filter((e: any) => e.layer === 'bottomCopper').map((e: any, i: number) => (
          <polyline key={i} points={e.points.map((p: any) => `${p.x * S},${p.y * S}`).join(' ')}
            fill="none" stroke={bc.copper} strokeWidth={e.width * S * 1.5}
            strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        ))}
        {traces.filter((e: any) => e.layer === 'topCopper').map((e: any, i: number) => (
          <polyline key={i} points={e.points.map((p: any) => `${p.x * S},${p.y * S}`).join(' ')}
            fill="none" stroke={bc.copper} strokeWidth={e.width * S * 1.5}
            strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {traces.flatMap((e: any) =>
          e.points.slice(1, -1).map((p: any, i: number) => (
            <g key={`via-${e.id}-${i}`}>
              <circle cx={p.x * S} cy={p.y * S} r="4" fill="#18191b" />
              <circle cx={p.x * S} cy={p.y * S} r="4" fill="none" stroke={bc.copper} strokeWidth="1.5" />
            </g>
          ))
        )}
        {pads.map((e: any, i: number) => (
          <rect key={i} x={e.x * S - e.w * S / 2} y={e.y * S - e.h * S / 2}
            width={e.w * S} height={e.h * S} rx="1" fill={bc.copper} opacity="0.85" />
        ))}
        {texts.slice(0, 2).map((e: any, i: number) => (
          <text key={i} x={e.x * S} y={e.y * S} fontSize={e.size * S * 0.8}
            fill={silkColor} fontFamily="ui-monospace, monospace" fontWeight={i === 0 ? '600' : '400'}>
            {e.content}
          </text>
        ))}
      </svg>
      <span className="gallery-corner tl" style={{ color: isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)' }}>REV 1.0</span>
      <span className="gallery-corner br" style={{ color: isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)' }}>{authorName.split(' ')[0].toUpperCase()}</span>
    </div>
  )
}

export default function ProjectsPage({ onBack, onEdit, onOpenProject }: Props) {
  const [saved, setSaved] = useState<SavedProject[]>([])

  useEffect(() => {
    setSaved(listProjects())
  }, [])

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
        <div className="section-label">Your Projects</div>
        <h2>Saved on this device</h2>
        <p className="section-sub">Click any card to continue editing it.</p>
      </div>

      {saved.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <p style={{ fontSize: 15 }}>No saved projects yet.</p>
          <button className="btn-primary" onClick={onEdit} style={{ marginTop: 16 }}>Start Editing →</button>
        </div>
      ) : (
        <div className="gallery-grid">
          {saved.map((sp) => {
            const entry: ThumbEntry = {
              project: normalizeLayersForThumb(sp.project),
              authorName: sp.name,
              authorRole: sp.project.boardColorKey,
            }
            return (
              <button
                key={sp.id}
                className="gallery-item"
                onClick={() => onOpenProject(sp.project)}
                title={sp.name}
              >
                <div style={{ position: 'relative' }}>
                  <CardThumb entry={entry} />
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteProject(sp.id); setSaved(listProjects()) }}
                    title="Delete project"
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 6,
                      color: '#e05050', cursor: 'pointer', padding: '5px 6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0.7,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="gallery-item-meta">
                  <span className="gallery-item-name">{sp.name}</span>
                  <span className="gallery-item-color">{sp.project.boardColorKey}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <footer className="lfooter">
        <span>PCB Card Maker — browser-based PCB business card designer</span>
        <span className="footer-tag">No account required</span>
      </footer>
    </div>
  )
}
