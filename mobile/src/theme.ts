import { Platform } from "react-native";

export const colors = {
  bg: "#0D0B0A",
  card: "#161312",
  cardAlt: "#1D1917",
  border: "#2A2421",
  brass: "#E5A93C",
  brassHover: "#F5BA4F",
  brassMuted: "rgba(229, 169, 60, 0.15)",
  mahogany: "#8B3A2B",
  emerald: "#4CAF50",
  emeraldDim: "rgba(76, 175, 80, 0.15)",
  crimson: "#E05252",
  crimsonDim: "rgba(224, 82, 82, 0.15)",
  amber: "#E0922F",
  amberDim: "rgba(217, 118, 6, 0.15)",
  text: "#F3EFEA",
  textSecondary: "#A39B92",
  textMuted: "#6E665E",
};

export const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export const radius = { sm: 8, md: 12, lg: 16, xl: 24 };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
