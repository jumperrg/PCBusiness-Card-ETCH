import { useId } from 'react'
import { BOARD_COLORS, type BoardColorKey } from './colors'

export type CardVariant = 'pcb' | 'tech'

interface Props {
  color: BoardColorKey
  variant: CardVariant
  name: string
  role: string
  lines: string[]
}

// 85 × 54 mm board at 10 units / mm
const W = 850
const H = 540
const SANS = "'Inter', 'Segoe UI', system-ui, sans-serif"
const MONO = 'ui-monospace, Consolas, monospace'

// deterministic pseudo-random bits for the silkscreen QR block
function qrBits(seed: string, n: number) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const bits: boolean[] = []
  for (let i = 0; i < n * n; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5
    bits.push((h & 3) === 0 || (h & 7) === 5)
  }
  return bits
}

function QrBlock({ x, y, seed, fill }: { x: number; y: number; seed: string; fill: string }) {
  const N = 21, M = 7
  const bits = qrBits(seed, N)
  const inFinder = (r: number, c: number) =>
    (r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8)
  const finder = (fx: number, fy: number) => (
    <g key={`${fx}-${fy}`}>
      <rect x={x + fx * M + M / 2} y={y + fy * M + M / 2} width={6 * M} height={6 * M} fill="none" stroke={fill} strokeWidth={M} />
      <rect x={x + (fx + 2) * M} y={y + (fy + 2) * M} width={3 * M} height={3 * M} fill={fill} />
    </g>
  )
  return (
    <g>
      {bits.map((on, i) => {
        const r = Math.floor(i / N), c = i % N
        if (!on || inFinder(r, c)) return null
        return <rect key={i} x={x + c * M} y={y + r * M} width={M} height={M} fill={fill} />
      })}
      {finder(0, 0)}{finder(N - 7, 0)}{finder(0, N - 7)}
    </g>
  )
}

