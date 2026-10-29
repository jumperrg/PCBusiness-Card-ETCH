import type { ReactNode } from 'react'
import { UI } from './colors'
import { navigate } from './App'
import { LayoutGrid, BookOpen } from 'lucide-react'

interface Props {
  active?: 'gallery' | 'projects'
  /** Replaces the logo area on the left (e.g. the editor's project-name field). Defaults to the ETCH logo. */
  left?: ReactNode
  /** Extra buttons rendered between the nav links and the right-side CTA. */
  children?: ReactNode
  /** Replaces the default "Start Editing" CTA on the right. Pass null to omit it. */
  right?: ReactNode
  /** Hide the GALLERY / PROJECTS links (the editor exposes them via its File menu instead). */
  hideNav?: boolean
}

export default function Header({ active, left, children, right, hideNav }: Props) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2 border-b shrink-0"
      style={{ borderColor: UI.border, background: UI.bgPanel }}
    >
      <div className="flex items-center gap-3">
        {left ?? (
          <>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: UI.accent }} />
            <span
              className="font-mono tracking-widest text-[15px] cursor-pointer"
              style={{ color: UI.textMuted }}
              onClick={() => navigate('/')}
            >
              ETCH
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!hideNav && <>
        <button
          onClick={() => navigate('/gallery')}
          className="flex items-center gap-1.5 px-2 py-1.5 font-mono text-[15px] tracking-wide hover:underline"
          style={{ background: 'transparent', color: active === 'gallery' ? UI.textPrimary : UI.textMuted, border: 'none' }}
        >
          <LayoutGrid size={13} strokeWidth={2.5} />
          GALLERY
        </button>
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1.5 px-2 py-1.5 font-mono text-[15px] tracking-wide hover:underline"
          style={{ background: 'transparent', color: active === 'projects' ? UI.textPrimary : UI.textMuted, border: 'none' }}
        >
          <BookOpen size={13} strokeWidth={2.5} />
          PROJECTS
        </button>
        </>}
        {children}
        {right !== undefined ? right : (
          <button
            onClick={() => navigate('/editor')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[15px] tracking-wide"
            style={{ background: UI.accent, color: UI.accentText, border: 'none' }}
          >
            START EDITING
          </button>
        )}
      </div>
    </div>
  )
}
