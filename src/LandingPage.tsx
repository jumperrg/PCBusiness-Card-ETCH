import { useRef, type CSSProperties } from 'react'
import { BOARD_COLORS, type BoardColorKey } from './colors'
import Header from './Header'
import PcbCardFace, { type CardVariant } from './PcbCardFace'
import './landing.css'

interface Props {
  onStart: () => void
  onGallery: () => void
  onProjects?: () => void
  onGerberViewer?: () => void
}

interface DeskCard {
  color: BoardColorKey
  variant: CardVariant
  name: string
  role: string
  lines: string[]
  x: number
  y: number
  r: number
  z: number
  dims?: boolean
}

// positions are px from the desk-plane centre; z is stacking order
const DESK_CARDS: DeskCard[] = [
  { color: 'white', variant: 'tech', name: 'Grace Hopper', role: 'Compiler Engineer', lines: ['grace@cobol.dev', 'hopper.systems'], x: -290, y: -235, r: -2, z: 0 },
  { color: 'purple', variant: 'pcb', name: 'Nikola Tesla', role: 'Power Electronics', lines: ['nikola@ac.grid', '+1 555 0110'], x: 250, y: -230, r: 24, z: 0 },
  { color: 'blue', variant: 'tech', name: 'Max Planck', role: 'RF / Antenna Design', lines: ['max@planck.dev', 'planck-rf.com', '@maxrf'], x: -300, y: 140, r: 20, z: 1 },
  { color: 'green', variant: 'pcb', name: 'Ada Lovelace', role: 'Firmware Engineer', lines: ['ada@lovelace.io', 'github.com/ada'], x: -10, y: -20, r: 8, z: 2, dims: true },
  { color: 'black', variant: 'tech', name: 'Lise Meitner', role: 'PCB Layout Artist', lines: ['lise@meitner.io', 'meitner.design', '@lise.pcb'], x: 280, y: 170, r: -1, z: 3 },
  { color: 'red', variant: 'pcb', name: 'Alan Turing', role: 'Embedded Systems', lines: ['alan@enigma.uk', 'turing.engineering'], x: -20, y: 330, r: 28, z: 1 },
]

// loose SMD parts scattered on the desk: [x, y, rotation, kind]
const PARTS: [number, number, number, 'r' | 'c' | 'led'][] = [
  [190, -60, 30, 'r'], [222, -30, -12, 'c'], [-210, -40, 70, 'r'],
  [130, 90, 10, 'led'], [-150, 330, -40, 'c'], [470, -20, 55, 'r'], [-520, -40, -20, 'led'],
]

const STEPS = [
  { title: 'Design', desc: 'Place text, traces, pads and vias. Then pick a board color.' },
  { title: 'Preview', desc: 'Toggle copper, silkscreen and mask layers for an accurate render of the finished board.' },
  { title: 'Order', desc: 'Order your cards straight from the editor — no Gerber files to export or upload.' },
]


function DeskSketch() {
  // technical-drawing linework that lies on the desk plane
  return (
    <svg className="desk-sketch" viewBox="0 0 1800 1400" aria-hidden="true">
      <defs>
        <pattern id="desk-dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="1.6" fill="var(--grid-dot)" />
        </pattern>
      </defs>
      <rect width="1800" height="1400" fill="url(#desk-dots)" />

      <g fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* ghost card outlines */}
        <rect x="1220" y="880" width="340" height="216" rx="12" strokeDasharray="10 7" transform="rotate(8 1390 988)" />
        <rect x="260" y="200" width="340" height="216" rx="12" strokeDasharray="10 7" transform="rotate(-24 430 308)" />

        {/* resistor + capacitor + ground schematic */}
        <path d="M1240 300 H1290 l10 -18 l20 36 l20 -36 l20 36 l20 -36 l10 18 H1440 V380 M1420 380 H1460 M1420 392 H1460 M1440 392 V460 M1414 460 H1466 M1424 472 H1456 M1434 484 H1446" />
        <circle cx="1240" cy="300" r="5" />
        <text x="1300" y="270" className="sk-text">R1 10k</text>
        <text x="1472" y="392" className="sk-text">C1 100n</text>

        {/* op-amp */}
        <path d="M240 960 V1100 L360 1030 Z M200 990 H240 M200 1070 H240 M360 1030 H430 M216 990 V940 H400 V1030" />
        <text x="252" y="1000" className="sk-text">−</text>
        <text x="252" y="1080" className="sk-text">+</text>
        <text x="250" y="1130" className="sk-text">U2 OPA344</text>

        {/* crop marks */}
        <path d="M120 120 h50 M120 120 v50 M1680 120 h-50 M1680 120 v50 M120 1280 h50 M120 1280 v-50 M1680 1280 h-50 M1680 1280 v-50" />

        {/* title block */}
        <rect x="1330" y="1150" width="330" height="110" />
        <path d="M1330 1190 H1660 M1500 1190 V1260 M1330 1225 H1660" />
      </g>
      <g className="sk-text">
        <text x="1342" y="1178" className="sk-title">ETCH · PCB BUSINESS CARD</text>
        <text x="1342" y="1214">SCALE 1:1</text>
        <text x="1512" y="1214">SHEET 1/1</text>
        <text x="1342" y="1250">85 × 54 × 1.6</text>
        <text x="1512" y="1250">REV A</text>
      </g>
    </svg>
  )
}

