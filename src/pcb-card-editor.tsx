import React, { useState, useRef, useCallback } from "react";
import { UI, BOARD_COLORS } from "./colors";
import { listProjects, saveProject, deleteProject, type SavedProject } from "./projectStore";
import {
  MousePointer2,
  Spline,
  CircleDot,
  Square,
  Type,
  Image as ImageIcon,
  CircleDashed,
  Scissors,
  Download,
  Trash2,
  FolderOpen,
  Save,
  X,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ---- constants -------------------------------------------------------

const MM_TO_PX = 3.7795; // 96 DPI: 1mm = 96/25.4 px
const LAYERS = [
  { key: "topSilk", label: "Top Silk", swatch: "#f0f0e8" },
  { key: "topCopper", label: "Top Cupper", swatch: "#c8922a" },
  { key: "bottomCopper", label: "Bot Cupper", swatch: "#a87820" },
  { key: "bottomSilk", label: "Bot Silk", swatch: "#d8d8d0" },
  { key: "outline", label: "Outline", swatch: "#8a9298" },
];

const FONTS = [
  { key: "sans", label: "Grotesk", css: "Arial, Helvetica, sans-serif" },
  { key: "mono", label: "Mono", css: "'Courier New', monospace" },
  { key: "serif", label: "Serif", css: "Georgia, serif" },
  { key: "narrow", label: "Condensed", css: "'Arial Narrow', sans-serif" },
];

const TOOLS = [
  { key: "select", label: "Select", icon: MousePointer2 },
  { key: "trace", label: "Trace", icon: Spline },
  { key: "pad-tht", label: "Pad (THT)", icon: CircleDot },
  { key: "pad-smd", label: "Pad (SMD)", icon: Square },
  { key: "text", label: "Text", icon: Type },
  { key: "image", label: "Image", icon: ImageIcon },
  { key: "hole", label: "Hole", icon: CircleDashed },
  { key: "cutout", label: "Cutout", icon: Scissors },
];

let uidCounter = Date.now();
const uid = () => `el_${uidCounter++}`;

// ---- component ---------------------------------------------------------

export interface PCBProject {
  version: number
  board: { width: number; height: number; corner: number }
  boardColorKey: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements: any[]
}

export default function PCBCardEditor({ initialProject }: { initialProject?: PCBProject }) {
  const [board, setBoard] = useState(initialProject?.board ?? { width: 85, height: 54, corner: 3 });
  const [elements, setElements] = useState<any[]>(initialProject?.elements ?? []);
  const [tool, setTool] = useState("select");
  const [activeLayer, setActiveLayer] = useState("top");
  const [layersOpen, setLayersOpen] = useState(true);
  const [specOpen, setSpecOpen] = useState(true);
  const [layerVis, setLayerVis] = useState({
    topSilk: true,
    topCopper: true,
    bottomCopper: true,
    bottomSilk: true,
    outline: true,
  });
  const [selectedId, setSelectedId] = useState(null);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [cursorPt, setCursorPt] = useState<{ x: number, y: number } | null>(null);
  const drawingLayerRef = useRef("top");
  const [drawingConnections, setDrawingConnections] = useState<{ pointIndex: number, padId: string }[]>([]);
  const [zoom, setZoom] = useState(1.75);
  const [dragging, setDragging] = useState(null); // { id, startMouseMM, startPoints }
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panDrag, setPanDrag] = useState(null); // { startX, startY, origX, origY }
  const [gridSize, setGridSize] = useState(2.54);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [orthoMode, setOrthoMode] = useState(false);
  const [showDots, setShowDots] = useState(true);
  const [boardColorKey, setBoardColorKey] = useState(initialProject?.boardColorKey ?? "green");

  // ---- project system ----
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [projectName, setProjectName] = useState("Untitled");
  const [showProjects, setShowProjects] = useState(false);
  const [projects, setProjects] = useState<SavedProject[]>(() => listProjects());
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("Untitled");

  const refreshProjects = () => setProjects(listProjects());

  const currentProject = (): PCBProject => ({ version: 1, board, boardColorKey, elements });

  const handleSave = () => {
    const saved = saveProject(projectName, currentProject(), projectId);
    setProjectId(saved.id);
    refreshProjects();
  };

  const handleOpenProject = (entry: SavedProject) => {
    setBoard(entry.project.board);
    setBoardColorKey(entry.project.boardColorKey);
    setElements(entry.project.elements);
    setSelectedId(null);
    setProjectId(entry.id);
    setProjectName(entry.name);
    setNameInput(entry.name);
    setShowProjects(false);
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteProject(id);
    refreshProjects();
    if (id === projectId) { setProjectId(undefined); setProjectName("Untitled"); }
  };

  const handleNewProject = () => {
    setBoard({ width: 85, height: 54, corner: 3 });
    setBoardColorKey("green");
    setElements([]);
    setSelectedId(null);
    setProjectId(undefined);
    setProjectName("Untitled");
    setNameInput("Untitled");
    setShowProjects(false);
  };

  const commitName = () => {
    const n = nameInput.trim() || "Untitled";
    setProjectName(n);
    setEditingName(false);
  };
  const boardColor = BOARD_COLORS.find((c) => c.key === boardColorKey)!;
  const boardBorder = { stroke: "#ffffff60", strokeWidth: 2, vectorEffect: "non-scaling-stroke" } as const;
  const svgRef = useRef(null);
  const svgBackRef = useRef(null);
  const canvasWrapRef = useRef(null);

  const marginMM = 10;
  const gapMM = 1; // vertical margin between the two cards (in mm)
  const dotInset = 2; // mm inset from board edge to first dot row/col
  const viewW = board.width + marginMM * 2;
  // offset so dots are symmetric: half the leftover space on each side
  const dotOffsetX = (board.width % gridSize) / 2;
  const dotOffsetY = (board.height % gridSize) / 2;
  // front: full top margin, only gapMM at bottom
  const frontViewH = board.height + marginMM + gapMM;
  // back: only gapMM at top, full bottom margin
  const backViewH = board.height + gapMM + marginMM;

  const selected = elements.find((e) => e.id === selectedId) || null;

  // ---- coordinate helpers ----

  const clientToMM = useCallback(
    (clientX, clientY) => {
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const scaleX = viewW / rect.width;
      const scaleY = frontViewH / rect.height;
      return {
        x: (clientX - rect.left) * scaleX - marginMM,
        y: (clientY - rect.top) * scaleY - marginMM,
      };
    },
    [viewW, frontViewH]
  );

  const clientToMMBack = useCallback(
    (clientX, clientY) => {
      const svg = svgBackRef.current;
      const rect = svg.getBoundingClientRect();
      const scaleX = viewW / rect.width;
      const scaleY = backViewH / rect.height;
      const x = (clientX - rect.left) * scaleX - marginMM;
      const y = (clientY - rect.top) * scaleY - gapMM;
      // mirror X to match the scale(-1,1) transform on the back card
      return { x: board.width - x, y };
    },
    [viewW, backViewH, board.width]
  );

  // ---- grid snap helpers ----

  const snap = (v, offset: number) => snapEnabled ? Math.round((v - offset) / gridSize) * gridSize + offset : v;
  const snapPt = (p) => ({ x: snap(p.x, dotOffsetX), y: snap(p.y, dotOffsetY) });
  const snapDelta = (d) => (snapEnabled ? Math.round(d / gridSize) * gridSize : d);
  const snapOrtho = (pt: { x: number, y: number }, from: { x: number, y: number }) => {
    const dx = pt.x - from.x;
    const dy = pt.y - from.y;
    const angle = Math.atan2(dy, dx);
    const snap45 = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const cos45 = Math.cos(snap45);
    const sin45 = Math.sin(snap45);
    // project cursor onto the locked axis, then snap distance to grid
    const rawDist = dx * cos45 + dy * sin45;
    // for diagonal axes (45°) the grid step along the axis is gridSize*sqrt(2)
    const isDiag = Math.abs(Math.round(snap45 / (Math.PI / 4)) % 2) === 1;
    const axisStep = isDiag ? gridSize * Math.SQRT2 : gridSize;
    const snappedDist = snapEnabled ? Math.round(rawDist / axisStep) * axisStep : rawDist;
    return { x: from.x + snappedDist * cos45, y: from.y + snappedDist * sin45 };
  };

  // ---- element creation ----

  const addElement = (el) => {
    const withId = { ...el, id: uid() };
    setElements((prev) => [...prev, withId]);
    setSelectedId(withId.id);
  };

  const updateElement = (id, patch) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((prev) => prev.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  };

  // ---- canvas interaction ----

  const clampToBoard = (p: { x: number; y: number }) => ({
    x: Math.min(Math.max(p.x, 0), board.width),
    y: Math.min(Math.max(p.y, 0), board.height),
  });

  const PAD_SNAP_RADIUS = 2; // mm — snap to pad center if within this distance
  const PAD_COLLISION_RADIUS = 0.5; // mm — block new pad if an existing pad center is within this distance

  const padCollides = (pt: { x: number; y: number }, layer: string) => {
    return elements.some((e) => {
      if (e.type !== "pad") return false;
      // THT collides with everything; SMD only collides on same layer
      const layerMatch = e.layer === "both" || layer === "both" || e.layer === layer;
      if (!layerMatch) return false;
      const dx = pt.x - e.x;
      const dy = pt.y - e.y;
      return Math.sqrt(dx * dx + dy * dy) < PAD_COLLISION_RADIUS;
    });
  };

  const snapToPad = (pt: { x: number; y: number }, layer: string) => {
    const pads = elements.filter(
      (e) => e.type === "pad" && (e.layer === layer || e.layer === "both")
    );
    for (const pad of pads) {
      const dx = pt.x - pad.x;
      const dy = pt.y - pad.y;
      if (Math.sqrt(dx * dx + dy * dy) <= PAD_SNAP_RADIUS) {
        return { pt: { x: pad.x, y: pad.y }, padId: pad.id };
      }
    }
    return { pt, padId: null };
  };

  const handleCanvasClick = (e) => {
    if (dragging) return;
    const raw = clientToMM(e.clientX, e.clientY);
    const snapped = snapPt(raw);
    if (snapped.x < dotInset || snapped.x > board.width - dotInset || snapped.y < dotInset || snapped.y > board.height - dotInset) return;
    const pt = snapped;

    if (tool === "select") {
      setSelectedId(null);
      return;
    }
    if (tool === "trace" || tool === "cutout") {
      const layer = drawingPoints.length === 0 ? (drawingLayerRef.current = "top", "top") : drawingLayerRef.current;
      const { pt: padSnapped, padId } = snapToPad(pt, layer);
      const ortho = orthoMode && drawingPoints.length > 0 ? snapOrtho(padSnapped, drawingPoints[drawingPoints.length - 1]) : padSnapped;
      setDrawingPoints((prev) => [...prev, ortho]);
      if (padId) setDrawingConnections((prev) => [...prev, { pointIndex: drawingPoints.length, padId }]);
      return;
    }
    if (tool === "pad-tht") {
      if (!padCollides(pt, "both")) addElement({ type: "pad", kind: "tht", layer: "both", x: pt.x, y: pt.y, size: 1.6, drill: 0.8 });
      return;
    }
    if (tool === "pad-smd") {
      if (!padCollides(pt, activeLayer)) addElement({ type: "pad", kind: "smd", layer: activeLayer, x: pt.x, y: pt.y, shape: "rect", w: 1.6, h: 1.2 });
      return;
    }
    if (tool === "text") {
      addElement({ type: "text", layer: activeLayer, x: pt.x, y: pt.y, content: "TEXT", font: "sans", size: 4 });
      return;
    }
    if (tool === "hole") {
      addElement({ type: "hole", x: pt.x, y: pt.y, diameter: 3, plated: false });
      return;
    }
  };

  const finishDrawing = () => {
    if (tool === "trace" && drawingPoints.length >= 2) {
      addElement({ type: "trace", layer: drawingLayerRef.current, points: drawingPoints, width: 0.3, connections: drawingConnections });
    } else if (tool === "cutout" && drawingPoints.length >= 3) {
      addElement({ type: "cutout", points: drawingPoints });
    }
    setDrawingPoints([]);
    setDrawingConnections([]);
    setCursorPt(null);
    setTool("select");
  };

  const cancelDrawing = () => {
    setDrawingPoints([]);
    setDrawingConnections([]);
    setCursorPt(null);
  };

  const handleImageFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      addElement({
        type: "image",
        layer: activeLayer,
        x: board.width / 2 - 10,
        y: board.height / 2 - 10,
        w: 20,
        h: 20,
        src: reader.result,
      });
    };
    reader.readAsDataURL(file);
  };

  // ---- dragging existing elements ----

  const startDrag = (e, el, back = false, pointIndex: number | null = null) => {
    if (tool !== "select") return;
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedId(el.id);
    const pt = back ? clientToMMBack(e.clientX, e.clientY) : clientToMM(e.clientX, e.clientY);
    setDragging({ id: el.id, start: pt, orig: el, back, pointIndex });
  };

  const onPointerMove = (e) => {
    const pt = clientToMM(e.clientX, e.clientY);
    if (drawingPoints.length > 0 && drawingLayerRef.current === "top") {
      const snapped = snapPt(pt);
      setCursorPt(orthoMode && drawingPoints.length > 0 ? snapOrtho(snapped, drawingPoints[drawingPoints.length - 1]) : snapped);
    }
    if (!dragging || dragging.back) return;
    const orig = dragging.orig;
    if ((orig.type === "trace" || orig.type === "cutout") && dragging.pointIndex !== null) {
      // single-joint drag with ortho constraint
      const pi = dragging.pointIndex;
      const newPoints = orig.points.map((p: { x: number; y: number }, i: number) => {
        if (i !== pi) return p;
        const snapped = snapPt(pt);
        if (orthoMode) {
          const prev = orig.points[pi - 1];
          const next = orig.points[pi + 1];
          const anchor = prev ?? next;
          return anchor ? snapOrtho(snapped, anchor) : snapped;
        }
        return snapped;
      });
      updateElement(dragging.id, { points: newPoints });
      return;
    }
    const dx = snapDelta(pt.x - dragging.start.x);
    const dy = snapDelta(pt.y - dragging.start.y);
    if (orig.type === "trace" || orig.type === "cutout") {
      updateElement(dragging.id, {
        points: orig.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      });
    } else {
      const { x: newX, y: newY } = clampToBoard({ x: snap(orig.x + dx, dotOffsetX), y: snap(orig.y + dy, dotOffsetY) });
      const ATTACH_EPS = 0.5;
      setElements((prev) => {
        const pad = prev.find((el) => el.id === dragging.id);
        const padX = pad ? pad.x : orig.x;
        const padY = pad ? pad.y : orig.y;
        return prev.map((el) => {
          if (el.id === dragging.id) return { ...el, x: newX, y: newY };
          if (el.type !== "trace") return el;
          const newPoints = el.points.map((p: any) => {
            const dx2 = p.x - padX;
            const dy2 = p.y - padY;
            return Math.sqrt(dx2 * dx2 + dy2 * dy2) < ATTACH_EPS ? { x: newX, y: newY } : p;
          });
          return { ...el, points: newPoints };
        });
      });
    }
  };

  const onPointerUp = () => setDragging(null);

  // ---- zoom + pan ----

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((z) => {
      const next = z - e.deltaY * 0.0015;
      return Math.min(3, Math.max(0.5, +next.toFixed(2)));
    });
  };

  const startPan = (e) => {
    if (e.button !== 1) return;
    e.preventDefault();
    setPanDrag({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y });
  };

  const movePan = (e) => {
    if (!panDrag) return;
    setPan({
      x: panDrag.origX + (e.clientX - panDrag.startX),
      y: panDrag.origY + (e.clientY - panDrag.startY),
    });
  };

  const endPan = () => setPanDrag(null);

  // ---- keyboard ----

  const onKeyDown = (e) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
      const tag = document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      deleteSelected();
    }
    if (e.key === "Escape") cancelDrawing();
    if (e.key === "Enter" && drawingPoints.length) finishDrawing();
  };

  const exportProject = () => {
    const data = JSON.stringify({ version: 1, board, boardColorKey, elements }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project.pcb.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed.board) setBoard(parsed.board);
        if (parsed.boardColorKey) setBoardColorKey(parsed.boardColorKey);
        if (Array.isArray(parsed.elements)) {
          setElements(parsed.elements);
          setSelectedId(null);
        }
      } catch {
        alert("Invalid project file.");
      }
    };
    reader.readAsText(file);
  };

  const deleteElement = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedId((s: string | null) => (s === id ? null : s));
  };

  // ---- rendering helpers ----

  const cuPath = (pts, closed) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + (closed ? " Z" : "");

  const layerColor = (layer, kind) => {
    if (kind === "silk") return layer === "top" ? "#f0f0e8" : "#d8d8d0";
    return boardColor.copper;
  };

  return (
    <div
      className="w-full flex flex-col text-[15px]"
      style={{ background: UI.bgApp, color: UI.textPrimary, fontFamily: "Arial, sans-serif", height: "100vh" }}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{ borderColor: UI.border, background: UI.bgPanel }}
      >
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: UI.accent }} />
          <span className="font-mono tracking-widest text-[15px]" style={{ color: UI.textMuted }}>ETCH</span>
          <span style={{ color: UI.textFaint, fontSize: 14 }}>/</span>
          {editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
              className="font-mono text-[14px] bg-transparent border-b outline-none px-1"
              style={{ color: UI.textPrimary, borderColor: UI.accent, width: Math.max(120, nameInput.length * 8) }}
            />
          ) : (
            <button
              onClick={() => { setNameInput(projectName); setEditingName(true); }}
              className="font-mono text-[14px] hover:underline"
              style={{ color: UI.textFaint, background: 'none', border: 'none', cursor: 'text' }}
            >
              {projectName}.pcb
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProjects(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[15px] tracking-wide"
            style={{ background: showProjects ? UI.bgChipOn : 'transparent', color: UI.textMuted, border: `1px solid ${showProjects ? UI.border : 'transparent'}` }}
          >
            <BookOpen size={13} strokeWidth={2.5} />
            PROJECTS
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[15px] tracking-wide"
            style={{ background: UI.bgChipOn, color: UI.textMuted, border: `1px solid ${UI.borderSub}` }}
          >
            <Save size={13} strokeWidth={2.5} />
            SAVE
          </button>
          <button
            onClick={exportProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[15px] tracking-wide"
            style={{ background: UI.bgChipOn, color: UI.textMuted, border: `1px solid ${UI.borderSub}` }}
          >
            <Download size={13} strokeWidth={2.5} />
            EXPORT JSON
          </button>
          <label
            className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[15px] tracking-wide cursor-pointer"
            style={{ background: UI.bgChipOn, color: UI.textMuted, border: `1px solid ${UI.borderSub}` }}
          >
            <FolderOpen size={13} strokeWidth={2.5} />
            IMPORT JSON
            <input
              type="file" accept=".json" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) { importProject(e.target.files[0]); e.target.value = ""; } }}
            />
          </label>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[15px] tracking-wide"
            style={{ background: UI.accent, color: UI.accentText }}
          >
            <Download size={13} strokeWidth={2.5} />
            EXPORT GERBER
          </button>
        </div>
      </div>

      {/* Projects panel */}
      {showProjects && (
        <div
          className="absolute top-[45px] right-0 z-50 flex flex-col"
          style={{ width: 320, background: UI.bgPanel, borderLeft: `1px solid ${UI.border}`, borderBottom: `1px solid ${UI.border}`, maxHeight: 'calc(100vh - 45px)', overflowY: 'auto' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: UI.border }}>
            <span className="font-mono text-[12px] tracking-widest" style={{ color: UI.textFaint }}>PROJECTS</span>
            <button
              onClick={handleNewProject}
              className="font-mono text-[12px] px-2 py-1 rounded"
              style={{ background: UI.accent, color: '#fff', border: 'none' }}
            >
              + NEW
            </button>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center justify-center gap-2 mx-4 my-3 py-2 rounded font-mono text-[13px] tracking-wide w-[calc(100%-32px)]"
            style={{ background: UI.bgChipOn, color: UI.textMuted, border: `1px solid ${UI.borderSub}` }}
          >
            <Save size={13} strokeWidth={2.5} />
            SAVE CURRENT PROJECT
          </button>
          {projects.length === 0 && (
            <div className="px-4 pb-6 text-center font-mono text-[13px]" style={{ color: UI.textFaint }}>
              No saved projects yet.
            </div>
          )}
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => handleOpenProject(p)}
              className="flex items-center justify-between px-4 py-3 border-b text-left w-full group"
              style={{ borderColor: UI.borderSub, background: p.id === projectId ? UI.bgChipOn : 'transparent', border: 'none', borderBottom: `1px solid ${UI.borderSub}` }}
            >
              <div>
                <div className="font-mono text-[13px]" style={{ color: p.id === projectId ? UI.textPrimary : UI.textMuted }}>{p.name}</div>
                <div className="font-mono text-[11px] mt-0.5" style={{ color: UI.textFaint }}>
                  {p.project.boardColorKey} · {new Date(p.savedAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={(e) => handleDeleteProject(p.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded"
                style={{ color: UI.danger, background: 'none', border: 'none', transition: 'opacity 0.15s' }}
              >
                <X size={13} />
              </button>
            </button>
          ))}
        </div>
      )}


      {/* Second bar: layers, PCB color, grid */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b overflow-x-auto shrink-0"
        style={{ borderColor: UI.border, background: UI.bgApp }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] tracking-widest" style={{ color: UI.textFaint }}>PCB Color</span>
          {BOARD_COLORS.map((c) => (
            <button
              key={c.key}
              title={c.label}
              onClick={(e) => { setBoardColorKey(c.key); (e.currentTarget as HTMLButtonElement).blur() }}
              className="w-7 h-5 rounded-sm border focus:outline-none"
              style={{
                background: c.fill,
                borderColor: c.fill,
                outline: boardColorKey === c.key ? `2px solid ${UI.textMuted}` : "none",
                outlineOffset: "2px",
              }}
            />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 font-mono text-[12px]" style={{ color: UI.textFaint }}>
          <span>GRID</span>
          <button
            onClick={() => setShowDots((s) => !s)}
            className="px-2 py-1 rounded"
            style={{
              background: showDots ? UI.bgChipOn : "transparent",
              color: showDots ? UI.accent : UI.textFaint,
              border: `1px solid ${UI.borderSub}`,
            }}
          >{showDots ? "DOTS ON" : "DOTS OFF"}</button>
          <button
            onClick={() => setSnapEnabled((s) => !s)}
            className="px-2 py-1 rounded"
            style={{
              background: snapEnabled ? UI.bgChipOn : "transparent",
              color: snapEnabled ? UI.accent : UI.textFaint,
              border: `1px solid ${UI.borderSub}`,
            }}
          >{snapEnabled ? "SNAP ON" : "SNAP OFF"}</button>
          <button
            onClick={() => setOrthoMode((s) => !s)}
            className="px-2 py-1 rounded"
            style={{
              background: orthoMode ? UI.bgChipOn : "transparent",
              color: orthoMode ? UI.accent : UI.textFaint,
              border: `1px solid ${UI.borderSub}`,
            }}
          >{orthoMode ? "ORTHO ON" : "ORTHO OFF"}</button>
          {[2.54, 1.27].map((g) => (
            <button
              key={g}
              onClick={() => { setGridSize(g); setSnapEnabled(true); }}
              className="px-2 py-1 rounded"
              style={{
                background: snapEnabled && gridSize === g ? UI.accent : "transparent",
                color: snapEnabled && gridSize === g ? UI.accentText : UI.textFaint,
                border: `1px solid ${UI.borderSub}`,
              }}
            >{g}mm</button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {/* Tool rail â€" floating */}
        <div
          className="absolute left-3 top-4 z-20 flex flex-col items-center gap-1 py-3 px-2 rounded-xl shrink-0"
          style={{
            background: UI.bgPanel,
            border: `1px solid ${UI.border}`,
            boxShadow: "0 8px 32px 0 rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.12)",
          }}
        >
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = tool === t.key;
            return (
              <button
                key={t.key}
                title={t.label}
                onClick={() => {
                  setDrawingPoints([]);
                  setTool(t.key);
                  setSelectedId(null);
                  if (t.key === "image") {
                    document.getElementById("pcb-image-input")?.click();
                    setTool("select");
                  }
                }}
                className="w-9 h-9 flex items-center justify-center rounded-md transition"
                style={{
                  background: active ? UI.accent : "transparent",
                  color: active ? UI.accentText : UI.textMuted,
                }}
              >
                <Icon size={16} strokeWidth={2} />
              </button>
            );
          })}
          <input
            id="pcb-image-input"
            type="file"
            accept="image/*,.svg"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
              e.target.value = "";
            }}
          />
          {["pad-smd", "text", "image", "trace"].includes(tool) && (
            <div className="mt-2 flex flex-col gap-1">
              {["top", "bottom"].map((l) => (
                <button
                  key={l}
                  onClick={() => setActiveLayer(l)}
                  className="w-9 h-6 flex items-center justify-center rounded font-mono text-[13px] tracking-wide transition"
                  style={{
                    background: activeLayer === l ? UI.accent : UI.bgChipOn,
                    color: activeLayer === l ? UI.accentText : UI.textFaint,
                  }}
                >
                  {l === "top" ? "TOP" : "BOT"}
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Canvas */}
        <div
          className="flex-1 flex flex-col items-center justify-center overflow-hidden relative"
          style={{ background: UI.bgCanvas, cursor: panDrag ? "grabbing" : undefined }}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerLeave={endPan}
        >

          {/* â"€â"€ FRONT (top) â"€â"€ */}
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${viewW} ${frontViewH}`}
              width={viewW * MM_TO_PX * zoom}
              height={frontViewH * MM_TO_PX * zoom}
              onClick={handleCanvasClick}
              onContextMenu={(e) => { e.preventDefault(); if (drawingPoints.length) finishDrawing(); else setTool("select"); }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ cursor: panDrag ? "grabbing" : tool === "select" ? "default" : "crosshair", display: "block" }}
            >
              <defs>
                <linearGradient id="copperEdge" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#9ba3a8" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#3a3d40" stopOpacity="0.5" />
                </linearGradient>
                <pattern id="dotGrid" x={dotOffsetX} y={dotOffsetY} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                  <circle cx={0} cy={0} r={0.27} fill={boardColor.dot} fillOpacity={1} />
                </pattern>
                <clipPath id="boardClip">
                  <rect x={0} y={0} width={board.width} height={board.height} rx={board.corner} ry={board.corner} />
                </clipPath>
              </defs>
              <g transform={`translate(${marginMM}, ${marginMM})`}>
                {/* board substrate */}
                {layerVis.outline && (
                  <rect x={0} y={0} width={board.width} height={board.height} rx={board.corner} ry={board.corner}
                    fill={boardColor.fill} {...boardBorder} />
                )}
                {/* dot grid clipped to board shape */}
                {showDots && <rect x={dotInset} y={dotInset} width={board.width - dotInset * 2} height={board.height - dotInset * 2}
                  fill="url(#dotGrid)" clipPath="url(#boardClip)" />}
                {/* placement boundary overlay */}
                <rect x={0} y={0} width={board.width} height={board.height} rx={board.corner} ry={board.corner}
                  fill="none" stroke="#ffffff18" strokeWidth={0.4} strokeDasharray="1.5 1" vectorEffect="non-scaling-stroke" />

                {/* top copper */}
                {layerVis.topCopper &&
                  elements
                    .filter((e) => e.layer === "top" || e.layer === "both")
                    .filter((e) => e.type === "trace" || e.type === "pad")
                    .map((e) => renderElement(e, "copper"))}

                {/* top silk */}
                {layerVis.topSilk &&
                  elements
                    .filter((e) => e.layer === "top")
                    .filter((e) => e.type === "text" || e.type === "image")
                    .map((e) => renderElement(e, "silk"))}

                {/* holes + cutouts */}
                {elements.filter((e) => e.type === "hole" || e.type === "cutout").map((e) => renderElement(e, "board"))}

                {/* in-progress drawing */}
                {drawingPoints.length > 0 && drawingLayerRef.current === "top" && (
                  <>
                    <path d={cuPath(drawingPoints, false)} fill="none" stroke={boardColor.copper}
                      strokeWidth={tool === "trace" ? 0.3 : 0.15}
                      strokeDasharray={tool === "cutout" ? "0.6 0.4" : undefined} />
                    {cursorPt && (
                      <line
                        x1={drawingPoints[drawingPoints.length - 1].x} y1={drawingPoints[drawingPoints.length - 1].y}
                        x2={cursorPt.x} y2={cursorPt.y}
                        stroke={boardColor.copper} strokeWidth={tool === "trace" ? 0.3 : 0.15}
                        strokeDasharray="0.6 0.4" strokeOpacity={0.6}
                      />
                    )}
                    {drawingPoints.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={0.4} fill="#9ba3a8" />
                    ))}
                  </>
                )}
              </g>
            </svg>
          </div>

          {/* â"€â"€ BACK (bottom) â€" mirrored horizontally â"€â"€ */}
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
            <svg
              ref={svgBackRef}
              viewBox={`0 0 ${viewW} ${backViewH}`}
              width={viewW * MM_TO_PX * zoom}
              height={backViewH * MM_TO_PX * zoom}
              style={{ display: "block", cursor: tool === "select" ? "default" : "crosshair" }}
              onContextMenu={(e) => { e.preventDefault(); if (drawingPoints.length) finishDrawing(); else setTool("select"); }}
              onClick={(e) => {
                if (dragging) return;
                const raw = clientToMMBack(e.clientX, e.clientY);
                const snappedBack = snapPt(raw);
                if (snappedBack.x < dotInset || snappedBack.x > board.width - dotInset || snappedBack.y < dotInset || snappedBack.y > board.height - dotInset) return;
                const pt = snappedBack;
                if (tool === "trace" || tool === "cutout") {
                  if (drawingPoints.length === 0) drawingLayerRef.current = "bottom";
                  const { pt: padSnappedBack, padId } = snapToPad(pt, "bottom");
                  const ortho = orthoMode && drawingPoints.length > 0 ? snapOrtho(padSnappedBack, drawingPoints[drawingPoints.length - 1]) : padSnappedBack;
                  setDrawingPoints((prev) => [...prev, ortho]);
                  setDrawingConnections((prev) => padId ? [...prev, { pointIndex: drawingPoints.length, padId }] : prev);
                } else if (tool === "pad-tht") {
                  if (!padCollides(pt, "both")) addElement({ type: "pad", kind: "tht", layer: "both", x: pt.x, y: pt.y, size: 1.6, drill: 0.8 });
                } else if (tool === "pad-smd") {
                  if (!padCollides(pt, "bottom")) addElement({ type: "pad", kind: "smd", layer: "bottom", x: pt.x, y: pt.y, shape: "rect", w: 1.6, h: 1.2 });
                } else if (tool === "hole") {
                  addElement({ type: "hole", x: pt.x, y: pt.y, diameter: 3, plated: false });
                } else if (tool === "text") {
                  addElement({ type: "text", layer: "bottom", x: pt.x, y: pt.y, content: "TEXT", font: "sans", size: 4 });
                } else if (tool === "select") {
                  setSelectedId(null);
                }
              }}
              onPointerMove={(e) => {
                const pt = clientToMMBack(e.clientX, e.clientY);
                if (drawingPoints.length > 0 && drawingLayerRef.current === "bottom") {
                  const snapped = snapPt(pt);
                  setCursorPt(orthoMode && drawingPoints.length > 0 ? snapOrtho(snapped, drawingPoints[drawingPoints.length - 1]) : snapped);
                }
                if (!dragging || !dragging.back) return;
                const orig = dragging.orig;
                if ((orig.type === "trace" || orig.type === "cutout") && dragging.pointIndex !== null) {
                  const pi = dragging.pointIndex;
                  const newPoints = orig.points.map((p: { x: number; y: number }, i: number) => {
                    if (i !== pi) return p;
                    const snapped = snapPt(pt);
                    if (orthoMode) {
                      const prev = orig.points[pi - 1];
                      const next = orig.points[pi + 1];
                      const anchor = prev ?? next;
                      return anchor ? snapOrtho(snapped, anchor) : snapped;
                    }
                    return snapped;
                  });
                  updateElement(dragging.id, { points: newPoints });
                  return;
                }
                const dx = snapDelta(pt.x - dragging.start.x);
                const dy = snapDelta(pt.y - dragging.start.y);
                if (orig.type === "trace" || orig.type === "cutout") {
                  updateElement(dragging.id, { points: orig.points.map((p: { x: number, y: number }) => ({ x: p.x + dx, y: p.y + dy })) });
                } else {
                  const { x: newX, y: newY } = clampToBoard({ x: snap(orig.x + dx, dotOffsetX), y: snap(orig.y + dy, dotOffsetY) });
                  const ATTACH_EPS = 0.5;
                  setElements((prev) => {
                    const pad = prev.find((el) => el.id === dragging.id);
                    const padX = pad ? pad.x : orig.x;
                    const padY = pad ? pad.y : orig.y;
                    return prev.map((el) => {
                      if (el.id === dragging.id) return { ...el, x: newX, y: newY };
                      if (el.type !== "trace") return el;
                      const newPoints = el.points.map((p: any) => {
                        const dx2 = p.x - padX;
                        const dy2 = p.y - padY;
                        return Math.sqrt(dx2 * dx2 + dy2 * dy2) < ATTACH_EPS ? { x: newX, y: newY } : p;
                      });
                      return { ...el, points: newPoints };
                    });
                  });
                }
              }}
              onPointerUp={onPointerUp}
            >
              <defs>
                <linearGradient id="copperEdgeBack" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#9ba3a8" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#3a3d40" stopOpacity="0.5" />
                </linearGradient>
                <pattern id="dotGridBack" x={dotOffsetX} y={dotOffsetY} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                  <circle cx={0} cy={0} r={0.27} fill={boardColor.dot} fillOpacity={1} />
                </pattern>
                <clipPath id="boardClipBack">
                  <rect x={0} y={0} width={board.width} height={board.height} rx={board.corner} ry={board.corner} />
                </clipPath>
              </defs>
              {/* no mirror — board, text, traces, in-progress */}
              <g transform={`translate(${marginMM}, ${gapMM})`}>
                {/* board substrate */}
                {layerVis.outline && (
                  <rect x={0} y={0} width={board.width} height={board.height} rx={board.corner} ry={board.corner}
                    fill={boardColor.fill} {...boardBorder} />
                )}
                {/* dot grid */}
                {showDots && <rect x={dotInset} y={dotInset} width={board.width - dotInset * 2} height={board.height - dotInset * 2}
                  fill="url(#dotGridBack)" clipPath="url(#boardClipBack)" />}
                {/* placement boundary overlay */}
                <rect x={0} y={0} width={board.width} height={board.height} rx={board.corner} ry={board.corner}
                  fill="none" stroke="#ffffff18" strokeWidth={0.4} strokeDasharray="1.5 1" vectorEffect="non-scaling-stroke" />

                {/* bottom copper traces — mirrored to match stored coordinates */}
                {layerVis.bottomCopper && (
                  <g transform={`scale(-1,1) translate(${-board.width}, 0)`}>
                    {elements
                      .filter((e) => e.layer === "bottom" || e.layer === "both")
                      .filter((e) => e.type === "trace")
                      .map((e) => renderElement(e, "copper", true))}
                  </g>
                )}

                {/* bottom silk */}
                {layerVis.bottomSilk &&
                  elements
                    .filter((e) => e.layer === "bottom")
                    .filter((e) => e.type === "text" || e.type === "image")
                    .map((e) => renderElement(e, "silk", true))}

                {/* cutouts */}
                {elements.filter((e) => e.type === "cutout").map((e) => renderElement(e, "board", true))}

                {/* in-progress drawing on back canvas */}
                {drawingPoints.length > 0 && drawingLayerRef.current === "bottom" && (
                  <g transform={`scale(-1,1) translate(${-board.width}, 0)`}>
                    <path d={cuPath(drawingPoints, false)} fill="none" stroke={boardColor.copper}
                      strokeWidth={tool === "trace" ? 0.3 : 0.15}
                      strokeDasharray={tool === "cutout" ? "0.6 0.4" : undefined} />
                    {cursorPt && (
                      <line
                        x1={drawingPoints[drawingPoints.length - 1].x} y1={drawingPoints[drawingPoints.length - 1].y}
                        x2={cursorPt.x} y2={cursorPt.y}
                        stroke={boardColor.copper} strokeWidth={tool === "trace" ? 0.3 : 0.15}
                        strokeDasharray="0.6 0.4" strokeOpacity={0.6}
                      />
                    )}
                    {drawingPoints.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={0.4} fill="#9ba3a8" />
                    ))}
                  </g>
                )}
              </g>

              {/* mirrored — THT pads and holes only */}
              <g transform={`translate(${marginMM}, ${gapMM}) scale(-1,1) translate(${-board.width}, 0)`}>
                {layerVis.bottomCopper &&
                  elements
                    .filter((e) => e.layer === "both")
                    .filter((e) => e.type === "pad" && e.kind === "tht")
                    .map((e) => renderElement(e, "copper", true))}
                {elements.filter((e) => e.type === "hole").map((e) => renderElement(e, "board", true))}
              </g>
            </svg>
          </div>
        </div>

        {/* Zoom control - bottom center floating */}
        <div
          className="absolute bottom-4 right-3 z-20 flex items-center gap-1 px-3 py-1.5 rounded-xl font-mono text-[13px]"
          style={{
            background: UI.bgPanel,
            border: `1px solid ${UI.border}`,
            boxShadow: "0 8px 32px 0 rgba(0,0,0,0.6)",
            color: UI.textMuted,
          }}
        >
          <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded hover:opacity-70 transition">−</button>
          <span className="w-12 text-center cursor-pointer" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset zoom">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded hover:opacity-70 transition">+</button>
        </div>

        {/* Layers panel - floating bottom-left, foldable */}
        <div
          className="absolute left-3 bottom-4 z-20 flex flex-col rounded-xl overflow-hidden"
          style={{
            background: UI.bgPanel,
            border: `1px solid ${UI.border}`,
            boxShadow: "0 8px 32px 0 rgba(0,0,0,0.6)",
            width: layersOpen ? "140px" : "56px",
            transition: "width 0.2s ease",
          }}
        >
          <button
            onClick={() => setLayersOpen((o) => !o)}
            className="flex items-center justify-center mt-1 py-1 rounded-lg transition"
            style={{ color: UI.textFaint, fontSize: 16, border: `1px solid ${UI.borderSub}` }}
          >{layersOpen ? "◂ hide" : "▸"}</button>

          <div className="flex flex-col gap-0.5 p-2">
            {LAYERS.map((l) => {
              const on = layerVis[l.key];
              return (
                <button
                  key={l.key}
                  onClick={() => setLayerVis((v) => ({ ...v, [l.key]: !v[l.key] }))}
                  className="flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg transition"
                  style={{
                    background: on ? "rgba(255,255,255,0.05)" : "transparent",
                    border: `1px solid ${on ? l.swatch + "60" : "transparent"}`,
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: on ? l.swatch : UI.borderSub }}
                  />
                  {layersOpen && (
                    <span className="font-mono text-[12px] tracking-wide whitespace-nowrap overflow-hidden" style={{ color: on ? UI.textPrimary : UI.textFaint }}>
                      {l.label}
                    </span>
                  )}
                </button>
              );
            })}

          </div>
        </div>

        {/* Properties panel - floating */}
        <div
          className="absolute right-3 top-4 z-20 flex flex-col rounded-xl overflow-hidden"
          style={{
            background: UI.bgPanel,
            border: `1px solid ${UI.border}`,
            boxShadow: "0 8px 32px 0 rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.12)",
            maxHeight: "calc(100% - 2rem)",
            width: specOpen ? "16rem" : "auto",
            transition: "width 0.2s ease",
          }}
        >
          <button
            className="px-3 py-2 font-mono text-[14px] tracking-widest flex items-center justify-between gap-2 w-full"
            style={{ borderBottom: specOpen ? `1px solid ${UI.border}` : "none", color: UI.textFaint, background: "transparent", whiteSpace: "nowrap" }}
            onClick={() => setSpecOpen(o => !o)}
          >
            <span>{specOpen ? (selected ? selected.type.toUpperCase() + " — SPEC" : "BOARD — SPEC") : ""}</span>
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 22, height: 22, borderRadius: 5,
              background: UI.bgChipOn, border: `1px solid ${UI.border}`,
              color: UI.textPrimary, flexShrink: 0,
            }}>
              {specOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>
          {specOpen && <div className="p-3 flex flex-col gap-3 overflow-y-auto">
            {!selected && <BoardProps board={board} setBoard={setBoard} />}
            {selected?.type === "trace" && (
              <NumberField label="Width (mm)" value={selected.width} step={0.05} min={0.1}
                onChange={(v) => updateElement(selected.id, { width: v })} />
            )}
            {selected?.type === "pad" && (
              <PadProps pad={selected} onChange={(patch) => updateElement(selected.id, patch)} />
            )}
            {selected?.type === "text" && (
              <TextProps el={selected} onChange={(patch) => updateElement(selected.id, patch)} />
            )}
            {selected?.type === "hole" && (
              <HoleProps el={selected} onChange={(patch) => updateElement(selected.id, patch)} />
            )}
            {selected?.type === "image" && (
              <NumberField label="Width (mm)" value={selected.w} step={0.5} min={2}
                onChange={(v) => updateElement(selected.id, { w: v, h: v * (selected.h / selected.w) })} />
            )}
            {selected && (
              <button
                onClick={deleteSelected}
                className="mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded font-mono text-[15px]"
                style={{ background: UI.dangerBg, color: UI.danger, border: `1px solid ${UI.dangerBorder}` }}
              >
                <Trash2 size={13} /> DELETE ELEMENT
              </button>
            )}
          </div>}
        </div>
      </div>
    </div>
  );

  // ---- element renderer (closure over state) ----

  function renderElement(el, pass, isBack = false) {
    const isSelected = el.id === selectedId;
    const strokeSel = isSelected ? { stroke: "#9ba3a8", strokeWidth: 0.15, strokeDasharray: "0.4 0.3" } : {};
    const onRMB = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (tool !== "select") {
        if (drawingPoints.length) finishDrawing();
        else setTool("select");
        return;
      }
      deleteElement(e, el.id);
    };

    if (el.type === "trace") {
      return (
        <g key={el.id} onClick={(e) => { if (tool === "select") e.stopPropagation(); }} onContextMenu={onRMB}>
          {/* hit-area + body — whole-trace drag when not clicking a joint */}
          <path
            d={cuPath(el.points, false)}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(el.width + 1.5, 2.5)}
            strokeLinecap="round"
            style={{ cursor: tool === "select" ? "move" : "inherit" }}
            onPointerDown={(e) => startDrag(e, el, isBack, null)}
          />
          <path
            d={cuPath(el.points, false)}
            fill="none"
            stroke={layerColor(el.layer, "copper")}
            strokeWidth={el.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: "none" }}
          />
          {isSelected && (
            <path d={cuPath(el.points, false)} fill="none" stroke="#9ba3a8" strokeWidth={el.width + 0.3}
              strokeOpacity={0.35} strokeLinecap="round" style={{ pointerEvents: "none" }} />
          )}
          {/* joint handles */}
          {isSelected && el.points.map((p: { x: number; y: number }, i: number) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={0.7}
              fill="#1a1c1e"
              stroke="#9ba3a8"
              strokeWidth={0.2}
              style={{ cursor: tool === "select" ? "grab" : "inherit" }}
              onPointerDown={(e) => startDrag(e, el, isBack, i)}
            />
          ))}
        </g>
      );
    }
    if (el.type === "pad") {
      const fill = "#c8ccd0";
      return (
        <g key={el.id} onPointerDown={(e) => startDrag(e, el, isBack)} onClick={(e) => { if (tool === "select") e.stopPropagation(); }} onContextMenu={onRMB} style={{ cursor: tool === "select" ? "move" : "inherit" }}>
          {el.kind === "tht" ? (
            <>
              <circle cx={el.x} cy={el.y} r={el.size / 2} fill={fill} {...strokeSel} />
              <circle cx={el.x} cy={el.y} r={el.drill / 2} fill="#18191b" />
            </>
          ) : (
            <rect x={el.x - el.w / 2} y={el.y - el.h / 2} width={el.w} height={el.h} fill={fill} {...strokeSel} />
          )}
        </g>
      );
    }
    if (el.type === "text") {
      const font = FONTS.find((f) => f.key === el.font) || FONTS[0];
      return (
        <text
          key={el.id}
          x={el.x}
          y={el.y}
          fontSize={el.size}
          fontFamily={font.css}
          fill={layerColor(el.layer, "silk")}
          onPointerDown={(e) => startDrag(e, el, isBack)}
          onClick={(e) => { if (tool === "select") e.stopPropagation(); }}
          onContextMenu={onRMB}
          style={{ cursor: "move", ...(isSelected ? { paintOrder: "stroke", stroke: "#9ba3a8", strokeWidth: 0.15 } : {}) }}
        >
          {el.content}
        </text>
      );
    }
    if (el.type === "image") {
      return (
        <image
          key={el.id}
          href={el.src}
          x={el.x}
          y={el.y}
          width={el.w}
          height={el.h}
          onPointerDown={(e) => startDrag(e, el, isBack)}
          onClick={(e) => { if (tool === "select") e.stopPropagation(); }}
          onContextMenu={onRMB}
          style={{ cursor: tool === "select" ? "move" : "inherit" }}
          opacity={0.92}
        />
      );
    }
    if (el.type === "hole") {
      return (
        <g key={el.id} onPointerDown={(e) => startDrag(e, el, isBack)} onClick={(e) => { if (tool === "select") e.stopPropagation(); }} onContextMenu={onRMB} style={{ cursor: tool === "select" ? "move" : "inherit" }}>
          <circle cx={el.x} cy={el.y} r={el.diameter / 2} fill="#18191b" stroke={el.plated ? boardColor.copper : "#6b6e71"}
            strokeWidth={0.25} {...strokeSel} />
        </g>
      );
    }
    if (el.type === "cutout") {
      return (
        <path
          key={el.id}
          d={cuPath(el.points, true)}
          fill="#18191b"
          stroke={isSelected ? "#9ba3a8" : "#6b6e71"}
          strokeWidth={0.2}
          onPointerDown={(e) => startDrag(e, el, isBack)}
          onClick={(e) => { if (tool === "select") e.stopPropagation(); }}
          onContextMenu={onRMB}
          style={{ cursor: tool === "select" ? "move" : "inherit" }}
        />
      );
    }
    return null;
  }
}

// ---- small property widgets ---------------------------------------------

function Label({ children }) {
  return (
    <span className="font-mono text-[14px] tracking-widest block mb-1" style={{ color: UI.textFaint }}>
      {children}
    </span>
  );
}

function NumberField({ label, value, onChange, step = 1, min }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2 py-1.5 rounded font-mono text-[14px] outline-none"
        style={{ background: UI.bgInput, border: `1px solid ${UI.borderSub}`, color: UI.textPrimary }}
      />
    </div>
  );
}

function BoardProps({ board, setBoard }) {
  return (
    <>
      <NumberField label="Width (mm)" value={board.width} onChange={(v) => setBoard((b) => ({ ...b, width: v }))} />
      <NumberField label="Height (mm)" value={board.height} onChange={(v) => setBoard((b) => ({ ...b, height: v }))} />
      <NumberField label="Corner radius (mm)" value={board.corner} step={0.5} min={0}
        onChange={(v) => setBoard((b) => ({ ...b, corner: v }))} />
      <div className="pt-2 mt-1 border-t" style={{ borderColor: UI.border }}>
        <Label>Preset</Label>
        <button
          onClick={() => setBoard({ width: 85, height: 54, corner: 3 })}
          className="w-full px-2 py-1.5 rounded font-mono text-[15px]"
          style={{ background: UI.bgChipOn, color: UI.accentDark }}
        >
          Standard 85 × 54mm
        </button>
      </div>
    </>
  );
}

function PadProps({ pad, onChange }) {
  return (
    <>
      {pad.kind === "tht" ? (
        <>
          <NumberField label="Pad diameter (mm)" value={pad.size} step={0.1} min={0.3}
            onChange={(v) => onChange({ size: v })} />
          <NumberField label="Drill diameter (mm)" value={pad.drill} step={0.1} min={0.1}
            onChange={(v) => onChange({ drill: v })} />
        </>
      ) : (
        <>
          <NumberField label="Width (mm)" value={pad.w} step={0.1} min={0.2} onChange={(v) => onChange({ w: v })} />
          <NumberField label="Height (mm)" value={pad.h} step={0.1} min={0.2} onChange={(v) => onChange({ h: v })} />
        </>
      )}
    </>
  );
}

function TextProps({ el, onChange }) {
  return (
    <>
      <div>
        <Label>Content</Label>
        <input
          value={el.content}
          onChange={(e) => onChange({ content: e.target.value })}
          className="w-full px-2 py-1.5 rounded text-[14px] outline-none"
          style={{ background: UI.bgInput, border: `1px solid ${UI.borderSub}`, color: UI.textPrimary }}
        />
      </div>
      <div>
        <Label>Font</Label>
        <div className="grid grid-cols-2 gap-1">
          {FONTS.map((f) => (
            <button
              key={f.key}
              onClick={() => onChange({ font: f.key })}
              className="px-2 py-1.5 rounded text-[15px]"
              style={{
                fontFamily: f.css,
                background: el.font === f.key ? UI.accent : UI.bgInput,
                color: el.font === f.key ? UI.accentText : UI.textMuted,
                border: `1px solid ${UI.borderSub}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <NumberField label="Size (mm)" value={el.size} step={0.5} min={1} onChange={(v) => onChange({ size: v })} />
    </>
  );
}

function HoleProps({ el, onChange }) {
  return (
    <>
      <NumberField label="Diameter (mm)" value={el.diameter} step={0.1} min={0.3}
        onChange={(v) => onChange({ diameter: v })} />
      <div>
        <Label>Plated</Label>
        <div className="grid grid-cols-2 gap-1">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              onClick={() => onChange({ plated: v })}
              className="px-2 py-1.5 rounded font-mono text-[15px]"
              style={{
                background: el.plated === v ? UI.accent : UI.bgInput,
                color: el.plated === v ? UI.accentText : UI.textMuted,
                border: `1px solid ${UI.borderSub}`,
              }}
            >
              {v ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
