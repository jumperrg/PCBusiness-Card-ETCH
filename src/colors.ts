// UI chrome palette — drafting paper + grapefruit
export const UI = {
  // backgrounds
  bgApp:       "#f4f2ed",
  bgPanel:     "#ffffff",
  bgCanvas:    "#f8f7f3",
  bgInput:     "#f7f6f2",
  bgChipOn:    "#efece6",

  // borders
  border:      "#e1ded6",
  borderSub:   "#e6e3dc",

  // text
  textPrimary: "#1d2126",
  textMuted:   "#565c64",
  textFaint:   "#8d9299",

  // accent — grapefruit orange
  accent:      "#e8623a",
  accentDark:  "#c44828",
  accentText:  "#ffffff",

  // danger
  danger:      "#c0392b",
  dangerBg:    "rgba(192,57,43,0.08)",
  dangerBorder:"#f0c4bd",

  // floating panels
  shadow:      "0 1px 2px rgba(40,36,30,0.06), 0 12px 32px -12px rgba(40,36,30,0.22)",
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