function Dimensions() {
  // dimension lines drawn in the card's own frame (340 × 216 px)
  return (
    <svg className="dcard-dims" viewBox="-60 -60 460 336" aria-hidden="true">
      <g fill="none" stroke="var(--ink-strong)" strokeWidth="1.2">
        <path d="M0 -6 V-44 M340 -6 V-44 M0 -32 H340" />
        <path d="M0 -32 l10 -4 v8 z M340 -32 l-10 -4 v8 z" fill="var(--ink-strong)" />
        <path d="M-6 0 H-44 M-6 216 H-44 M-32 0 V216" />
        <path d="M-32 0 l-4 10 h8 z M-32 216 l-4 -10 h8 z" fill="var(--ink-strong)" />
      </g>
      <text x="170" y="-40" textAnchor="middle" className="dim-text">85.00</text>
      <text x="-40" y="108" textAnchor="middle" className="dim-text" transform="rotate(-90 -40 108)">54.00</text>
    </svg>
  )
}

function Part({ kind }: { kind: 'r' | 'c' | 'led' }) {
  return (
    <div className={`part part-${kind}`}>
      <span className="part-cap" /><span className="part-body">{kind === 'r' ? '103' : ''}</span><span className="part-cap" />
    </div>
  )
}

export default function LandingPage({ onStart, onGallery }: Props) {
  const sceneRef = useRef<HTMLDivElement>(null)

  const onMove = (e: React.MouseEvent) => {
    const el = sceneRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3))
    el.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
  }
  const onLeave = () => {
    sceneRef.current?.style.setProperty('--px', '0')
    sceneRef.current?.style.setProperty('--py', '0')
  }

  return (
    <div className="landing home">
      <Header light />

      {/* HERO */}
      <section className="home-hero" onMouseMove={onMove} onMouseLeave={onLeave}>
        <div className="home-hero-text">
          <div className="home-eyebrow"><span className="eyebrow-dot" />PCB business card editor</div>
          <h1>Business cards <br /><em>etched</em> in copper</h1>
          <p className="hero-sub">
            Design real, manufacturable PCB business cards in your browser — route <b>traces</b>,
            place <b>pads</b> and <b>silkscreen</b>, then export Gerbers and order them from any fab.
          </p>
          <div className="hero-actions">
            <button className="btn-primary btn-lg" onClick={onStart}>Start Editing →</button>
            <button className="btn-ghost btn-lg" onClick={onGallery}>Explore Gallery</button>
          </div>
          <div className="hero-meta">
            <span>85 × 54 mm</span><span>7 mask colors</span><span>Gerber export</span>
          </div>
        </div>

        <div className="desk-scene" ref={sceneRef}>
          <div className="desk-plane">
            <DeskSketch />
            {PARTS.map(([x, y, r, kind], i) => (
              <div key={i} className="part-wrap" style={{ transform: `translate(${x}px, ${y}px) rotate(${r}deg)` }}>
                <Part kind={kind} />
              </div>
            ))}
            {DESK_CARDS.map((c, i) => (
              <div
                key={c.name}
                className="dcard"
                onClick={onGallery}
                style={{
                  transform: `translate(${c.x}px, ${c.y}px) rotate(${c.r}deg) translateZ(${c.z * 10}px)`,
                  '--delay': `${0.15 + i * 0.12}s`,
                } as CSSProperties}
              >
                <div className="dcard-shadow" />
                {c.dims && <Dimensions />}
                <div className={`dcard-body${c.color === 'white' ? ' is-light' : ''}`}>
                  <div className="dcard-edge" />
                  <div className="dcard-edge e2" />
                  <PcbCardFace color={c.color} variant={c.variant} name={c.name} role={c.role} lines={c.lines} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* BOARD COLORS */}
      <section className="lsection">
        <div className="section-label">Board colors</div>
        <h2>Seven authentic solder mask colors</h2>
        <p className="section-sub">Each color is sampled from real PCB fabrication stock.</p>
        <div className="color-row">
          {BOARD_COLORS.map((c, i) => (
            <div className="color-chip" key={c.key}>
              <div className="color-chip-card">
                <PcbCardFace color={c.key} variant={i % 2 ? 'tech' : 'pcb'} name={c.label} role="Solder mask" lines={[]} />
              </div>
              <span className="swatch-label">{c.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lsection" id="how-it-works">
        <div className="section-label">Process</div>
        <h2>From idea to card in three steps</h2>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div className="step" key={s.title}>
              <div className="step-num">0{i + 1}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="steps-action">
          <button className="btn-primary btn-lg" onClick={onStart}>Start Editing →</button>
        </div>
      </section>


      <footer className="lfooter">
        <span>ETCH — browser-based PCB business card designer</span>
      </footer>
    </div>
  )
}
