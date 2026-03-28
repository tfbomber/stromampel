// ============================================================
// StromAmpel App — Core Types
// (ported from web lib/types.ts)
// ============================================================

export type Status = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

export interface HourSlot {
  hour: number;
  priceCt: number | null;
  status: Status;
  isPast: boolean;
  isCurrentHour: boolean;
}

export interface CheapWindow {
  startHour: number;
  endHour: number;
  label: string;       // e.g. "9–17 Uhr"
  avgCt: number;
  date: "today" | "tomorrow";
}

export interface DayData {
  slots: HourSlot[];
  cheapestWindow: CheapWindow | null;
  nextCheapWindow: CheapWindow | null;
}

export interface AppData {
  current: HourSlot | null;
  today: DayData;
  tomorrow: DayData | null;
}