/** Realistic top-side render of a PCB business card: soldermask, tented copper, ENIG pads, silkscreen. */
export default function PcbCardFace({ color, variant, name, role, lines }: Props) {
  const uid = useId().replace(/:/g, '')
  const bc = BOARD_COLORS.find(c => c.key === color)!
  const silk = color === 'white' ? '#1d1d1b' : '#f0f0e8'
  const copper = bc.dot
  const gold = `url(#gold-${uid})`

  const via = (x: number, y: number, k: string | number) => (
    <g key={`v${k}`}>
      <circle cx={x} cy={y} r={11} fill={copper} />
      <circle cx={x} cy={y} r={4.5} fill="#0b0b0a" opacity={0.75} />
    </g>
  )

  return (
    <svg className="pcb-face" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`gold-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe7a1" />
          <stop offset="0.35" stopColor="#d9ac45" />
          <stop offset="0.7" stopColor="#b7862b" />
          <stop offset="1" stopColor="#f2d37c" />
        </linearGradient>
        <linearGradient id={`gloss-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.20" />
          <stop offset="0.38" stopColor="#fff" stopOpacity="0.03" />
          <stop offset="0.62" stopColor="#000" stopOpacity="0.04" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.10" />
        </linearGradient>
        <clipPath id={`clip-${uid}`}><rect width={W} height={H} rx={30} /></clipPath>
      </defs>

      <g clipPath={`url(#clip-${uid})`}>
        <rect width={W} height={H} fill={bc.fill} />

        {variant === 'pcb' ? (
          <g>
            {/* tented copper traces fanning out of a QFN */}
            <g fill="none" stroke={copper} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
              {[0, 1, 2, 3, 4].map(k => {
                const x = 596 + k * 22, y = 470 - k * 22
                return <path key={`b${k}`} d={`M${x} 331 V${y - 20} L${x + 20} ${y} H800`} />
              })}
              {[0, 1, 2, 3, 4].map(k => {
                const y = 201 + k * 22
                return <path key={`r${k}`} d={`M726 ${y} H${760 + (k % 2) * 30}`} />
              })}
              {[0, 1, 2, 3, 4].map(k => {
                const x = 596 + k * 22
                return <path key={`t${k}`} d={`M${x} 159 V${96 + (k % 2) * 30}`} />
              })}
              {[0, 1, 2, 3, 4].map(k => {
                const y = 201 + k * 22
                return <path key={`l${k}`} d={`M554 ${y} H${492 - (k % 2) * 28}`} />
              })}
            </g>
            {[0, 1, 2, 3, 4].map(k => via(800, 470 - k * 22, `b${k}`))}
            {[0, 1, 2, 3, 4].map(k => via(760 + (k % 2) * 30, 201 + k * 22, `r${k}`))}
            {[0, 1, 2, 3, 4].map(k => via(596 + k * 22, 96 + (k % 2) * 30, `t${k}`))}
            {[0, 1, 2, 3, 4].map(k => via(492 - (k % 2) * 28, 201 + k * 22, `l${k}`))}

            {/* QFN footprint: ENIG pads + silk outline */}
            <g fill={gold}>
              {[0, 1, 2, 3, 4].map(k => (
                <g key={k}>
                  <rect x={554} y={196 + k * 22} width={24} height={10} rx={2} />
                  <rect x={702} y={196 + k * 22} width={24} height={10} rx={2} />
                  <rect x={591 + k * 22} y={159} width={10} height={24} rx={2} />
                  <rect x={591 + k * 22} y={307} width={10} height={24} rx={2} />
                </g>
              ))}
              <rect x={605} y={210} width={70} height={70} rx={3} />
            </g>
            <rect x={578} y={183} width={124} height={124} fill="none" stroke={silk} strokeWidth={3} rx={2} />
            <circle cx={572} cy={177} r={5} fill={silk} />
            <text x={712} y={172} fill={silk} fontFamily={MONO} fontSize={18}>U1</text>

            {/* plated mounting holes */}
            {[[42, 42], [808, 42], [42, 498], [808, 498]].map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <circle cx={x} cy={y} r={20} fill={gold} />
                <circle cx={x} cy={y} r={11} className="pcb-hole" />
              </g>
            ))}
            {/* fiducial */}
            <circle cx={520} cy={470} r={16} fill="#000" opacity={0.18} />
            <circle cx={520} cy={470} r={7} fill={gold} />

            {/* silkscreen */}
            <text x={86} y={118} fill={silk} fontFamily={SANS} fontSize={46} fontWeight={700} letterSpacing={-0.5}>{name}</text>
            <text x={88} y={156} fill={silk} fontFamily={MONO} fontSize={18} letterSpacing={3} opacity={0.88}>{role.toUpperCase()}</text>
            <line x1={88} x2={210} y1={182} y2={182} stroke={silk} strokeWidth={3} />
            {lines.map((l, i) => (
              <text key={i} x={88} y={420 + i * 30} fill={silk} fontFamily={MONO} fontSize={19}>{l}</text>
            ))}
            <text x={700} y={524} fill={silk} fontFamily={MONO} fontSize={13} opacity={0.7}>REV A · 1.6mm</text>
          </g>
        ) : (
          <g>
            {/* traces climbing from the edge connector */}
            <g fill="none" stroke={copper} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
              {Array.from({ length: 11 }, (_, k) => {
                const x = 480 + k * 30
                const top = 300 + (k % 3) * 34
                return <path key={k} d={`M${x} 488 V${top}`} />
              })}
              <path d="M56 204 H380 L410 234 H452" />
            </g>
            {Array.from({ length: 11 }, (_, k) => via(480 + k * 30, 300 + (k % 3) * 34, `f${k}`))}
            <circle cx={462} cy={234} r={12} fill={gold} />
            <circle cx={462} cy={234} r={4.5} fill="#0b0b0a" opacity={0.8} />

            {/* gold edge fingers */}
            <rect x={460} y={478} width={340} height={70} fill="#000" opacity={0.16} />
            {Array.from({ length: 11 }, (_, k) => (
              <rect key={k} x={470 + k * 30} y={488} width={20} height={60} rx={3} fill={gold} />
            ))}
            <text x={462} y={470} fill={silk} fontFamily={MONO} fontSize={14} opacity={0.8}>J1</text>

            {/* silkscreen */}
            <QrBlock x={638} y={52} seed={name} fill={silk} />
            <text x={638} y={226} fill={silk} fontFamily={MONO} fontSize={13} letterSpacing={3} opacity={0.75}>SCAN · CONNECT</text>
            <text x={54} y={124} fill={silk} fontFamily={SANS} fontSize={54} fontWeight={700} letterSpacing={-1}>{name}</text>
            <text x={57} y={166} fill={silk} fontFamily={MONO} fontSize={18} letterSpacing={4} opacity={0.88}>{role.toUpperCase()}</text>
            {lines.map((l, i) => (
              <text key={i} x={56} y={404 + i * 30} fill={silk} fontFamily={MONO} fontSize={19}>{l}</text>
            ))}
          </g>
        )}

        {/* soldermask gloss */}
        <rect width={W} height={H} fill={`url(#gloss-${uid})`} />
      </g>
    </svg>
  )
}
