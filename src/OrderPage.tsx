import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { CreditCard, Lock, Pencil, RotateCcw, CheckCircle2 } from 'lucide-react'
import { BOARD_COLORS, type BoardColorKey } from './colors'
import { type PCBProject } from './pcb-card-editor'
import { listProjects } from './projectStore'
import { openInEditor, navigate } from './App'
import PcbCardFace from './PcbCardFace'
import Header from './Header'
import './order.css'

export const ORDER_KEY = 'pcb:order'

export interface OrderDesign {
  name: string
  project: PCBProject
  /** PNG data URLs of the rasterized top / bottom side */
  front?: string
  back?: string
}

// Placeholder pricing until a fab backend exists (USD, per batch, shipping included).
const QUANTITIES = [
  { qty: 25, price: 39 },
  { qty: 50, price: 59 },
  { qty: 100, price: 89 },
  { qty: 250, price: 179 },
] as const

type Payment = 'paypal' | 'card'

interface FormState {
  name: string
  email: string
  street: string
  city: string
  zip: string
  country: string
  qty: number
  payment: Payment
  cardName: string
  cardNumber: string
  cardExpiry: string
  cardCvc: string
}

type Errors = Partial<Record<keyof FormState, string>>

const INITIAL: FormState = {
  name: '', email: '', street: '', city: '', zip: '', country: '',
  qty: 50, payment: 'card',
  cardName: '', cardNumber: '', cardExpiry: '', cardCvc: '',
}

function loadDesign(): OrderDesign | undefined {
  try {
    const raw = sessionStorage.getItem(ORDER_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fall through */ }
  // Opened directly: offer the most recently saved project instead.
  const latest = listProjects()[0]
  if (latest) return { name: latest.name, project: { ...latest.project, id: latest.id, name: latest.name }, front: latest.thumbnail }
  return undefined
}

function luhn(digits: string) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = +digits[digits.length - 1 - i]
    if (i % 2) { d *= 2; if (d > 9) d -= 9 }
    sum += d
  }
  return sum % 10 === 0
}

function validate(f: FormState): Errors {
  const e: Errors = {}
  if (!f.name.trim()) e.name = 'Enter your full name'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email'
  if (!f.street.trim()) e.street = 'Enter a street address'
  if (!f.city.trim()) e.city = 'Enter a city'
  if (!f.zip.trim()) e.zip = 'Enter a postal code'
  if (!f.country.trim()) e.country = 'Enter a country'
  if (f.payment === 'card') {
    const digits = f.cardNumber.replace(/\D/g, '')
    if (!f.cardName.trim()) e.cardName = 'Enter the name on the card'
    if (digits.length < 13 || digits.length > 19 || !luhn(digits)) e.cardNumber = 'Card number looks invalid'
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(f.cardExpiry)
    if (!m || +m[1] < 1 || +m[1] > 12) e.cardExpiry = 'Use MM / YY'
    else {
      const now = new Date()
      const exp = new Date(2000 + +m[2], +m[1]) // first day of the month after expiry
      if (exp <= now) e.cardExpiry = 'Card has expired'
    }
    if (!/^\d{3,4}$/.test(f.cardCvc)) e.cardCvc = '3–4 digits'
  }
  return e
}

const formatCardNumber = (v: string) => v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d
}

// ---- 3D card --------------------------------------------------------------

