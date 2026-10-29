import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { BOARD_COLORS } from './colors'
import { type PCBProject } from './pcb-card-editor'
import { listProjects, deleteProject, type SavedProject } from './projectStore'
import Header from './Header'

interface Props {
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

function CardThumb({ entry, thumbnail }: { entry: ThumbEntry; thumbnail?: string }) {
  const { project, authorName } = entry
  const bc = BOARD_COLORS.find(c => c.key === project.boardColorKey)!

  if (thumbnail) {
    return (
      <div className="gallery-card" style={{ background: bc.fill, boxShadow: '0 2px 0 #a8975e, 0 4px 0 #9e8d55, 10px 18px 24px -8px rgba(40,36,30,0.4)' }}>
        <img src={thumbnail} alt={authorName} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }

  const isLight = project.boardColorKey === 'white' || project.boardColorKey === 'yellow'
  const silkColor = isLight ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.88)'


  const S = 2
  const W = 85 * S
  const H = 54 * S

  const traces = project.elements.filter((e: any) => e.type === 'trace')
  const pads = project.elements.filter((e: any) => e.type === 'pad')
  const texts = project.elements.filter((e: any) => e.type === 'text')

  return (
    <div className="gallery-card" style={{
      background: bc.fill,
      boxShadow: '0 2px 0 #a8975e, 0 4px 0 #9e8d55, 10px 18px 24px -8px rgba(40,36,30,0.4)',
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
        {pads.map((e: any, i: number) => (
          e.kind === 'tht'
            ? <circle key={i} cx={e.x * S} cy={e.y * S} r={e.size * S / 2} fill={bc.copper} opacity="0.85" />
            : <rect key={i} x={e.x * S - e.w * S / 2} y={e.y * S - e.h * S / 2}
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

export default function ProjectsPage({ onEdit, onOpenProject }: Props) {
  const [saved, setSaved] = useState<SavedProject[]>([])

  useEffect(() => {
    setSaved(listProjects())
  }, [])

  return (
    <div className="landing home gallery-page">
      <Header active="projects" light />

      <div className="gallery-header">
        <div className="section-label">Your Projects</div>
        <h2>Saved on this device</h2>
        <p className="section-sub">Click any card to continue editing it.</p>
      </div>

      {saved.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ltext-muted)' }}>
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
                onClick={() => onOpenProject({ ...sp.project, id: sp.id, name: sp.name })}
                title={sp.name}
              >
                <div style={{ position: 'relative' }}>
                  <CardThumb entry={entry} thumbnail={sp.thumbnail} />
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
        <span>ETCH — browser-based PCB business card designer</span>
        <span className="footer-tag">No account required</span>
      </footer>
    </div>
  )
}
