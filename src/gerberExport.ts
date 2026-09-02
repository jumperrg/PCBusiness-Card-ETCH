// Gerber RS-274X + Excellon drill export
// Generates a standard 8-layer fabrication package from PCBProject data.

import JSZip from "jszip";
import type { PCBProject } from "./pcb-card-editor";

// Gerber uses fixed-point: format %FSLAX46Y46*% means 4 integer + 6 decimal digits.
// 1.000000 mm → "1000000" (multiply by 10^6). This matches KiCad's standard output.
const G_PRECISION = 1_000_000;
const fmt = (mm: number) => Math.round(mm * G_PRECISION).toString();

// ---- Gerber file header / footer ----------------------------------------

function header(name: string): string {
  return [
    `%FSLAX46Y46*%`,
    `%MOMM*%`,
    `%LN${name}*%`,
    `%ADD10C,0.100000*%`, // default aperture: 0.1mm circle (for draws)
  ].join("\n");
}

const FOOTER = "M02*";

// ---- Aperture registry --------------------------------------------------

class ApertureSet {
  private map = new Map<string, number>();
  private next = 10;
  private defs: string[] = [];

  /** Returns aperture number for a circle of given diameter. */
  circle(d: number): number {
    const key = `C,${d.toFixed(6)}`;
    if (!this.map.has(key)) {
      const n = this.next++;
      this.map.set(key, n);
      this.defs.push(`%ADD${n}C,${d.toFixed(6)}*%`);
    }
    return this.map.get(key)!;
  }

  /** Returns aperture number for a rectangle w×h. */
  rect(w: number, h: number): number {
    const key = `R,${w.toFixed(6)}X${h.toFixed(6)}`;
    if (!this.map.has(key)) {
      const n = this.next++;
      this.map.set(key, n);
      this.defs.push(`%ADD${n}R,${w.toFixed(6)}X${h.toFixed(6)}*%`);
    }
    return this.map.get(key)!;
  }

  /** Returns aperture number for an oblong (capsule) w×h. */
  oblong(w: number, h: number): number {
    const key = `O,${w.toFixed(6)}X${h.toFixed(6)}`;
    if (!this.map.has(key)) {
      const n = this.next++;
      this.map.set(key, n);
      this.defs.push(`%ADD${n}O,${w.toFixed(6)}X${h.toFixed(6)}*%`);
    }
    return this.map.get(key)!;
  }

  definitions(): string[] { return this.defs; }
}

// ---- Low-level draw helpers --------------------------------------------

function selectAperture(n: number): string { return `D${n}*`; }
function moveTo(x: number, y: number): string { return `X${fmt(x)}Y${fmt(y)}D02*`; }
function lineTo(x: number, y: number): string { return `X${fmt(x)}Y${fmt(y)}D01*`; }
function flash(x: number, y: number): string { return `X${fmt(x)}Y${fmt(y)}D03*`; }

// ---- Drawing primitives ------------------------------------------------

/** Stroke a polyline with a given width circle aperture. */
function drawPolyline(apt: ApertureSet, pts: { x: number; y: number }[], width: number): string[] {
  if (pts.length < 2) return [];
  const n = apt.circle(width);
  const lines: string[] = [];
  lines.push(`G01*`); // linear interpolation
  lines.push(selectAperture(n));
  lines.push(moveTo(pts[0].x, pts[0].y));
  for (let i = 1; i < pts.length; i++) lines.push(lineTo(pts[i].x, pts[i].y));
  return lines;
}

/** Flash a circular pad. */
function flashCircle(apt: ApertureSet, x: number, y: number, d: number): string[] {
  const n = apt.circle(d);
  return [selectAperture(n), flash(x, y)];
}

/** Flash a rectangular pad. */
function flashRect(apt: ApertureSet, x: number, y: number, w: number, h: number): string[] {
  const n = apt.rect(w, h);
  return [selectAperture(n), flash(x, y)];
}

/** Draw a rounded rectangle outline via region fill (approximated as rect). */
function fillRect(x: number, y: number, w: number, h: number): string[] {
  const x0 = x, y0 = y, x1 = x + w, y1 = y + h;
  return [
    "G36*",
    `G01*`,
    moveTo(x0, y0),
    lineTo(x1, y0),
    lineTo(x1, y1),
    lineTo(x0, y1),
    lineTo(x0, y0),
    "G37*",
  ];
}