/** Drag-to-rotate CSS-3D business card with real front/back faces and a 1.6 mm FR4 edge. */
function Card3D({ design }: { design?: OrderDesign }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const anim = useRef({ x: -18, y: -28, vx: 0, vy: 0, target: null as number | null, drag: null as null | { px: number; py: number }, idleAt: 0 })

  const board = design?.project.board ?? { width: 85, height: 54, corner: 3 }
  const colorKey = (design?.project.boardColorKey ?? 'green') as BoardColorKey
  const bc = BOARD_COLORS.find(c => c.key === colorKey) ?? BOARD_COLORS[3]
  const isLight = colorKey === 'white'
  const radius = `${(board.corner / board.width) * 100}% / ${(board.corner / board.height) * 100}%`

  useEffect(() => {
    const a = anim.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const tick = () => {
      if (!a.drag) {
        if (a.target !== null) {
          const d = a.target - a.y
          a.y += d * 0.12
          a.x += (-12 - a.x) * 0.12
          if (Math.abs(d) < 0.2) { a.y = a.target; a.target = null; a.idleAt = performance.now() }
        } else {
          a.y += a.vy; a.x += a.vx
          a.vx *= 0.92; a.vy *= 0.92
          // after a pause, drift slowly so both sides get shown
          if (!reduced && performance.now() - a.idleAt > 2500) a.y += 0.18
          a.x += (-16 - a.x) * 0.02
        }
      }
      a.x = Math.max(-70, Math.min(70, a.x))
      if (cardRef.current) cardRef.current.style.transform = `rotateX(${a.x}deg) rotateY(${a.y}deg)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    const a = anim.current
    a.drag = { px: e.clientX, py: e.clientY }
    a.target = null; a.vx = a.vy = 0
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const a = anim.current
    if (!a.drag) return
    const dx = e.clientX - a.drag.px, dy = e.clientY - a.drag.py
    a.drag = { px: e.clientX, py: e.clientY }
    a.vy = dx * 0.45; a.vx = -dy * 0.45
    a.y += a.vy; a.x += a.vx
  }
  const onPointerUp = () => {
    const a = anim.current
    a.drag = null
    a.idleAt = performance.now()
  }
  const showSide = (side: 'front' | 'back') => {
    const a = anim.current
    // nearest multiple of 360 (front) or 360+180 (back) to the current angle
    const base = Math.round((a.y - (side === 'back' ? 180 : 0)) / 360) * 360
    a.target = base + (side === 'back' ? 180 : 0)
    a.vx = a.vy = 0
  }

  const face = (src: string | undefined, fallback: ReactNode) =>
    src ? <img src={src} alt="" draggable={false} /> : fallback

  const slices = [-3, -2, -1, 0, 1, 2, 3]

  return (
    <div className="order-stage">
      <div
        className="order-scene"
        style={{ aspectRatio: `${board.width} / ${board.height}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={`3D preview of ${design?.name ?? 'your'} PCB business card — drag to rotate`}
      >
        <div className="order-card" ref={cardRef}>
          {slices.map(z => (
            <div
              key={z}
              className={`order-edge${isLight ? ' is-light' : ''}`}
              style={{ borderRadius: radius, transform: `translateZ(${z}px)` }}
            />
          ))}
          <div className="order-face front" style={{ borderRadius: radius, background: bc.fill }}>
            {face(design?.front, (
              <PcbCardFace color={colorKey} variant="pcb" name={design?.name ?? 'Your Name'} role="PCB Business Card" lines={['you@example.com', 'etch.design']} />
            ))}
          </div>
          <div className="order-face back" style={{ borderRadius: radius, background: bc.fill }}>
            {face(design?.back, null)}
          </div>
        </div>
      </div>
      <div className="order-floor-shadow" />
      <div className="order-stage-controls">
        <button type="button" onClick={() => showSide('front')}>Front</button>
        <button type="button" onClick={() => showSide('back')}>Back</button>
        <span className="order-hint"><RotateCcw size={13} /> Drag to rotate</span>
      </div>
    </div>
  )
}

// ---- form bits ------------------------------------------------------------

function Field({ label, error, children, className }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`order-field${error ? ' has-error' : ''}${className ? ` ${className}` : ''}`}>
      <span className="order-label">{label}</span>
      {children}
      {error && <span className="order-error">{error}</span>}
    </label>
  )
}

function PayPalMark() {
  return (
    <svg viewBox="0 0 64 18" height="16" aria-hidden="true">
      <text x="0" y="14" fontFamily="Verdana, sans-serif" fontWeight="700" fontStyle="italic" fontSize="15" fill="#003087">Pay</text>
      <text x="30" y="14" fontFamily="Verdana, sans-serif" fontWeight="700" fontStyle="italic" fontSize="15" fill="#009cde">Pal</text>
    </svg>
  )
}

