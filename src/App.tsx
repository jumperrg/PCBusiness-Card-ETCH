import { useEffect, useState } from 'react'
import LandingPage from './LandingPage'
import PCBCardEditor, { type PCBProject } from './pcb-card-editor'
import GalleryPage from './GalleryPage'
import ProjectsPage from './ProjectsPage'

const SESSION_KEY = 'pcb:pending-project'
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

function getRoute() {
  // Handle hard-refresh redirect from 404.html
  const params = new URLSearchParams(window.location.search)
  const redirected = params.get('r')
  if (redirected) {
    window.history.replaceState(null, '', BASE + redirected)
    return redirected
  }
  const pathname = window.location.pathname
  return pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : '/'
}

export function navigate(path: string) {
  window.history.pushState(null, '', BASE + path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function openInEditor(project: PCBProject) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(project))
  navigate('/editor')
}

export default function App() {
  const [path, setPath] = useState(getRoute)
  const [editorKey, setEditorKey] = useState(0)
  const [pendingProject, setPendingProject] = useState<PCBProject | undefined>(() => {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) { sessionStorage.removeItem(SESSION_KEY); return JSON.parse(raw) }
    return undefined
  })

  useEffect(() => {
    const onPop = () => {
      const route = getRoute()
      setPath(route)
      if (route === '/editor') {
        const raw = sessionStorage.getItem(SESSION_KEY)
        if (raw) {
          sessionStorage.removeItem(SESSION_KEY)
          setPendingProject(JSON.parse(raw))
        }
        setEditorKey(k => k + 1)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (path === '/editor') {
    return <PCBCardEditor key={editorKey} initialProject={pendingProject} />
  }

  if (path === '/gallery') return (
    <GalleryPage
      onBack={() => navigate('/')}
      onEdit={() => navigate('/editor')}
      onOpenProject={openInEditor}
    />
  )

  if (path === '/projects') return (
    <ProjectsPage
      onBack={() => navigate('/')}
      onEdit={() => navigate('/editor')}
      onOpenProject={openInEditor}
    />
  )

  return (
    <LandingPage
      onStart={() => navigate('/editor')}
      onGallery={() => navigate('/gallery')}
      onProjects={() => navigate('/projects')}
    />
  )
}
