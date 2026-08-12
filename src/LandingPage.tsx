import { useState } from 'react'
import { BOARD_COLORS } from './colors'

interface Props {
  onStart: () => void
  onGallery: () => void
  onProjects: () => void
}

const CARD_REST = [
  'rotate(-3deg) translateY(16px) translateX(-10px)',
  'rotate(1.5deg) translateY(10px) translateX(8px)',
  'rotate(0deg)',
]
const CARD_HOVER = [
  'rotate(-5.5deg) translateY(24px) translateX(-26px)',
  'rotate(3.5deg)  translateY(17px) translateX(22px)',
  'rotate(0deg)    translateY(-4px)',
]

export default function LandingPage({ onStart, onGallery, onProjects }: Props) {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="landing">
      {/* NAV */}
      <nav className="lnav">
        <span className="lnav-logo">
          <span className="lnav-dot" />
          PCB Card Maker
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={onProjects} style={{ padding: '8px 16px', fontSize: 13 }}>My Projects</button>
          <button className="btn-primary" onClick={onStart}>Start Editing</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-grid-bg" />
        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-label">PCB Business Cards</div>
            <h1>Business cards that<br /><em>actually impress</em> engineers</h1>
            <p className="hero-sub">
              Design real PCB-style business cards in your browser. Pick a board color,
              lay out your traces, export — then get them fabricated at any PCB house.
            </p>
            <div className="hero-actions">
              <button className="btn-primary btn-lg" onClick={onStart}>Start Editing →</button>
              <button className="btn-ghost btn-lg" onClick={onGallery}>Explore Gallery</button>
            </div>
          </div>
          <div
            className="pcb-stack"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
          {/* green card (back) */}
          <div className="pcb-card pcb-green" style={{ transform: hovered ? CARD_HOVER[0] : CARD_REST[0] }}>
            <svg className="pcb-traces" viewBox="0 0 340 200" preserveAspectRatio="none">
              <line x1="30" y1="0" x2="30" y2="200" stroke="#0d9e52" strokeWidth="1" opacity="0.35" />
              <line x1="0" y1="60" x2="340" y2="60" stroke="#0d9e52" strokeWidth="1" opacity="0.25" />
              <circle cx="30" cy="60" r="4" fill="#03865a" opacity="0.5" />
            </svg>
          </div>
          {/* blue card (mid) */}
          <div className="pcb-card pcb-blue" style={{ transform: hovered ? CARD_HOVER[1] : CARD_REST[1] }}>
            <svg className="pcb-traces" viewBox="0 0 340 200" preserveAspectRatio="none">
              <line x1="60" y1="0" x2="60" y2="200" stroke="#1a5cd4" strokeWidth="1" opacity="0.4" />
              <line x1="0" y1="100" x2="340" y2="100" stroke="#1a5cd4" strokeWidth="1" opacity="0.3" />
              <circle cx="60" cy="100" r="5" fill="none" stroke="#015bbc" strokeWidth="1.5" opacity="0.6" />
            </svg>
          </div>
          {/* black card (front) */}
          <div className="pcb-card pcb-black" style={{ transform: hovered ? CARD_HOVER[2] : CARD_REST[2] }}>
            <svg className="pcb-traces" viewBox="0 0 340 200" preserveAspectRatio="none">
              <line x1="0" y1="40" x2="200" y2="40" stroke="#6b6e71" strokeWidth="1.2" opacity="0.5" />
              <line x1="200" y1="40" x2="200" y2="160" stroke="#6b6e71" strokeWidth="1.2" opacity="0.5" />
              <line x1="200" y1="160" x2="310" y2="160" stroke="#6b6e71" strokeWidth="1.2" opacity="0.5" />
              <circle cx="200" cy="40" r="4" fill="none" stroke="#6b6e71" strokeWidth="1.5" opacity="0.7" />
              <circle cx="200" cy="160" r="4" fill="none" stroke="#6b6e71" strokeWidth="1.5" opacity="0.7" />
            </svg>
            <div className="pcb-silk">
              <div className="pcb-name">Alex Ivanova</div>
              <div className="pcb-role">Embedded Systems Engineer</div>
            </div>
            <div className="pcb-contacts pcb-silk">
              <span>alex@example.io</span>
              <span>github.com/alex</span>
            </div>
            <div className="pcb-pads">
              <div className="pad" /><div className="pad" />
              <div className="pad" /><div className="pad" />
            </div>
            <span className="corner-mark tl">REV 1.0</span>
            <span className="corner-mark br">JLCPCB</span>
          </div>
          </div>{/* end pcb-stack */}
        </div>{/* end hero-inner */}
      </section>

      <hr className="ldivider" />

      {/* FEATURES */}
      <section className="lsection">
        <div className="section-label">Features</div>
        <h2>Everything you need, nothing you don't</h2>
        <p className="section-sub">A focused tool built for one thing: PCB business cards. No bloat, no subscriptions.</p>
        <div className="features-grid">
          {FEATURES.map(f => (
            <div className="feature" key={f.title}>
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
                  dangerouslySetInnerHTML={{ __html: f.path }} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="ldivider" />

      {/* BOARD COLORS */}
      <section className="colors-section">
        <div className="section-label">Board Colors</div>
        <h2>Seven authentic solder mask colors</h2>
        <p className="section-sub">Each color is sampled from real PCB fabrication stock.</p>
        <div className="color-swatches">
          {BOARD_COLORS.map(c => (
            <div className="swatch" key={c.key}>
              <div className="swatch-board" style={{ background: c.fill,
                boxShadow: c.key === 'white'
                  ? '0 6px 20px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.1)'
                  : '0 6px 20px rgba(0,0,0,0.5)'
              }} />
              <span className="swatch-label">{c.label}</span>
            </div>
          ))}
        </div>
      </section>

      <hr className="ldivider" />

      {/* HOW IT WORKS */}
      <section className="lsection" id="how-it-works">
        <div className="section-label">Process</div>
        <h2>From idea to card in four steps</h2>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div className="step" key={s.title}>
              <div className="step-num">0{i + 1}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="ldivider" />

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-glow" />
        <div className="terminal-chip">
          <span>pcb-card-maker</span>
          <span className="blink-cursor" />
        </div>
        <h2>Stop handing out paper.<br />Hand out a PCB.</h2>
        <p className="section-sub">Open the editor right now — no sign-up, no credit card.</p>
        <button className="btn-primary btn-lg" onClick={onStart}>Start Editing →</button>
      </section>

      {/* FOOTER */}
      <footer className="lfooter">
        <span>PCB Card Maker — browser-based PCB business card designer</span>
        <span className="footer-tag">No account required</span>
      </footer>
    </div>
  )
}

const FEATURES = [
  {
    title: 'Runs in the Browser',
    desc: 'No install, no account. Open the editor and start designing immediately. Your data never leaves your machine.',
    path: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  },
  {
    title: '7 Board Colors',
    desc: 'Choose from authentic solder mask colors — green, black, white, blue, red, yellow, purple — matched to real PCB fab samples.',
    path: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>',
  },
  {
    title: 'Trace Routing',
    desc: 'Draw copper traces, place vias and pads just like a real EDA tool. Snap to grid, bend at 45°, keep it clean.',
    path: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
  },
  {
    title: 'Export to SVG',
    desc: 'Download production-ready files. Order 5 cards for a few dollars at JLCPCB, PCBWay, or any fab house.',
    path: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  },
  {
    title: 'Silkscreen Text',
    desc: 'Add your name, email, handle, QR code — whatever fits on a standard 85 × 54 mm business card format.',
    path: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  },
  {
    title: 'Accurate Preview',
    desc: 'See exactly what your board will look like before ordering. Copper, silkscreen, and board outline rendered faithfully.',
    path: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/>',
  },
]

const STEPS = [
  { title: 'Design', desc: 'Use the editor to place text, traces, pads, and vias. Choose your board color.' },
  { title: 'Preview', desc: 'Toggle between layers and get an accurate render of the finished board.' },
  { title: 'Export', desc: 'Download your SVG file — compatible with every major PCB fabricator.' },
  { title: 'Order', desc: 'Upload to JLCPCB, PCBWay, or OSHPark. A batch of 5 cards typically costs under $5.' },
]
