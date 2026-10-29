// UI chrome palette — medium grey + grapefruit
export const UI = {
  // backgrounds
  bgApp:       "#383838",
  bgPanel:     "#444444",
  bgCanvas:    "#323232",
  bgInput:     "#3c3c3c",
  bgChipOn:    "#4e4e4e",

  // borders
  border:      "#555555",
  borderSub:   "#4a4a4a",

  // text
  textPrimary: "#ede9e4",
  textMuted:   "#b0a89e",
  textFaint:   "#7e766e",

  // accent — grapefruit orange
  accent:      "#e8623a",
  accentDark:  "#c44828",
  accentText:  "#ffffff",

  // danger
  danger:      "#c0392b",
  dangerBg:    "rgba(192,57,43,0.15)",
  dangerBorder:"#7a2a24",
} as const;

// PCB board solder-mask / copper colors (never change these)
export const BOARD_COLORS = [
  { key: "white",  label: "White",  fill: "#e8e8e0", dot: "#c8cac2", copper: "#888880" },
  { key: "red",    label: "Red",    fill: "#a92f2e", dot: "#d44444", copper: "#d53c3f" },
  { key: "yellow", label: "Yellow", fill: "#9c8e03", dot: "#c8b404", copper: "#d49003" },
  { key: "green",  label: "Green",  fill: "#066434", dot: "#0d9e52", copper: "#03865a" },
  { key: "blue",   label: "Blue",   fill: "#073cac", dot: "#1a5cd4", copper: "#015bbc" },
  { key: "black",  label: "Black",  fill: "#18191c", dot: "#3a3d44", copper: "#6b6e71" },
  { key: "purple", label: "Purple", fill: "#760465", dot: "#a80d90", copper: "#aa409c" },
] as const;

export type BoardColorKey = typeof BOARD_COLORS[number]["key"];