/** Draw board outline as a thin stroke rectangle with rounded corners approximated as line segments. */
function drawBoardOutline(apt: ApertureSet, board: { width: number; height: number; corner: number }): string[] {
  const { width, height, corner: r } = board;
  const w = apt.circle(0.1); // 0.1mm line
  const lines: string[] = [];
  lines.push("G01*", selectAperture(w));

  // Approximate rounded corners with 4 arc segments (8 points per corner)
  const segments = 8;
  const corners = [
    { cx: r, cy: r, startAngle: Math.PI, endAngle: 1.5 * Math.PI },
    { cx: width - r, cy: r, startAngle: 1.5 * Math.PI, endAngle: 2 * Math.PI },
    { cx: width - r, cy: height - r, startAngle: 0, endAngle: 0.5 * Math.PI },
    { cx: r, cy: height - r, startAngle: 0.5 * Math.PI, endAngle: Math.PI },
  ];

  const allPts: { x: number; y: number }[] = [];
  for (const { cx, cy, startAngle, endAngle } of corners) {
    for (let i = 0; i <= segments; i++) {
      const a = startAngle + (endAngle - startAngle) * (i / segments);
      allPts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  }
  // close
  allPts.push(allPts[0]);

  lines.push(moveTo(allPts[0].x, allPts[0].y));
  for (let i = 1; i < allPts.length; i++) lines.push(lineTo(allPts[i].x, allPts[i].y));
  return lines;
}

// ---- SVG text to Gerber stroke approximation ---------------------------
// We approximate each character as a small rectangle flash (simple approach:
// render text as a horizontal bar silhouette). For real text we'd need a stroke font.
// Instead, we generate a G36 region outline of the text bounding box with the
// actual character strokes represented as line draws.

/** Very simple stroke font: each char is drawn as a set of line segments.
 *  We use a compact subset (capital letters + digits + common punctuation).
 *  Each glyph is defined on a 0..1 × 0..1 grid, lines as [x0,y0,x1,y1,...] pairs.
 */
const STROKE_FONT: Record<string, number[][]> = {
  " ": [],
  "A": [[0,0,0.5,1],[0.5,1,1,0],[0.25,0.5,0.75,0.5]],
  "B": [[0,0,0,1],[0,0,0.85,0.15],[0.85,0.15,0.85,0.45],[0.85,0.45,0,0.5],[0,0.5,0.9,0.65],[0.9,0.65,0.9,0.85],[0.9,0.85,0,1]],
  "C": [[1,0.15,0.85,0],[0.85,0,0.15,0],[0.15,0,0,0.15],[0,0.15,0,0.85],[0,0.85,0.15,1],[0.15,1,0.85,1],[0.85,1,1,0.85]],
  "D": [[0,0,0,1],[0,0,0.7,0],[0.7,0,1,0.2],[1,0.2,1,0.8],[1,0.8,0.7,1],[0.7,1,0,1]],
  "E": [[0,0,0,1],[0,0,1,0],[0,0.5,0.8,0.5],[0,1,1,1]],
  "F": [[0,0,0,1],[0,0,1,0],[0,0.5,0.8,0.5]],
  "G": [[1,0.15,0.85,0],[0.85,0,0.15,0],[0.15,0,0,0.15],[0,0.15,0,0.85],[0,0.85,0.15,1],[0.15,1,0.85,1],[0.85,1,1,0.85],[1,0.85,1,0.5],[1,0.5,0.5,0.5]],
  "H": [[0,0,0,1],[1,0,1,1],[0,0.5,1,0.5]],
  "I": [[0.1,0,0.9,0],[0.5,0,0.5,1],[0.1,1,0.9,1]],
  "J": [[0.7,0,0.7,0.85],[0.7,0.85,0.5,1],[0.5,1,0.2,1],[0.2,1,0,0.85],[0,1,1,1],[0,0,1,0]],
  "K": [[0,0,0,1],[0,0.5,1,0],[0,0.5,1,1]],
  "L": [[0,0,0,1],[0,1,1,1]],
  "M": [[0,1,0,0],[0,0,0.5,0.5],[0.5,0.5,1,0],[1,0,1,1]],
  "N": [[0,1,0,0],[0,0,1,1],[1,1,1,0]],
  "O": [[0.15,0,0.85,0],[0.85,0,1,0.15],[1,0.15,1,0.85],[1,0.85,0.85,1],[0.85,1,0.15,1],[0.15,1,0,0.85],[0,0.85,0,0.15],[0,0.15,0.15,0]],
  "P": [[0,1,0,0],[0,0,0.85,0],[0.85,0,1,0.15],[1,0.15,1,0.45],[1,0.45,0.85,0.55],[0.85,0.55,0,0.55]],
  "Q": [[0.15,0,0.85,0],[0.85,0,1,0.15],[1,0.15,1,0.85],[1,0.85,0.85,1],[0.85,1,0.15,1],[0.15,1,0,0.85],[0,0.85,0,0.15],[0,0.15,0.15,0],[0.6,0.6,1,1]],
  "R": [[0,1,0,0],[0,0,0.85,0],[0.85,0,1,0.15],[1,0.15,1,0.45],[1,0.45,0.85,0.55],[0.85,0.55,0,0.55],[0,0.55,1,1]],
  "S": [[1,0.1,0.85,0],[0.85,0,0.15,0],[0.15,0,0,0.1],[0,0.1,0,0.45],[0,0.45,0.15,0.5],[0.15,0.5,0.85,0.5],[0.85,0.5,1,0.55],[1,0.55,1,0.9],[1,0.9,0.85,1],[0.85,1,0.15,1],[0.15,1,0,0.9]],
  "T": [[0,0,1,0],[0.5,0,0.5,1]],
  "U": [[0,0,0,0.85],[0,0.85,0.15,1],[0.15,1,0.85,1],[0.85,1,1,0.85],[1,0.85,1,0]],
  "V": [[0,0,0.5,1],[0.5,1,1,0]],
  "W": [[0,0,0.25,1],[0.25,1,0.5,0.5],[0.5,0.5,0.75,1],[0.75,1,1,0]],
  "X": [[0,0,1,1],[1,0,0,1]],
  "Y": [[0,0,0.5,0.5],[1,0,0.5,0.5],[0.5,0.5,0.5,1]],
  "Z": [[0,0,1,0],[1,0,0,1],[0,1,1,1]],
  "0": [[0.15,0,0.85,0],[0.85,0,1,0.15],[1,0.15,1,0.85],[1,0.85,0.85,1],[0.85,1,0.15,1],[0.15,1,0,0.85],[0,0.85,0,0.15],[0,0.15,0.15,0],[0.15,0.15,0.85,0.85]],
  "1": [[0.3,0.2,0.5,0],[0.5,0,0.5,1],[0.2,1,0.8,1]],
  "2": [[0,0.15,0.15,0],[0.15,0,0.85,0],[0.85,0,1,0.15],[1,0.15,1,0.45],[1,0.45,0,1],[0,1,1,1]],
  "3": [[0,0.1,0.15,0],[0.15,0,0.85,0],[0.85,0,1,0.15],[1,0.15,1,0.45],[1,0.45,0.15,0.5],[0.15,0.5,1,0.55],[1,0.55,1,0.85],[1,0.85,0.85,1],[0.85,1,0.15,1],[0.15,1,0,0.9]],
  "4": [[0.75,0,0.75,1],[0,0,0,0.6],[0,0.6,1,0.6]],
  "5": [[1,0,0,0],[0,0,0,0.5],[0,0.5,0.85,0.5],[0.85,0.5,1,0.6],[1,0.6,1,0.9],[1,0.9,0.85,1],[0.85,1,0.15,1],[0.15,1,0,0.9]],
  "6": [[1,0.1,0.85,0],[0.85,0,0.15,0],[0.15,0,0,0.1],[0,0.1,0,0.9],[0,0.9,0.15,1],[0.15,1,0.85,1],[0.85,1,1,0.9],[1,0.9,1,0.6],[1,0.6,0.85,0.5],[0.85,0.5,0,0.5]],
  "7": [[0,0,1,0],[1,0,0.3,1]],
  "8": [[0.15,0.5,0,0.4],[0,0.4,0,0.1],[0,0.1,0.15,0],[0.15,0,0.85,0],[0.85,0,1,0.1],[1,0.1,1,0.4],[1,0.4,0.85,0.5],[0.85,0.5,0.15,0.5],[0.15,0.5,0,0.6],[0,0.6,0,0.9],[0,0.9,0.15,1],[0.15,1,0.85,1],[0.85,1,1,0.9],[1,0.9,1,0.6],[1,0.6,0.85,0.5]],
  "9": [[1,0.9,0.85,1],[0.85,1,0.15,1],[0.15,1,0,0.9],[0,0.9,0,0.6],[0,0.6,0.15,0.5],[0.15,0.5,1,0.5],[1,0.5,1,0.1],[1,0.1,0.85,0],[0.85,0,0.15,0],[0.15,0,0,0.1]],
  ".": [[0.35,1,0.65,1],[0.65,1,0.65,0.8],[0.65,0.8,0.35,0.8],[0.35,0.8,0.35,1]],
  "-": [[0.1,0.5,0.9,0.5]],
  "_": [[0,1,1,1]],
  ":": [[0.35,0.25,0.65,0.25],[0.65,0.25,0.65,0.05],[0.65,0.05,0.35,0.05],[0.35,0.05,0.35,0.25],[0.35,0.75,0.65,0.75],[0.65,0.75,0.65,0.55],[0.65,0.55,0.35,0.55],[0.35,0.55,0.35,0.75]],
  "/": [[1,0,0,1]],
  "!": [[0.5,0,0.5,0.65],[0.35,0.85,0.65,0.85],[0.65,0.85,0.65,1],[0.65,1,0.35,1],[0.35,1,0.35,0.85]],
  "@": [[0.7,0.35,0.6,0.25],[0.6,0.25,0.4,0.25],[0.4,0.25,0.3,0.35],[0.3,0.35,0.3,0.65],[0.3,0.65,0.4,0.75],[0.4,0.75,0.6,0.75],[0.6,0.75,0.7,0.65],[0.7,0.65,0.7,0.35],[0.7,0.35,1,0.35],[1,0.35,1,0.1],[1,0.1,0.85,0],[0.85,0,0.15,0],[0.15,0,0,0.15],[0,0.15,0,0.85],[0,0.85,0.15,1],[0.15,1,0.85,1],[0.85,1,1,0.85]],
  "#": [[0.2,0,0.2,1],[0.8,0,0.8,1],[0,0.35,1,0.35],[0,0.65,1,0.65]],
  "+": [[0.5,0.1,0.5,0.9],[0.1,0.5,0.9,0.5]],
  "=": [[0.1,0.35,0.9,0.35],[0.1,0.65,0.9,0.65]],
  "<": [[1,0,0,0.5],[0,0.5,1,1]],
  ">": [[0,0,1,0.5],[1,0.5,0,1]],
  "(": [[0.7,0,0.3,0.2],[0.3,0.2,0.3,0.8],[0.3,0.8,0.7,1]],
  ")": [[0.3,0,0.7,0.2],[0.7,0.2,0.7,0.8],[0.7,0.8,0.3,1]],
  "[": [[0.7,0,0.3,0],[0.3,0,0.3,1],[0.3,1,0.7,1]],
  "]": [[0.3,0,0.7,0],[0.7,0,0.7,1],[0.7,1,0.3,1]],
  ",": [[0.35,0.8,0.65,0.8],[0.65,0.8,0.65,1],[0.65,1,0.45,1.2]],
  "'": [[0.4,0,0.6,0],[0.6,0,0.5,0.35]],
  '"': [[0.25,0,0.35,0],[0.35,0,0.3,0.3],[0.65,0,0.75,0],[0.75,0,0.7,0.3]],
  "?": [[0,0.1,0.15,0],[0.15,0,0.85,0],[0.85,0,1,0.1],[1,0.1,1,0.35],[1,0.35,0.5,0.55],[0.5,0.55,0.5,0.7],[0.35,0.85,0.65,0.85],[0.65,0.85,0.65,1],[0.65,1,0.35,1],[0.35,1,0.35,0.85]],
  "%": [[0,0,1,1],[0.15,0,0.3,0],[0.3,0,0.3,0.25],[0.3,0.25,0.15,0.25],[0.15,0.25,0.15,0],[0.7,0.75,0.85,0.75],[0.85,0.75,0.85,1],[0.85,1,0.7,1],[0.7,1,0.7,0.75]],
};

function drawTextGerber(apt: ApertureSet, text: string, x: number, y: number, sizeMM: number, mirror = false): string[] {
  const lines: string[] = [];
  const charW = sizeMM * 0.65;
  const charH = sizeMM;
  const strokeW = sizeMM * 0.12;
  const spacing = sizeMM * 0.75;
  const strokeApt = apt.circle(strokeW);

  let cx = x;
  const chars = text.toUpperCase().split("");

  for (const ch of chars) {
    const segs = STROKE_FONT[ch] ?? STROKE_FONT["?"];
    for (const [x0, y0, x1, y1] of segs) {
      // map 0..1 glyph space to mm position; mirror if on back layer
      const px0 = mirror ? cx + charW * (1 - x0) : cx + charW * x0;
      const py0 = y + charH * y0;
      const px1 = mirror ? cx + charW * (1 - x1) : cx + charW * x1;
      const py1 = y + charH * y1;
      lines.push("G01*", selectAperture(strokeApt), moveTo(px0, py0), lineTo(px1, py1));
    }
    cx += mirror ? -spacing : spacing;
  }
  return lines;
}

// ---- Layer builder ------------------------------------------------------

interface LayerOutput {
  body: string[];
  apt: ApertureSet;
}

function makeLayer(): LayerOutput {
  return { body: [], apt: new ApertureSet() };
}

function assembleLayer(name: string, layer: LayerOutput): string {
  const defs = layer.apt.definitions();
  const parts = [
    `%FSLAX46Y46*%`,
    `%MOMM*%`,
    `%LN${name}*%`,
    ...defs,
    ...layer.body,
    FOOTER,
  ];
  return parts.join("\n");
}

// ---- Excellon drill file ------------------------------------------------

function buildDrillFile(elements: any[]): string {
  const lines: string[] = [];
  lines.push("M48"); // header
  lines.push("METRIC,LZ"); // metric, leading zeros suppressed
  lines.push(";Layer: drill");

  // collect unique drill sizes
  const sizes = new Map<number, { x: number; y: number }[]>();
  for (const el of elements) {
    if (el.type === "pad" && el.kind === "tht") {
      const d = el.drill ?? el.size * 0.6;
      if (!sizes.has(d)) sizes.set(d, []);
      sizes.get(d)!.push({ x: el.x, y: el.y });
    }
    if (el.type === "hole") {
      const d = el.diameter;
      if (!sizes.has(d)) sizes.set(d, []);
      sizes.get(d)!.push({ x: el.x, y: el.y });
    }
  }

  let toolNum = 1;
  const tools: Array<{ num: number; d: number; holes: { x: number; y: number }[] }> = [];
  for (const [d, holes] of sizes.entries()) {
    lines.push(`T${String(toolNum).padStart(2, "0")}C${d.toFixed(3)}`);
    tools.push({ num: toolNum, d, holes });
    toolNum++;
  }
  lines.push("%"); // end of header

  // G90 = absolute, G05 = drill mode
  lines.push("G90");
  lines.push("G05");

  for (const tool of tools) {
    lines.push(`T${String(tool.num).padStart(2, "0")}`);
    for (const h of tool.holes) {
      // Excellon: X and Y in 0.001mm, no decimal point
      const xi = Math.round(h.x * 1000);
      const yi = Math.round(h.y * 1000);
      lines.push(`X${xi}Y${yi}`);
    }
  }
  lines.push("T00"); // deselect tool
  lines.push("M30"); // end of file
  return lines.join("\n");
}

// ---- Main export --------------------------------------------------------

/** Builds all Gerber + drill layers from a PCBProject and returns them as a zip Blob. */
export async function exportGerber(project: PCBProject, filename = "pcb"): Promise<Blob> {
  const { board, elements } = project;

  // Initialize 6 copper/silk layers + outline
  const topCu = makeLayer();
  const botCu = makeLayer();
  const topSilk = makeLayer();
  const botSilk = makeLayer();
  const topMask = makeLayer(); // solder mask (opening = where solder goes)
  const botMask = makeLayer();
  const outline = makeLayer();

  // Board outline on all layers
  const outlineBody = drawBoardOutline(outline.apt, board);
  outline.body.push(...outlineBody);
  // Also put outline on copper layers (standard practice)
  const topCuOutline = drawBoardOutline(topCu.apt, board);
  topCu.body.push(...topCuOutline);
  const botCuOutline = drawBoardOutline(botCu.apt, board);
  botCu.body.push(...botCuOutline);

  for (const el of elements) {
    if (el.type === "trace") {
      const pts: { x: number; y: number }[] = el.points;
      if (pts.length < 2) continue;
      const w: number = el.width ?? 0.3;

      if (el.layer === "top" || el.layer === "both") {
        topCu.body.push(...drawPolyline(topCu.apt, pts, w));
      }
      if (el.layer === "bottom" || el.layer === "both") {
        // mirror X for back layer
        const mirrored = pts.map((p: { x: number; y: number }) => ({ x: board.width - p.x, y: p.y }));
        botCu.body.push(...drawPolyline(botCu.apt, mirrored, w));
      }
    }

    if (el.type === "pad") {
      if (el.kind === "tht") {
        // THT pad: annular ring on both copper layers, mask opening on both
        const padD = el.size as number;
        const drillD = (el.drill ?? padD * 0.6) as number;
        const ringD = padD; // full pad diameter
        const mx = board.width - el.x;

        // Top copper
        topCu.body.push(...flashCircle(topCu.apt, el.x, el.y, ringD));
        // Bottom copper (mirrored)
        botCu.body.push(...flashCircle(botCu.apt, mx, el.y, ringD));
        // Mask openings (slightly larger)
        topMask.body.push(...flashCircle(topMask.apt, el.x, el.y, ringD + 0.1));
        botMask.body.push(...flashCircle(botMask.apt, mx, el.y, ringD + 0.1));
        void drillD; // drill holes handled separately in drill file
      }

      if (el.kind === "smd") {
        const w = el.w as number;
        const h = el.h as number;
        if (el.layer === "top") {
          topCu.body.push(...flashRect(topCu.apt, el.x, el.y, w, h));
          topMask.body.push(...flashRect(topMask.apt, el.x, el.y, w + 0.1, h + 0.1));
        }
        if (el.layer === "bottom") {
          const mx = board.width - el.x;
          botCu.body.push(...flashRect(botCu.apt, mx, el.y, w, h));
          botMask.body.push(...flashRect(botMask.apt, mx, el.y, w + 0.1, h + 0.1));
        }
      }
    }

    if (el.type === "text") {
      const size = (el.size ?? 2) as number;
      const mirror = el.layer === "bottom";
      const tx = mirror ? board.width - el.x : el.x;

      if (el.layer === "top") {
        topSilk.body.push(...drawTextGerber(topSilk.apt, el.content, tx, el.y, size, false));
      } else {
        botSilk.body.push(...drawTextGerber(botSilk.apt, el.content, tx, el.y, size, true));
      }
    }

    if (el.type === "hole") {
      // NPTH: small circle on all copper layers to show keepout
      const d = el.diameter as number;
      topCu.body.push(...flashCircle(topCu.apt, el.x, el.y, d));
      const mx = board.width - el.x;
      botCu.body.push(...flashCircle(botCu.apt, mx, el.y, d));
    }

    if (el.type === "cutout") {
      // Board cutouts go on outline layer
      const pts: { x: number; y: number }[] = el.points;
      if (pts.length >= 2) {
        const w = outline.apt.circle(0.1);
        outline.body.push("G01*", selectAperture(w));
        outline.body.push(moveTo(pts[0].x, pts[0].y));
        for (let i = 1; i < pts.length; i++) outline.body.push(lineTo(pts[i].x, pts[i].y));
        outline.body.push(lineTo(pts[0].x, pts[0].y)); // close
      }
    }
  }

  // ---- Assemble zip -------------------------------------------------------
  const zip = new JSZip();
  const base = filename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");

  zip.file(`${base}-F_Cu.gtl`, assembleLayer("Top Copper", topCu));
  zip.file(`${base}-B_Cu.gbl`, assembleLayer("Bottom Copper", botCu));
  zip.file(`${base}-F_Mask.gts`, assembleLayer("Top Mask", topMask));
  zip.file(`${base}-B_Mask.gbs`, assembleLayer("Bottom Mask", botMask));
  zip.file(`${base}-F_SilkS.gto`, assembleLayer("Top Silkscreen", topSilk));
  zip.file(`${base}-B_SilkS.gbo`, assembleLayer("Bottom Silkscreen", botSilk));
  zip.file(`${base}-Edge_Cuts.gko`, assembleLayer("Board Outline", outline));
  zip.file(`${base}.drl`, buildDrillFile(elements));

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
