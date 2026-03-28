// ============================================================
// theme.ts — Unified theme tokens + React Context
// ============================================================

import { createContext, useContext } from "react";

export interface ThemeTokens {
  bg:        string;  // screen background
  card:      string;  // card / sheet background
  text:      string;  // primary text
  sub:       string;  // secondary text
  footer:    string;  // footer / footnote text
  indicator: string;  // activity indicator
  border:    string;  // subtle borders
  bubble:    string;  // timeline tooltip bg
  bubbleText:string;  // timeline tooltip text
  sectionLabel: string; // settings section label
  inputBorder:  string; // pill / card border
}

export const LIGHT: ThemeTokens = {
  bg:          "#f3f4f6",
  card:        "#ffffff",
  text:        "#111827",
  sub:         "#6b7280",
  footer:      "#d1d5db",
  indicator:   "#111827",
  border:      "#e5e7eb",
  bubble:      "#111827",
  bubbleText:  "#ffffff",
  sectionLabel:"#9ca3af",
  inputBorder: "#e5e7eb",
};

export const DARK: ThemeTokens = {
  bg:          "#111827",
  card:        "#1f2937",
  text:        "#f9fafb",
  sub:         "#9ca3af",
  footer:      "#9ca3af",   // raised from #4b5563 — visible on dark card bg
  indicator:   "#f9fafb",
  border:      "#374151",
  bubble:      "#f9fafb",
  bubbleText:  "#111827",
  sectionLabel:"#6b7280",
  inputBorder: "#374151",
};

export const ThemeContext = createContext<ThemeTokens>(LIGHT);
export const useTheme = () => useContext(ThemeContext);
