import { useEffect, useState } from 'react'
import LandingPage from './LandingPage'
import PCBCardEditor from './pcb-card-editor'

function navigate(path: string) {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (path === '/editor') return <PCBCardEditor />
  return <LandingPage onStart={() => navigate('/editor')} />
}
