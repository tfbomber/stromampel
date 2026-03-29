// ============================================================
// DeviceSavings — Always-visible appliance savings card (3-state)
// "Starten" records a run; device is locked for its cycle duration.
// 👍 animation confirms the action.
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Modal } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HourSlot } from "../lib/types";
import type { TariffType } from "../lib/settings";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

interface Props {
  todaySlots:     HourSlot[];
  currentPriceCt: number | null;
  tariffType:     TariffType;
  currentStatus?: string;            // "GREEN" | "YELLOW" | "RED" | "UNKNOWN"
  onClaim?:  (device: string, kWh: number, savingEur: number) => void;
  onCancel?: (device: string) => void;
}

const RUNNING_KEY = "sa_running_v1";

const DEVICES = [
  { emoji: "🫧", name: "Waschgang",    nameEn: "Wash Cycle",      kWh: 1.2,  durationMs: 2   * 3600_000 },
  { emoji: "🍽️", name: "Spülmaschine", nameEn: "Dishwasher",     kWh: 1.2,  durationMs: 1.5 * 3600_000 },
  { emoji: "🌀", name: "Trockner",     nameEn: "Dryer",           kWh: 3.0,  durationMs: 2.5 * 3600_000 },
  { emoji: "🚗", name: "E-Auto Laden", nameEn: "EV Charging",     kWh: 20.0, durationMs: 4   * 3600_000 },
];

const VAT = 1.19;

/** Minimum saving in EUR to enable Starten — below this it's not worth recording */
const MIN_SAVING_EUR = 0.10;

/** Coin trajectories for money rain (px offset from screen centre) */
const COINS = [
  { emoji: "💶", dx:  -90, dy: -230, rotDeg: -30, delay:  0 },
  { emoji: "🪙", dx:  -44, dy: -295, rotDeg: -12, delay: 45 },
  { emoji: "💶", dx:    3, dy: -335, rotDeg:   6, delay: 15 },
  { emoji: "💶", dx:   50, dy: -290, rotDeg:  20, delay: 60 },
  { emoji: "🪙", dx:   94, dy: -220, rotDeg:  36, delay: 30 },
  { emoji: "💰", dx:  -18, dy: -170, rotDeg: -18, delay: 85 },
] as const;

