// npx tsx src/gerberExport.test.ts
import JSZip from "jszip";
import { exportGerber } from "./gerberExport.js";
import { parseGerber, guessColor } from "./GerberViewer.js";

// ---- Test project --------------------------------------------------------

const testProject = {
  version: 1,
  board: { width: 85, height: 54, corner: 3 },
  boardColorKey: "green",
  elements: [
    // THT pad top-left
    {
      id: "pad1", type: "pad", kind: "tht", layer: "both",
      x: 10, y: 10, size: 2.5, drill: 1.0,
    },
    // THT pad top-right
    {
      id: "pad2", type: "pad", kind: "tht", layer: "both",
      x: 75, y: 10, size: 2.5, drill: 1.0,
    },
    // SMD pad on top layer
    {
      id: "pad3", type: "pad", kind: "smd", layer: "top",
      x: 42, y: 27, w: 3.0, h: 2.0,
    },
    // Trace connecting pad1 to pad2
    {
      id: "trace1", type: "trace", layer: "top",
      points: [{ x: 10, y: 10 }, { x: 42, y: 10 }, { x: 75, y: 10 }],
      width: 0.5,
    },
    // Trace on bottom layer
    {
      id: "trace2", type: "trace", layer: "bottom",
      points: [{ x: 10, y: 44 }, { x: 75, y: 44 }],
      width: 0.3,
    },
    // Text on top silkscreen
    {
      id: "text1", type: "text", layer: "top",
      x: 5, y: 40, content: "ETCH TEST", size: 3, font: "sans",
    },
    // Hole (NPTH)
    {
      id: "hole1", type: "hole",
      x: 42, y: 5, diameter: 2.0, plated: false,
    },
  ],
};

// ---- Run -----------------------------------------------------------------

async function run() {
  console.log("=== Gerber Export Test ===\n");

  // 1. Generate gerber zip
  console.log("1. Generating Gerber zip from test project...");
  const zip = await exportGerber(testProject as any, "test_project");
  console.log(`   Zip blob size: ${zip.size} bytes`);

  // 2. Unzip (Node doesn't have Blob.arrayBuffer natively in all versions, use text workaround)
  console.log("\n2. Unzipping...");
  const arrayBuffer = await zip.arrayBuffer();
  const loaded = await JSZip.loadAsync(arrayBuffer);
  const fileNames = Object.keys(loaded.files).filter(n => !loaded.files[n].dir);
  console.log(`   Files in zip: ${fileNames.join(", ")}`);

  // 3. Parse each layer
  console.log("\n3. Parsing each Gerber layer:");
  let allPass = true;
  const results: Record<string, { paths: number; flashes: number; regions: number; bounds: string }> = {};

  for (const name of fileNames) {
    const text = await loaded.files[name].async("string");
    const color = guessColor(name);
    const parsed = parseGerber(text, name, color);

    const boundsOk =
      parsed.bounds.minX !== Infinity &&
      parsed.bounds.maxX !== -Infinity &&
      parsed.bounds.maxX > parsed.bounds.minX;

    results[name] = {
      paths: parsed.paths.length,
      flashes: parsed.flashes.length,
      regions: parsed.regions.length,
      bounds: boundsOk
        ? `(${parsed.bounds.minX.toFixed(2)}, ${parsed.bounds.minY.toFixed(2)}) → (${parsed.bounds.maxX.toFixed(2)}, ${parsed.bounds.maxY.toFixed(2)})`
        : "INVALID",
    };

    const r = results[name];
    console.log(`\n   ${name}`);
    console.log(`     paths:   ${r.paths}`);
    console.log(`     flashes: ${r.flashes}`);
    console.log(`     regions: ${r.regions}`);
    console.log(`     bounds:  ${r.bounds}`);
  }

  // 4. Assertions
  console.log("\n4. Assertions:");

  function assert(label: string, ok: boolean) {
    const mark = ok ? "PASS" : "FAIL";
    console.log(`   [${mark}] ${label}`);
    if (!ok) allPass = false;
  }

  // Expected file extensions
  const exts = fileNames.map(n => n.split(".").pop()!.toLowerCase());
  assert("Contains top copper (.gtl)", exts.includes("gtl"));
  assert("Contains bottom copper (.gbl)", exts.includes("gbl"));
  assert("Contains top silkscreen (.gto)", exts.includes("gto"));
  assert("Contains board outline (.gko)", exts.includes("gko"));
  assert("Contains drill file (.drl)", exts.includes("drl"));

  // Top copper should have flashes (THT pads + SMD pad) and paths (traces)
  const gtl = fileNames.find(n => n.endsWith(".gtl"))!;
  const gtlR = results[gtl];
  assert("Top copper has pad flashes (THT + SMD)", gtlR.flashes >= 3);
  assert("Top copper has trace paths", gtlR.paths > 0);
  assert("Top copper bounds are valid", !gtlR.bounds.includes("INVALID"));

  // Bottom copper: 2 THT pad flashes + 1 trace
  const gbl = fileNames.find(n => n.endsWith(".gbl"))!;
  const gblR = results[gbl];
  assert("Bottom copper has THT pad flashes", gblR.flashes >= 2);
  assert("Bottom copper has trace paths", gblR.paths > 0);

  // Drill: should have content (non-empty text with tool definitions)
  const drl = fileNames.find(n => n.endsWith(".drl"))!;
  const drlText = await loaded.files[drl].async("string");
  assert("Drill file has tool definition (T01)", drlText.includes("T01"));
  assert("Drill file has hole coordinates (X...Y...)", /X\d+Y\d+/.test(drlText));

  // Silkscreen: text was placed → should have stroke paths
  const gto = fileNames.find(n => n.endsWith(".gto"))!;
  const gtoR = results[gto];
  assert("Top silkscreen has stroke paths (text)", gtoR.paths > 0);

  // Outline: should have paths covering board perimeter
  const gko = fileNames.find(n => n.endsWith(".gko"))!;
  const gkoR = results[gko];
  assert("Board outline has paths", gkoR.paths > 0);

  // 5. Summary
  console.log(`\n=== ${allPass ? "ALL TESTS PASSED" : "SOME TESTS FAILED"} ===`);
  process.exit(allPass ? 0 : 1);
}

run().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
