// npx tsx src/generate-test-files.ts
// Generates test_design.pcb.json and test_design_gerbers.zip in the project root

import { writeFileSync } from "fs";
import JSZip from "jszip";
import { exportGerber } from "./gerberExport.js";

const project = {
  version: 1,
  board: { width: 85, height: 54, corner: 3 },
  boardColorKey: "green",
  elements: [
    // Two THT pads on opposite sides
    { id: "p1", type: "pad", kind: "tht", layer: "both", x: 10, y: 10, size: 2.5, drill: 1.0 },
    { id: "p2", type: "pad", kind: "tht", layer: "both", x: 75, y: 10, size: 2.5, drill: 1.0 },

    // SMD pad in the middle
    { id: "p3", type: "pad", kind: "smd", layer: "top", x: 42, y: 27, w: 3.0, h: 2.0 },

    // Trace on top layer connecting pad1 → pad2
    {
      id: "t1", type: "trace", layer: "top",
      points: [{ x: 10, y: 10 }, { x: 42, y: 10 }, { x: 75, y: 10 }],
      width: 0.5,
    },

    // Trace on bottom layer
    {
      id: "t2", type: "trace", layer: "bottom",
      points: [{ x: 10, y: 44 }, { x: 75, y: 44 }],
      width: 0.3,
    },

    // Silkscreen text
    { id: "tx1", type: "text", layer: "top", x: 5, y: 40, content: "ETCH TEST", size: 3, font: "sans" },

    // Non-plated hole
    { id: "h1", type: "hole", x: 42, y: 5, diameter: 2.0, plated: false },
  ],
};

// 1. Write JSON
writeFileSync("test_design.pcb.json", JSON.stringify(project, null, 2));
console.log("Written: test_design.pcb.json");

// 2. Generate Gerber zip
const blob = await exportGerber(project as any, "test_design");
const ab = await blob.arrayBuffer();
const buf = Buffer.from(ab);
writeFileSync("test_design_gerbers.zip", buf);
console.log(`Written: test_design_gerbers.zip (${buf.length} bytes)`);

// 3. List zip contents
const zip = await JSZip.loadAsync(ab);
const files = Object.keys(zip.files).filter(n => !zip.files[n].dir);
console.log("\nGerber files inside zip:");
for (const name of files) {
  const text = await zip.files[name].async("string");
  console.log(`  ${name} (${text.length} chars)`);
}