// ---- page -----------------------------------------------------------------

export default function OrderPage() {
  const [design] = useState(loadDesign)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [orderNo, setOrderNo] = useState('')

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
  }
  const input = (key: keyof FormState, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      value={form[key] as string}
      onChange={e => set(key, e.target.value as never)}
      aria-invalid={!!errors[key]}
      {...props}
    />
  )

  const tier = QUANTITIES.find(q => q.qty === form.qty) ?? QUANTITIES[1]
  const colorKey = design?.project.boardColorKey ?? 'green'
  const colorLabel = BOARD_COLORS.find(c => c.key === colorKey)?.label ?? colorKey
  const board = design?.project.board ?? { width: 85, height: 54, corner: 3 }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    const first = Object.keys(errs)[0]
    if (first) {
      document.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] select`)?.focus()
      return
    }
    // No fab/payment backend yet — simulate the round trip. Card data never leaves this component.
    setStatus('submitting')
    setTimeout(() => {
      setOrderNo(`ETCH-${Date.now().toString(36).toUpperCase().slice(-6)}`)
      setStatus('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 1200)
  }

  return (
    <div className="landing home order-page">
      <Header light />

      <div className="order-header">
        <div className="section-label">Checkout</div>
        <h2>Order your PCB cards</h2>
      </div>

      <div className="order-layout">
        <section className="order-preview">
          <Card3D design={design} />
          <div className="order-spec">
            <div className="order-spec-title">
              <span>{design?.name ?? 'No design selected'}</span>
              {design && (
                <button type="button" className="order-link" onClick={() => openInEditor(design.project)}>
                  <Pencil size={13} /> Edit design
                </button>
              )}
            </div>
            <dl>
              <div><dt>Size</dt><dd>{board.width} × {board.height} mm</dd></div>
              <div><dt>Board</dt><dd>1.6 mm FR4, 2 layers</dd></div>
              <div><dt>Mask</dt><dd><i className="order-swatch" style={{ background: BOARD_COLORS.find(c => c.key === colorKey)?.fill }} />{colorLabel}</dd></div>
              <div><dt>Finish</dt><dd>ENIG</dd></div>
            </dl>
            {!design && (
              <p className="order-note">
                Showing a sample card. <button type="button" className="order-link" onClick={() => navigate('/editor')}>Design your own →</button>
              </p>
            )}
          </div>
        </section>

        <section className="order-panel">
          {status === 'done' ? (
            <div className="order-success">
              <CheckCircle2 size={44} strokeWidth={1.6} />
              <h3>Order placed</h3>
              <p>Order <b>{orderNo}</b> — {tier.qty} cards, ${tier.price}.00.</p>
              <p>A confirmation will be sent to <b>{form.email}</b>.</p>
              <button type="button" className="btn-primary" onClick={() => navigate('/projects')}>Back to projects</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <fieldset>
                <legend>Contact</legend>
                <div className="order-grid">
                  <Field label="Full name" error={errors.name} className="span-2">
                    <span data-field="name" className="order-input">{input('name', { autoComplete: 'name', placeholder: 'Ada Lovelace' })}</span>
                  </Field>
                  <Field label="Email" error={errors.email} className="span-2">
                    <span data-field="email" className="order-input">{input('email', { type: 'email', autoComplete: 'email', placeholder: 'ada@example.com' })}</span>
                  </Field>
                </div>
              </fieldset>

              <fieldset>
                <legend>Shipping address</legend>
                <div className="order-grid">
                  <Field label="Street address" error={errors.street} className="span-2">
                    <span data-field="street" className="order-input">{input('street', { autoComplete: 'street-address', placeholder: '12 Analytical Engine Rd' })}</span>
                  </Field>
                  <Field label="City" error={errors.city}>
                    <span data-field="city" className="order-input">{input('city', { autoComplete: 'address-level2' })}</span>
                  </Field>
                  <Field label="Postal code" error={errors.zip}>
                    <span data-field="zip" className="order-input">{input('zip', { autoComplete: 'postal-code' })}</span>
                  </Field>
                  <Field label="Country" error={errors.country} className="span-2">
                    <span data-field="country" className="order-input">{input('country', { autoComplete: 'country-name' })}</span>
                  </Field>
                </div>
              </fieldset>

              <fieldset>
                <legend>Quantity</legend>
                <div className="order-qty" role="radiogroup">
                  {QUANTITIES.map(q => (
                    <label key={q.qty} className={`order-qty-opt${form.qty === q.qty ? ' is-on' : ''}`}>
                      <input type="radio" name="qty" checked={form.qty === q.qty} onChange={() => set('qty', q.qty)} />
                      <b>{q.qty}</b>
                      <span>${q.price}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>Payment method</legend>
                <div className="order-pay" role="radiogroup">
                  <label className={`order-pay-opt${form.payment === 'card' ? ' is-on' : ''}`}>
                    <input type="radio" name="payment" checked={form.payment === 'card'} onChange={() => set('payment', 'card')} />
                    <CreditCard size={18} /> Card
                  </label>
                  <label className={`order-pay-opt${form.payment === 'paypal' ? ' is-on' : ''}`}>
                    <input type="radio" name="payment" checked={form.payment === 'paypal'} onChange={() => set('payment', 'paypal')} />
                    <PayPalMark />
                  </label>
                </div>

                {form.payment === 'card' ? (
                  <div className="order-grid order-card-fields">
                    <Field label="Name on card" error={errors.cardName} className="span-2">
                      <span data-field="cardName" className="order-input">{input('cardName', { autoComplete: 'cc-name' })}</span>
                    </Field>
                    <Field label="Card number" error={errors.cardNumber} className="span-2">
                      <span data-field="cardNumber" className="order-input">
                        <input
                          value={form.cardNumber}
                          onChange={e => set('cardNumber', formatCardNumber(e.target.value))}
                          inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456"
                          aria-invalid={!!errors.cardNumber}
                        />
                      </span>
                    </Field>
                    <Field label="Expiry" error={errors.cardExpiry}>
                      <span data-field="cardExpiry" className="order-input">
                        <input
                          value={form.cardExpiry}
                          onChange={e => set('cardExpiry', formatExpiry(e.target.value))}
                          inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY"
                          aria-invalid={!!errors.cardExpiry}
                        />
                      </span>
                    </Field>
                    <Field label="CVC" error={errors.cardCvc}>
                      <span data-field="cardCvc" className="order-input">
                        <input
                          value={form.cardCvc}
                          onChange={e => set('cardCvc', e.target.value.replace(/\D/g, '').slice(0, 4))}
                          inputMode="numeric" autoComplete="cc-csc" placeholder="123"
                          aria-invalid={!!errors.cardCvc}
                        />
                      </span>
                    </Field>
                  </div>
                ) : (
                  <p className="order-note">You'll be redirected to PayPal to approve the payment, then brought back here.</p>
                )}
              </fieldset>

              <div className="order-summary">
                <div><span>{tier.qty} × PCB business card</span><span>${tier.price}.00</span></div>
                <div><span>Shipping</span><span>Included</span></div>
                <div className="order-total"><span>Total</span><span>${tier.price}.00</span></div>
              </div>

              <button type="submit" className="btn-primary order-submit" disabled={status === 'submitting'}>
                {status === 'submitting'
                  ? 'Processing…'
                  : form.payment === 'paypal' ? 'Continue with PayPal' : <><Lock size={14} /> Pay ${tier.price}.00</>}
              </button>
            </form>
          )}
        </section>
      </div>

      <footer className="lfooter">
        <span>ETCH — browser-based PCB business card designer</span>
      </footer>
    </div>
  )
}
