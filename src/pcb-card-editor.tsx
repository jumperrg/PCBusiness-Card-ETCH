import React, { useState, useRef, useCallback } from "react";
import {
  MousePointer2,
  Spline,
  CircleDot,
  Square,
  Type,
  Image as ImageIcon,
  CircleDashed,
  Scissors,
  ZoomIn,
  ZoomOut,
  Download,
  Trash2,
  Check,
  X as XIcon,
} from "lucide-react";

// ---- constants -------------------------------------------------------

const MM_TO_PX = 7; // canvas scale
const LAYERS = [
  { key: "topSilk", label: "Top Silk", swatch: "#ececeb" },
  { key: "topCopper", label: "Top Cu", swatch: "#d79a52" },
  { key: "bottomCopper", label: "Bot Cu", swatch: "#b9863f" },
  { key: "bottomSilk", label: "Bot Silk", swatch: "#c9cacb" },
  { key: "outline", label: "Outline", swatch: "#9ba3a8" },
];

const BOARD_COLORS = [
  { key: "green",  label: "Green",  fill: "#1a2e1a", dot: "#2d5a2d" },
  { key: "black",  label: "Black",  fill: "#111214", dot: "#2a2d31" },
  { key: "white",  label: "White",  fill: "#d8d9d5", dot: "#a8aaa6" },
  { key: "blue",   label: "Blue",   fill: "#0d1a2e", dot: "#1a3a6b" },
  { key: "red",    label: "Red",    fill: "#2e0d0d", dot: "#6b1a1a" },
  { key: "yellow", label: "Yellow", fill: "#FDE11C", dot: "#5a4e00" },
  { key: "purple", label: "Purple", fill: "#1a0d2e", dot: "#3d1a6b" },
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

let uidCounter = 1;
const uid = () => `el_${uidCounter++}`;

// ---- component ---------------------------------------------------------

export default function PCBCardEditor() {
  const [board, setBoard] = useState({ width: 85, height: 54, corner: 3 });
  const [elements, setElements] = useState([]);
  const [tool, setTool] = useState("select");
  const [activeLayer, setActiveLayer] = useState("top");
  const [layerVis, setLayerVis] = useState({
    topSilk: true,
    topCopper: true,
    bottomCopper: true,
    bottomSilk: true,
    outline: true,
  });
  const [selectedId, setSelectedId] = useState(null);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(null); // { id, startMouseMM, startPoints }
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panDrag, setPanDrag] = useState(null); // { startX, startY, origX, origY }
  const [gridSize, setGridSize] = useState(2.54);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [boardColorKey, setBoardColorKey] = useState("green");
  const boardColor = BOARD_COLORS.find((c) => c.key === boardColorKey)!;
  const svgRef = useRef(null);
  const svgBackRef = useRef(null);
  const canvasWrapRef = useRef(null);

  const marginMM = 10;
  const gapMM = 1; // vertical margin between the two cards (in mm)
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

  const handleCanvasClick = (e) => {
    if (dragging) return;
    const raw = clientToMM(e.clientX, e.clientY);
    const pt = clampToBoard(snapPt(raw));

    if (tool === "select") {
      setSelectedId(null);
      return;
    }
    if (tool === "trace" || tool === "cutout") {
      setDrawingPoints((prev) => [...prev, pt]);
      return;
    }
    if (tool === "pad-tht") {
      addElement({ type: "pad", kind: "tht", layer: "both", x: pt.x, y: pt.y, size: 1.6, drill: 0.8 });
      return;
    }
    if (tool === "pad-smd") {
      addElement({ type: "pad", kind: "smd", layer: activeLayer, x: pt.x, y: pt.y, shape: "rect", w: 1.6, h: 1.2 });
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
      addElement({ type: "trace", layer: activeLayer, points: drawingPoints, width: 0.3 });
    } else if (tool === "cutout" && drawingPoints.length >= 3) {
      addElement({ type: "cutout", points: drawingPoints });
    }
    setDrawingPoints([]);
    setTool("select");
  };

  const cancelDrawing = () => {
    setDrawingPoints([]);
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

  const startDrag = (e, el) => {
    if (tool !== "select") return;
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedId(el.id);
    const pt = clientToMM(e.clientX, e.clientY);
    setDragging({ id: el.id, start: pt, orig: el });
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const pt = clientToMM(e.clientX, e.clientY);
    const dx = snapDelta(pt.x - dragging.start.x);
    const dy = snapDelta(pt.y - dragging.start.y);
    const orig = dragging.orig;
    if (orig.type === "trace" || orig.type === "cutout") {
      updateElement(dragging.id, {
        points: orig.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      });
    } else {
      updateElement(dragging.id, { x: snap(orig.x + dx, dotOffsetX), y: snap(orig.y + dy, dotOffsetY) });
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
    if (kind === "silk") return layer === "top" ? "#ececeb" : "#c9cacb";
    return layer === "top" ? "#e3a869" : "#c68a3d";
  };

  return (
    <div
      className="w-full flex flex-col text-[13px]"
      style={{ background: "#18191b", color: "#ececeb", fontFamily: "Arial, sans-serif", height: "100vh" }}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{ borderColor: "#2c2f33", background: "#1c1e21" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: "#9ba3a8", boxShadow: "0 0 8px #9ba3a8" }}
          />
          <span className="font-mono tracking-widest text-[11px]" style={{ color: "#a8abae" }}>
            ETCH
          </span>
          <span className="text-[12px]" style={{ color: "#6b6e71" }}>
            / business-card.pcb
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 font-mono text-[11px]" style={{ color: "#a8abae" }}>
            <button
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              className="p-1 rounded hover:bg-white/5"
            >
              <ZoomOut size={14} />
            </button>
            <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
              className="p-1 rounded hover:bg-white/5"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="ml-1 px-2 py-1 rounded hover:bg-white/5 text-[10px] tracking-wide"
            >
              RESET
            </button>
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[11px] tracking-wide"
            style={{ background: "#d79a52", color: "#14201a" }}
          >
            <Download size={13} strokeWidth={2.5} />
            EXPORT GERBER
          </button>
        </div>
      </div>

      {/* Layer chips */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b overflow-x-auto shrink-0"
        style={{ borderColor: "#2c2f33", background: "#1a1c1f" }}
      >
        <span className="font-mono text-[10px] tracking-widest mr-1" style={{ color: "#6b6e71" }}>
          LAYERS
        </span>
        {LAYERS.map((l) => {
          const on = layerVis[l.key];
          return (
            <button
              key={l.key}
              onClick={() => setLayerVis((v) => ({ ...v, [l.key]: !v[l.key] }))}
              className="flex items-center gap-1.5 px-2 py-1 rounded border font-mono text-[10px] tracking-wide transition"
              style={{
                borderColor: on ? l.swatch : "#34373b",
                color: on ? "#ececeb" : "#6b6e71",
                background: on ? "rgba(255,255,255,0.03)" : "transparent",
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: on ? l.swatch : "#34373b", boxShadow: on ? `0 0 5px ${l.swatch}` : "none" }}
              />
              {l.label}
            </button>
          );
        })}
        <div className="flex items-center gap-2 ml-4">
          <span className="font-mono text-[10px] tracking-widest" style={{ color: "#6b6e71" }}>PCB</span>
          {BOARD_COLORS.map((c) => (
            <button
              key={c.key}
              title={c.label}
              onClick={() => setBoardColorKey(c.key)}
              className="w-5 h-5 rounded-sm border transition"
              style={{
                background: c.fill,
                borderColor: boardColorKey === c.key ? "#ececeb" : "#34373b",
                boxShadow: boardColorKey === c.key ? `0 0 0 1px #ececeb` : "none",
              }}
            />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 font-mono text-[10px]" style={{ color: "#6b6e71" }}>
          <span>GRID</span>
          <button
            onClick={() => setSnapEnabled((s) => !s)}
            className="px-2 py-1 rounded"
            style={{
              background: snapEnabled ? "#2c2f33" : "transparent",
              color: snapEnabled ? "#e3a869" : "#6b6e71",
              border: "1px solid #34373b",
            }}
          >
            {snapEnabled ? "SNAP ON" : "SNAP OFF"}
          </button>
          {[2.54, 1.27].map((g) => (
            <button
              key={g}
              onClick={() => {
                setGridSize(g);
                setSnapEnabled(true);
              }}
              className="px-2 py-1 rounded"
              style={{
                background: snapEnabled && gridSize === g ? "#d79a52" : "transparent",
                color: snapEnabled && gridSize === g ? "#14201a" : "#6b6e71",
                border: "1px solid #34373b",
              }}
            >
              {g}mm
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Tool rail */}
        <div
          className="w-14 flex flex-col items-center gap-1 py-3 px-2 border-r shrink-0"
          style={{ borderColor: "#2c2f33", background: "#1c1e21" }}
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
                  background: active ? "#d79a52" : "transparent",
                  color: active ? "#14201a" : "#a8abae",
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
                  className="w-9 h-6 flex items-center justify-center rounded font-mono text-[9px] tracking-wide transition"
                  style={{
                    background: activeLayer === l ? "#d79a52" : "#2c2f33",
                    color: activeLayer === l ? "#14201a" : "#6b6e71",
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
          style={{ background: "#18191b", cursor: panDrag ? "grabbing" : undefined }}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerLeave={endPan}
        >
          {drawingPoints.length > 0 && (
            <div
              className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded font-mono text-[11px] z-10"
              style={{ background: "#1c1e21", border: "1px solid #34373b", color: "#a8abae" }}
            >
              {tool === "trace" ? "Drawing trace" : "Drawing cutout"} · {drawingPoints.length} pt(s)
              <button onClick={finishDrawing} className="p-1 rounded" style={{ color: "#9ba3a8" }}>
                <Check size={13} />
              </button>
              <button onClick={cancelDrawing} className="p-1 rounded" style={{ color: "#e8543f" }}>
                <XIcon size={13} />
              </button>
            </div>
          )}

          {/* ── FRONT (top) ── */}
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${viewW} ${frontViewH}`}
              width={viewW * MM_TO_PX * zoom}
              height={frontViewH * MM_TO_PX * zoom}
              onClick={handleCanvasClick}
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
                  <circle cx={0} cy={0} r={0.24} fill={boardColor.dot} />
                </pattern>
                <clipPath id="boardClip">
                  <rect x={0} y={0} width={board.width} height={board.height} rx={board.corner} ry={board.corner} />
                </clipPath>
              </defs>
              <g transform={`translate(${marginMM}, ${marginMM})`}>
                {/* board substrate */}
                {layerVis.outline && (
                  <rect x={0} y={0} width={board.width} height={board.height} rx={board.corner} ry={board.corner}
                    fill={boardColor.fill} stroke="url(#copperEdge)" strokeWidth={0.4} />
                )}
                {/* dot grid clipped to board shape */}
                <rect x={0} y={0} width={board.width} height={board.height} rx={board.corner} ry={board.corner}
                  fill="url(#dotGrid)" clipPath="url(#boardClip)" />

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
                {drawingPoints.length > 0 && (
                  <>
                    <path d={cuPath(drawingPoints, false)} fill="none" stroke="#e3a869"
                      strokeWidth={tool === "trace" ? 0.3 : 0.15}
                      strokeDasharray={tool === "cutout" ? "0.6 0.4" : undefined} />
                    {drawingPoints.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={0.4} fill="#9ba3a8" />
                    ))}
                  </>
                )}
              </g>
            </svg>
          </div>

          {/* ── BACK (bottom) — mirrored horizontally ── */}
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
            <svg
              ref={svgBackRef}
              viewBox={`0 0 ${viewW} ${backViewH}`}
              width={viewW * MM_TO_PX * zoom}
              height={backViewH * MM_TO_PX * zoom}
              style={{ display: "block", cursor: tool === "select" ? "default" : "crosshair" }}
              onClick={(e) => {
                if (dragging) return;
                const raw = clientToMMBack(e.clientX, e.clientY);
                const pt = clampToBoard(snapPt(raw));
                if (tool === "pad-tht") {
                  addElement({ type: "pad", kind: "tht", layer: "both", x: pt.x, y: pt.y, size: 1.6, drill: 0.8 });
                } else if (tool === "pad-smd") {
                  addElement({ type: "pad", kind: "smd", layer: "bottom", x: pt.x, y: pt.y, shape: "rect", w: 1.6, h: 1.2 });
                } else if (tool === "hole") {
                  addElement({ type: "hole", x: pt.x, y: pt.y, diameter: 3, plated: false });
                } else if (tool === "text") {
                  addElement({ type: "text", layer: "bottom", x: pt.x, y: pt.y, content: "TEXT", font: "sans", size: 4 });
                } else if (tool === "select") {
                  setSelectedId(null);
                }
              }}
              onPointerMove={(e) => {
                if (!dragging) return;
                const pt = clientToMMBack(e.clientX, e.clientY);
                const dx = snapDelta(pt.x - dragging.start.x);
                const dy = snapDelta(pt.y - dragging.start.y);
                const orig = dragging.orig;
                if (orig.type === "trace" || orig.type === "cutout") {
                  updateElement(dragging.id, { points: orig.points.map((p: {x:number,y:number}) => ({ x: p.x + dx, y: p.y + dy })) });
                } else {
                  updateElement(dragging.id, { x: snap(orig.x + dx, dotOffsetX), y: snap(orig.y + dy, dotOffsetY) });
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
                  <circle cx={0} cy={0} r={0.24} fill={boardColor.dot} />
                </pattern>
                <clipPath id="boardClipBack">
                  <rect x={0} y={0} width={board.width} height={board.height} rx={board.corner} ry={board.corner} />
                </clipPath>
              </defs>
              {/* mirror horizontally around card center so back is physically correct */}
              <g transform={`translate(${marginMM}, ${gapMM}) scale(-1,1) translate(${-board.width}, 0)`}>
                {/* board substrate */}
                {layerVis.outline && (
                  <rect x={0} y={0} width={board.width} height={board.height} rx={board.corner} ry={board.corner}
                    fill={boardColor.fill} stroke="url(#copperEdgeBack)" strokeWidth={0.4} />
                )}
                {/* dot grid clipped to board shape */}
                <rect x={0} y={0} width={board.width} height={board.height} rx={board.corner} ry={board.corner}
                  fill="url(#dotGridBack)" clipPath="url(#boardClipBack)" />

                {/* bottom copper */}
                {layerVis.bottomCopper &&
                  elements
                    .filter((e) => e.layer === "bottom" || e.layer === "both")
                    .filter((e) => e.type === "trace" || e.type === "pad")
                    .map((e) => renderElement(e, "copper"))}

                {/* bottom silk */}
                {layerVis.bottomSilk &&
                  elements
                    .filter((e) => e.layer === "bottom")
                    .filter((e) => e.type === "text" || e.type === "image")
                    .map((e) => renderElement(e, "silk"))}

                {/* holes + cutouts */}
                {elements.filter((e) => e.type === "hole" || e.type === "cutout").map((e) => renderElement(e, "board"))}
              </g>
            </svg>
          </div>
        </div>

        {/* Properties panel */}
        <div
          className="w-64 border-l flex flex-col"
          style={{ borderColor: "#2c2f33", background: "#1c1e21" }}
        >
          <div
            className="px-3 py-2 border-b font-mono text-[10px] tracking-widest"
            style={{ borderColor: "#2c2f33", color: "#6b6e71" }}
          >
            {selected ? selected.type.toUpperCase() + " — SPEC" : "BOARD — SPEC"}
          </div>
          <div className="p-3 flex flex-col gap-3 overflow-y-auto">
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
                className="mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded font-mono text-[11px]"
                style={{ background: "rgba(232,84,63,0.12)", color: "#e8543f", border: "1px solid #4a2a25" }}
              >
                <Trash2 size={13} /> DELETE ELEMENT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ---- element renderer (closure over state) ----

  function renderElement(el, pass) {
    const isSelected = el.id === selectedId;
    const strokeSel = isSelected ? { stroke: "#9ba3a8", strokeWidth: 0.15, strokeDasharray: "0.4 0.3" } : {};
    const onRMB = (e) => deleteElement(e, el.id);

    if (el.type === "trace") {
      return (
        <g key={el.id} onPointerDown={(e) => startDrag(e, el)} onContextMenu={onRMB} style={{ cursor: "move" }}>
          <path
            d={cuPath(el.points, false)}
            fill="none"
            stroke={layerColor(el.layer, "copper")}
            strokeWidth={el.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {isSelected && (
            <path d={cuPath(el.points, false)} fill="none" stroke="#9ba3a8" strokeWidth={el.width + 0.3}
              strokeOpacity={0.35} strokeLinecap="round" />
          )}
        </g>
      );
    }
    if (el.type === "pad") {
      const fill = layerColor(el.layer === "both" ? "top" : el.layer, "copper");
      return (
        <g key={el.id} onPointerDown={(e) => startDrag(e, el)} onContextMenu={onRMB} style={{ cursor: "move" }}>
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
          onPointerDown={(e) => startDrag(e, el)}
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
          onPointerDown={(e) => startDrag(e, el)}
          onContextMenu={onRMB}
          style={{ cursor: "move" }}
          opacity={0.92}
        />
      );
    }
    if (el.type === "hole") {
      return (
        <g key={el.id} onPointerDown={(e) => startDrag(e, el)} onContextMenu={onRMB} style={{ cursor: "move" }}>
          <circle cx={el.x} cy={el.y} r={el.diameter / 2} fill="#18191b" stroke={el.plated ? "#e3a869" : "#6b6e71"}
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
          onPointerDown={(e) => startDrag(e, el)}
          onContextMenu={onRMB}
          style={{ cursor: "move" }}
        />
      );
    }
    return null;
  }
}

// ---- small property widgets ---------------------------------------------

function Label({ children }) {
  return (
    <span className="font-mono text-[10px] tracking-widest block mb-1" style={{ color: "#6b6e71" }}>
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
        className="w-full px-2 py-1.5 rounded font-mono text-[12px] outline-none"
        style={{ background: "#18191b", border: "1px solid #34373b", color: "#ececeb" }}
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
      <div className="pt-2 mt-1 border-t" style={{ borderColor: "#2c2f33" }}>
        <Label>Preset</Label>
        <button
          onClick={() => setBoard({ width: 85, height: 54, corner: 3 })}
          className="w-full px-2 py-1.5 rounded font-mono text-[11px]"
          style={{ background: "#2c2f33", color: "#e3a869" }}
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
          className="w-full px-2 py-1.5 rounded text-[12px] outline-none"
          style={{ background: "#18191b", border: "1px solid #34373b", color: "#ececeb" }}
        />
      </div>
      <div>
        <Label>Font</Label>
        <div className="grid grid-cols-2 gap-1">
          {FONTS.map((f) => (
            <button
              key={f.key}
              onClick={() => onChange({ font: f.key })}
              className="px-2 py-1.5 rounded text-[11px]"
              style={{
                fontFamily: f.css,
                background: el.font === f.key ? "#d79a52" : "#18191b",
                color: el.font === f.key ? "#14201a" : "#a8abae",
                border: "1px solid #34373b",
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
              className="px-2 py-1.5 rounded font-mono text-[11px]"
              style={{
                background: el.plated === v ? "#d79a52" : "#18191b",
                color: el.plated === v ? "#14201a" : "#a8abae",
                border: "1px solid #34373b",
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
