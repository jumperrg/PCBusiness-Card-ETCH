import { type PCBProject } from './pcb-card-editor'

export interface SavedProject {
  id: string
  name: string
  savedAt: number
  project: PCBProject
  thumbnail?: string
  thumbnailVersion?: number
}

const KEY = 'pcb-card-maker:projects'

// Bump when the thumbnail rasterization/crop logic changes so stale
// thumbnails saved under the old crop get dropped instead of shown.
const THUMBNAIL_VERSION = 5

export function listProjects(): SavedProject[] {
  try {
    const all: SavedProject[] = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return all.map(p =>
      p.thumbnail && p.thumbnailVersion !== THUMBNAIL_VERSION
        ? { ...p, thumbnail: undefined }
        : p
    )
  } catch {
    return []
  }
}

export function saveProject(name: string, project: PCBProject, existingId?: string, thumbnail?: string): SavedProject {
  const all = listProjects()
  const id = existingId ?? `proj_${Date.now()}`
  const prevThumbnail = existingId ? all.find(p => p.id === existingId)?.thumbnail : undefined
  const finalThumbnail = thumbnail ?? prevThumbnail
  const entry: SavedProject = {
    id, name, savedAt: Date.now(), project,
    thumbnail: finalThumbnail,
    thumbnailVersion: finalThumbnail ? THUMBNAIL_VERSION : undefined,
  }
  const idx = all.findIndex(p => p.id === id)
  if (idx >= 0) all[idx] = entry
  else all.unshift(entry)
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 4)))
  return entry
}

export function deleteProject(id: string) {
  const all = listProjects().filter(p => p.id !== id)
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function getProject(id: string): SavedProject | undefined {
  return listProjects().find(p => p.id === id)
}
