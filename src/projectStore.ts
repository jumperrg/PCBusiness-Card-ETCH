import { type PCBProject } from './pcb-card-editor'

export interface SavedProject {
  id: string
  name: string
  savedAt: number
  project: PCBProject
}

const KEY = 'pcb-card-maker:projects'

export function listProjects(): SavedProject[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveProject(name: string, project: PCBProject, existingId?: string): SavedProject {
  const all = listProjects()
  const id = existingId ?? `proj_${Date.now()}`
  const entry: SavedProject = { id, name, savedAt: Date.now(), project }
  const idx = all.findIndex(p => p.id === id)
  if (idx >= 0) all[idx] = entry
  else all.unshift(entry)
  localStorage.setItem(KEY, JSON.stringify(all))
  return entry
}

export function deleteProject(id: string) {
  const all = listProjects().filter(p => p.id !== id)
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function getProject(id: string): SavedProject | undefined {
  return listProjects().find(p => p.id === id)
}