function eurLabel(diffCt: number, kWh: number): string {
  // priceCt diffs are already VAT-adjusted → no need to multiply by VAT again
  return `~${((diffCt * kWh) / 100).toFixed(2)} €`;
}
function rangeLabel(lo: number, hi: number, kWh: number): string {
  const l = ((lo * kWh) / 100).toFixed(2);
  const h = ((hi * kWh) / 100).toFixed(2);
  return l === h ? `~${l} €` : `~${l}–${h} €`;
}
function padTime(d: Date) {
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function DeviceSavings({ todaySlots, currentPriceCt, tariffType, currentStatus, onClaim, onCancel }: Props) {
  const T = useTheme();
  const { lang } = useI18n();

  // ── Running-device cooldown state (persisted) ────────────────
  // Key: device name → Unix ms when "Starten" was pressed
  const [running, setRunning] = useState<Record<string, number>>({});

  useEffect(() => {
    AsyncStorage.getItem(RUNNING_KEY).then((raw) => {
      if (!raw) return;
      const stored: Record<string, number> = JSON.parse(raw);
      // Prune expired entries now so they don't accumulate
      const now    = Date.now();
      const active: Record<string, number> = {};
      DEVICES.forEach((d) => {
        const startedAt = stored[d.name];
        if (startedAt !== undefined && now - startedAt < d.durationMs) {
          active[d.name] = startedAt;
        }
      });
      setRunning(active);
    }).catch(() => {});
  }, []);

  // Returns true while device is still within its cycle duration
  function isRunning(name: string, durationMs: number): boolean {
    const t = running[name];
    return t !== undefined && Date.now() - t < durationMs;
  }
  function finishLabel(name: string, durationMs: number): string {
    const t = running[name];
    if (!t) return "";
    const word = lang === "en" ? "Done" : "Fertig";
    return `${word} ~${padTime(new Date(t + durationMs))}`;
  }

  async function handleStarten(d: typeof DEVICES[0], savingEur: number) {
    if (isRunning(d.name, d.durationMs)) return;
    onClaim?.(d.name, d.kWh, savingEur);
    const now      = Date.now();
    const newState = { ...running, [d.name]: now };
    setRunning(newState);
    await AsyncStorage.setItem(RUNNING_KEY, JSON.stringify(newState)).catch(() => {});
    triggerCelebration(savingEur);
  }

  async function handleCancel(deviceName: string) {
    if (!isRunning(deviceName, DEVICES.find(d => d.name === deviceName)?.durationMs ?? 0)) return;
    const newState = { ...running };
    delete newState[deviceName];
    setRunning(newState);
    await AsyncStorage.setItem(RUNNING_KEY, JSON.stringify(newState)).catch(() => {});
    onCancel?.(deviceName);
  }

  // ── Money Rain Celebration ─────────────────────────────────────
  const coinAnims = useRef(
    COINS.map(() => ({
      op:  new Animated.Value(0),
      tx:  new Animated.Value(0),
      ty:  new Animated.Value(0),
      rot: new Animated.Value(0),
      sc:  new Animated.Value(0),
    }))
  ).current;
  const amtOpacity = useRef(new Animated.Value(0)).current;
  const amtScale   = useRef(new Animated.Value(0.5)).current;
  const amtTranslY = useRef(new Animated.Value(0)).current;
  const counterRef  = useRef(new Animated.Value(0)).current;
  const [animAmt,   setAnimAmt]   = useState("0,00");
  const [showMoney, setShowMoney] = useState(false);

  useEffect(() => {
    const id = counterRef.addListener(({ value }) =>
      setAnimAmt(value.toFixed(2).replace(".", ","))
    );
    return () => counterRef.removeListener(id);
  }, []);

  function triggerCelebration(savingEur: number) {
    setShowMoney(true);
    setAnimAmt("0,00");
    amtOpacity.setValue(0); amtScale.setValue(0.5); amtTranslY.setValue(0);
    counterRef.setValue(0);
    coinAnims.forEach((c) => { c.op.setValue(0); c.tx.setValue(0); c.ty.setValue(0); c.rot.setValue(0); c.sc.setValue(0); });

    // Amount: count up + spring in
    Animated.parallel([
      Animated.timing(amtOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(amtScale,   { toValue: 1, useNativeDriver: true, speed: 38, bounciness: 18 }),
    ]).start();
    Animated.timing(counterRef, { toValue: savingEur, duration: 950, useNativeDriver: false }).start();

    // Coins: staggered arc launch
    COINS.forEach((coin, i) => {
      const c = coinAnims[i];
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(c.op, { toValue: 1, duration: 130, useNativeDriver: true }),
          Animated.spring(c.tx, { toValue: coin.dx, useNativeDriver: true, speed: 22, bounciness: 1 }),
          Animated.spring(c.ty, { toValue: coin.dy, useNativeDriver: true, speed: 20, bounciness: 3 }),
          Animated.spring(c.sc, { toValue: 1,       useNativeDriver: true, speed: 32, bounciness: 10 }),
          Animated.timing(c.rot,{ toValue: 1, duration: 700, useNativeDriver: true }),
        ]).start();
      }, coin.delay);
    });

    // Fade everything out at peak
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(amtOpacity, { toValue: 0, duration: 480, useNativeDriver: true }),
        Animated.timing(amtTranslY, { toValue: -50, duration: 480, useNativeDriver: true }),
        ...coinAnims.map((c) => Animated.timing(c.op, { toValue: 0, duration: 480, useNativeDriver: true })),
      ]).start(() => setShowMoney(false));
    }, 1550);
  }


  // ── Fixed tariff banner ──────────────────────────────────────
  if (tariffType === "fixed") {
    return (
      <View style={[styles.card, styles.fixedBanner, { backgroundColor: T.card, borderColor: "#f59e0b" }]}>
        <Text style={styles.fixedIcon}>🔒</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fixedTitle, { color: T.text }]}>
            {lang === "en" ? "Fixed electricity tariff active" : "Fester Strompreis aktiv"}
          </Text>
          <Text style={[styles.fixedSub, { color: T.sub }]}>
            {lang === "en"
              ? "The app shows spot market prices as reference. Your fixed price remains unchanged."
              : "Die App zeigt Spotmarktpreise als Orientierung. Dein Fixpreis bleibt unverändert – keine persönliche Ersparnis berechnet."}
          </Text>
        </View>
      </View>
    );
  }

  // ── No future data ───────────────────────────────────────────
  const futureSlots = todaySlots.filter((s) => !s.isPast && s.priceCt !== null);
  if (futureSlots.length === 0 || currentPriceCt === null) return null;

  const minPriceCt = Math.min(...futureSlots.map((s) => s.priceCt!));
  const maxPriceCt = Math.max(...futureSlots.map((s) => s.priceCt!));
  const cheapSlot  = futureSlots.find((s) => s.priceCt === minPriceCt);
  const cheapLabel = cheapSlot
    ? `${cheapSlot.hour}:00 ${lang === "en" ? "h" : "Uhr"}`
    : (lang === "en" ? "cheapest hour" : "günstigste Stunde");

  const priceDiffLow  = currentPriceCt - minPriceCt; // current vs cheapest future slot
  const peakDiff      = Math.max(0, maxPriceCt - currentPriceCt); // current vs today's peak
  const waitSaveDiff  = Math.max(0, priceDiffLow);                // how much cheaper if waited

  // ── Status-based mode ────────────────────────────────────────
  // GREEN  → start now, saves vs peak
  // YELLOW → can start, but note cheaper option later
  // RED    → wait, button disabled
  const isGreen  = currentStatus === "GREEN";
  const isYellow = currentStatus === "YELLOW";
  const isRed    = currentStatus === "RED" || (!isGreen && !isYellow);
  const canStart = isGreen || isYellow;   // both allow Starten
  const hasSpread = peakDiff >= 1;        // meaningful price spread exists

  return (
    <>
      {/* Full-screen money rain Modal */}
      <Modal transparent visible={showMoney} animationType="none" statusBarTranslucent>
        <View style={styles.moneyRoot} pointerEvents="none">
          {coinAnims.map((c, i) => (
            <Animated.View
              key={i}
              style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                alignItems: "center", justifyContent: "center",
                opacity: c.op,
                transform: [
                  { translateX: c.tx }, { translateY: c.ty }, { scale: c.sc },
                  { rotate: c.rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${COINS[i].rotDeg}deg`] }) },
                ],
              }}
            >
              <Text style={styles.coinEmoji}>{COINS[i].emoji}</Text>
            </Animated.View>
          ))}
          <Animated.View
            style={{ alignItems: "center", opacity: amtOpacity,
              transform: [{ scale: amtScale }, { translateY: amtTranslY }] }}
          >
            <Text style={styles.moneyPlus}>+</Text>
            <Text style={styles.moneyAmount}>{animAmt} €</Text>
            <Text style={styles.moneyLabel}>
              {lang === "en" ? "S A V E D" : "G E S P A R T"}
            </Text>
          </Animated.View>
        </View>
      </Modal>

      {/* Savings card */}
      <View style={[styles.card, { backgroundColor: T.card, overflow: "hidden" }]}>
        {/* Accent bar: GREEN=green, YELLOW=amber, RED=red */}
        {isGreen  && <View style={styles.greenAccent} />}
        {isYellow && <View style={styles.amberAccent} />}
        {isRed    && <View style={styles.redAccent} />}

        {/* ── Mode header ──────────────────────────────── */}
        {isGreen ? (
          <View style={styles.nowBanner}>
            <Text style={styles.nowIcon}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.nowTitle, { color: "#15803d" }]}>
                {lang === "en" ? "Now is the time!" : "Jetzt ist die Zeit!"}
              </Text>
              <Text style={[styles.nowSub, { color: T.sub }]}>
                {hasSpread
                  ? (lang === "en"
                    ? `Cheapest price today – ${currentPriceCt.toFixed(1).replace(".", ",")} ct/kWh`
                    : `Günstigster Preis heute – ${currentPriceCt.toFixed(1).replace(".", ",")} ct/kWh`)
                  : (lang === "en" ? "Prices fairly stable today" : "Preise heute weitgehend stabil")}
              </Text>
            </View>
          </View>
        ) : isYellow ? (
          <View style={styles.nowBanner}>
            <Text style={styles.nowIcon}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.nowTitle, { color: "#b45309" }]}>
                {lang === "en" ? "Acceptable price" : "Akzeptabler Preis"}
              </Text>
              <Text style={[styles.nowSub, { color: T.sub }]}>
                {lang === "en"
                  ? `Cheaper from ${cheapLabel} · ${minPriceCt.toFixed(1).replace(".", ",")} ct/kWh`
                  : `Günstiger ab ${cheapLabel} · ${minPriceCt.toFixed(1).replace(".", ",")} ct/kWh`}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={[styles.title, { color: "#dc2626" }]}>
              {lang === "en" ? "⏳ Wait – too expensive now!" : "⏳ Noch warten – jetzt zu teuer!"}
            </Text>
            <Text style={[styles.subtitle, { color: T.sub }]}>
              {lang === "en"
                ? `Now ${currentPriceCt.toFixed(1).replace(".", ",")} ct · cheaper from ${cheapLabel}`
                : `Jetzt ${currentPriceCt.toFixed(1).replace(".", ",")} ct · günstiger ab ${cheapLabel}`}
            </Text>
          </>
        )}

        {/* Hint — GREEN+spread only */}
        {isGreen && hasSpread && (
          <Text style={[styles.modeHint, { color: T.sub }]}>
            {lang === "en"
              ? "Starting now saves vs. the most expensive hours:"
              : "Jetzt starten spart gegenüber den teuren Stunden:"}
          </Text>
        )}
        {/* YELLOW hint */}
        {isYellow && (
          <Text style={[styles.modeHint, { color: T.sub }]}>
            {lang === "en"
              ? "You can start now – or wait for the cheaper slot:"
              : "Du kannst jetzt starten – oder auf den günstigeren Slot warten:"}
          </Text>
        )}

        <View style={styles.rows}>
          {DEVICES.map((d) => {
            const running_   = isRunning(d.name, d.durationMs);

            // Savings to DISPLAY & RECORD (same value — consistent):
            //   GREEN  → vs today's peak ("you save X€ vs most expensive")
            //   YELLOW → vs cheapest slot ("you could save X€ by waiting")
            const displaySavingEur = isGreen
              ? (peakDiff     * d.kWh) / 100
              : (waitSaveDiff * d.kWh) / 100;

            // Only worth showing / enabling Starten if saving crosses the threshold
            const savingWorthy = displaySavingEur >= MIN_SAVING_EUR;

            const savingText = savingWorthy
              ? (isGreen
                  ? eurLabel(peakDiff, d.kWh)
                  : `${eurLabel(waitSaveDiff, d.kWh)} ${lang === "en" ? "saving" : "Ersparnis"}`)
              : "–";

            // Button label & state
            // Starten disabled if saving too small (not worth it) OR price is RED
            const canStartDevice = canStart && savingWorthy;
            const btnLabel = running_        ? (lang === "en" ? "✓ Running" : "✓ Läuft")
                           : canStartDevice  ? (lang === "en" ? "Start" : "Starten")
                           : (lang === "en" ? "Wait" : "Warten");

            return (
              <View key={d.name} style={[styles.row, isGreen && styles.rowOptimal]}>
                <Text style={styles.emoji}>{d.emoji}</Text>
                <View style={styles.nameCol}>
                  <Text style={[styles.deviceName, { color: T.text }]} numberOfLines={1}>
                    {lang === "en" ? d.nameEn : d.name}
                  </Text>
                  <Text style={[styles.deviceKwh, { color: T.sub }]}>{d.kWh} kWh</Text>
                  {running_ && (
                    <Text style={[styles.finishHint, { color: "#16a34a" }]}>
                      {finishLabel(d.name, d.durationMs)}
                    </Text>
                  )}
                </View>
                <View style={styles.rightCol}>
                  <Text style={[styles.saving, {
                    color: isGreen ? "#16a34a" : isYellow ? "#b45309" : T.sub,
                  }]}>
                    {savingText}
                  </Text>
                  <Pressable
                    style={[
                      styles.startenBtn,
                      running_                  && styles.startenBtnDone,
                      isYellow && !running_ && canStartDevice && styles.startenBtnYellow,
                      (!canStartDevice && !running_) && styles.startenBtnDisabled,
                    ]}
                    onPress={() =>
                      running_         ? handleCancel(d.name)
                      : canStartDevice ? handleStarten(d, displaySavingEur)
                      : undefined
                    }
                    disabled={!canStartDevice && !running_}
                  >
                    <Text style={[
                      styles.startenText,
                      running_                          && styles.startenTextDone,
                      isYellow && !running_ && canStartDevice && styles.startenTextYellow,
                      (!canStartDevice && !running_)    && styles.startenTextDisabled,
                    ]}>
                      {btnLabel}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {/* Mode footnote */}
        <Text style={[styles.footnote, { color: T.footer }]}>
          {isGreen
            ? (lang === "en" ? "vs. most expensive slot today · incl. VAT" : "vs. teuerstem Restfenster heute · inkl. MwSt.")
            : isYellow
              ? (lang === "en" ? `Saving if from ${cheapLabel} · incl. VAT` : `Ersparnis wenn ab ${cheapLabel} · inkl. MwSt.`)
              : (lang === "en" ? `Cheaper from ${cheapLabel} · incl. VAT` : `Günstiger ab ${cheapLabel} · inkl. MwSt.`)}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14, padding: 16, marginTop: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  greenAccent: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
    backgroundColor: "#16a34a",
  },
  amberAccent: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
    backgroundColor: "#f59e0b",
  },
  redAccent: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
    backgroundColor: "#ef4444",
  },
  // Money rain modal
  moneyRoot:   { flex: 1, alignItems: "center", justifyContent: "center" },
  coinEmoji:   { fontSize: 30 },
  moneyPlus:   { fontSize: 24, fontWeight: "900", color: "#16a34a", opacity: 0.85 },
  moneyAmount: {
    fontSize: 64, fontWeight: "900", color: "#15803d",
    letterSpacing: -2, lineHeight: 70,
    textShadowColor: "rgba(21,128,61,0.35)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  moneyLabel:  { fontSize: 13, fontWeight: "700", color: "#22c55e", letterSpacing: 4, marginTop: 6 },
  // MODE A header
  nowBanner:   { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 8 },
  nowIcon:     { fontSize: 20 },
  nowTitle:    { fontSize: 14, fontWeight: "700" },
  nowSub:      { fontSize: 11, marginTop: 2 },
  modeHint:    { fontSize: 11, marginBottom: 8, lineHeight: 16, opacity: 0.75 },
  // Fixed tariff
  fixedBanner: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1 },
  fixedIcon:   { fontSize: 20, marginTop: 2 },
  fixedTitle:  { fontSize: 13, fontWeight: "600", marginBottom: 3 },
  fixedSub:    { fontSize: 11, lineHeight: 16 },
  // Wait modes
  title:       { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  subtitle:    { fontSize: 11, marginBottom: 10, opacity: 0.75 },
  // Table rows
  rows:        { gap: 2 },
  row: {
    flexDirection: "row", alignItems: "center",
    gap: 8, paddingVertical: 8, paddingHorizontal: 6,
    borderRadius: 8,
    borderBottomWidth: 0,   // use spacing instead of line
  },
  rowOptimal:  { backgroundColor: "rgba(22,163,74,0.05)" },
  emoji:      { fontSize: 15, width: 22 },
  // Name column
  nameCol:    { flex: 1, minWidth: 0 },
  deviceName: { fontSize: 12, fontWeight: "500" },
  deviceKwh:  { fontSize: 10, marginTop: 1, opacity: 0.6 },
  finishHint: { fontSize: 10, marginTop: 1, color: "#16a34a" },
  // Right column: saving label + button stacked
  rightCol:   { alignItems: "flex-end", gap: 5 },
  saving:     { fontSize: 12, fontWeight: "600", textAlign: "right" },
  // Button — lightweight text/pill style
  startenBtn: {
    minWidth: 56,
    paddingHorizontal: 10, paddingVertical: 4, alignItems: "center",
    borderRadius: 10, borderWidth: 1,
    borderColor: "#16a34a",
  },
  startenBtnDone:     { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4" },
  // YELLOW: amber outline button
  startenBtnYellow:    { borderColor: "#f59e0b" },
  startenBtnDisabled: { borderColor: "#e5e7eb", opacity: 0.5 },
  startenText:         { fontSize: 11, fontWeight: "600", color: "#16a34a" },
  startenTextDone:     { color: "#15803d" },
  startenTextYellow:   { color: "#b45309" },
  startenTextDisabled: { color: "#9ca3af" },
  footnote:   { fontSize: 10, marginTop: 10, textAlign: "right" },
});
