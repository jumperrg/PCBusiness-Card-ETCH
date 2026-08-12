import { type PCBProject } from './pcb-card-editor'

export interface SavedProject {
  id: string
  name: string
  savedAt: number
  project: PCBProject
}

const KEY = 'pcb-card-maker:projects'

const SEED_PROJECTS: { name: string; project: PCBProject }[] = [
  {
    name: 'Demo Card — Green',
    project: {
      version: 1,
      board: { width: 85, height: 54, corner: 3 },
      boardColorKey: 'green',
      elements: [
        { id: 's1', type: 'text', layer: 'top', x: 10, y: 18, content: 'Jane Engineer', font: 'sans', size: 4.5 },
        { id: 's2', type: 'text', layer: 'top', x: 10, y: 26, content: 'Hardware Design', font: 'sans', size: 2.5 },
        { id: 's3', type: 'text', layer: 'top', x: 10, y: 42, content: 'jane@example.com', font: 'mono', size: 2 },
        { id: 's4', type: 'trace', layer: 'top', points: [{ x: 5, y: 5 }, { x: 50, y: 5 }, { x: 50, y: 32 }, { x: 80, y: 32 }], width: 0.3 },
        { id: 's5', type: 'trace', layer: 'bottom', points: [{ x: 5, y: 49 }, { x: 70, y: 49 }], width: 0.4 },
        { id: 's6', type: 'pad', kind: 'smd', layer: 'top', x: 75, y: 14, shape: 'rect', w: 2, h: 1.4 },
        { id: 's7', type: 'pad', kind: 'smd', layer: 'top', x: 75, y: 18, shape: 'rect', w: 2, h: 1.4 },
        { id: 's8', type: 'pad', kind: 'tht', layer: 'both', x: 75, y: 24, size: 2.5, drill: 1.2 },
      ],
    },
  },
  {
    name: 'Demo Card — Blue',
    project: {
      version: 1,
      board: { width: 85, height: 54, corner: 3 },
      boardColorKey: 'blue',
      elements: [
        { id: 'b1', type: 'text', layer: 'top', x: 10, y: 18, content: 'Sam Circuit', font: 'mono', size: 4.5 },
        { id: 'b2', type: 'text', layer: 'top', x: 10, y: 26, content: 'Embedded Systems', font: 'sans', size: 2.5 },
        { id: 'b3', type: 'text', layer: 'top', x: 10, y: 42, content: 'sam@circuits.io', font: 'mono', size: 2 },
        { id: 'b4', type: 'trace', layer: 'top', points: [{ x: 5, y: 8 }, { x: 80, y: 8 }], width: 0.25 },
        { id: 'b5', type: 'trace', layer: 'top', points: [{ x: 5, y: 46 }, { x: 40, y: 46 }, { x: 40, y: 8 }], width: 0.25 },
        { id: 'b6', type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 20, shape: 'rect', w: 2, h: 1.4 },
        { id: 'b7', type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 24, shape: 'rect', w: 2, h: 1.4 },
        { id: 'b8', type: 'pad', kind: 'smd', layer: 'top', x: 78, y: 28, shape: 'rect', w: 2, h: 1.4 },
        { id: 'b9', type: 'pad', kind: 'tht', layer: 'both', x: 78, y: 35, size: 2.5, drill: 1.2 },
      ],
    },
  },
  {
    name: 'Demo Card — Black',
    project: {
      version: 1,
      board: { width: 85, height: 54, corner: 3 },
      boardColorKey: 'black',
      elements: [
        { id: 'k1', type: 'text', layer: 'top', x: 10, y: 18, content: 'Alex Volt', font: 'narrow', size: 5 },
        { id: 'k2', type: 'text', layer: 'top', x: 10, y: 27, content: 'Power Electronics', font: 'sans', size: 2.5 },
        { id: 'k3', type: 'text', layer: 'top', x: 10, y: 42, content: 'alex@volt.dev', font: 'mono', size: 2 },
        { id: 'k4', type: 'trace', layer: 'top', points: [{ x: 5, y: 35 }, { x: 35, y: 35 }, { x: 35, y: 5 }, { x: 80, y: 5 }], width: 0.5 },
        { id: 'k5', type: 'trace', layer: 'bottom', points: [{ x: 5, y: 5 }, { x: 20, y: 5 }, { x: 20, y: 49 }, { x: 60, y: 49 }], width: 0.4 },
        { id: 'k6', type: 'pad', kind: 'smd', layer: 'top', x: 76, y: 14, shape: 'rect', w: 2.2, h: 1.2 },
        { id: 'k7', type: 'pad', kind: 'smd', layer: 'top', x: 76, y: 18, shape: 'rect', w: 2.2, h: 1.2 },
        { id: 'k8', type: 'pad', kind: 'tht', layer: 'both', x: 76, y: 25, size: 2.8, drill: 1.4 },
      ],
    },
  },
]

export function seedProjectsOnce() {
  const existing = listProjects()
  const hasSeed = existing.some(p => p.id.startsWith('seed_'))
  if (hasSeed || existing.length > 0) return
  const seeded: SavedProject[] = SEED_PROJECTS.map((s, i) => ({
    id: `seed_${i + 1}`,
    name: s.name,
    savedAt: Date.now() - (SEED_PROJECTS.length - i) * 60000,
    project: s.project,
  }))
  localStorage.setItem(KEY, JSON.stringify(seeded))
}

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
