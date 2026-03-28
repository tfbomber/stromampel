// ============================================================
// TimelineBar — Controlled component (activeHour lifted to parent)
// v3: "Jetzt" indicator, rounded bars, tap affordance hint
// ============================================================

import React, { useRef, useCallback, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, PanResponder, LayoutChangeEvent } from "react-native";
import type { HourSlot } from "../lib/types";
import { statusToSlotColor, priceToGradientColor } from "../lib/classify";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

interface Props {
  slots: HourSlot[];
  isToday: boolean;
  activeHour: number | null;
  onActiveHourChange: (hour: number | null) => void;
}

const LABEL_HOURS = [0, 6, 12, 18, 23];
const SLOTS = 24;

export default function TimelineBar({ slots, isToday, activeHour, onActiveHourChange }: Props) {
  const T = useTheme();
  const { lang } = useI18n();

  const barWidth    = useRef(0);
  const activeSlot  = slots.find((s) => s.hour === activeHour) ?? null;
  const activeIndex = slots.findIndex((s) => s.hour === activeHour);

  // Current hour — for "Jetzt" marker (today only)
  const nowHour = new Date().getHours();
  // Position of "Jetzt" marker as fraction 0–1
  const nowFraction = nowHour / 23;

  const onChangeRef = useRef(onActiveHourChange);
  useEffect(() => { onChangeRef.current = onActiveHourChange; }, [onActiveHourChange]);

  const allPrices = slots.filter((s) => s.priceCt !== null).map((s) => s.priceCt!);
  const dayMin = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const dayMax = allPrices.length > 0 ? Math.max(...allPrices) : 0;

  const getHour = useCallback((x: number) => {
    const w = barWidth.current;
    if (w <= 0) return 0;
    return Math.min(SLOTS - 1, Math.floor((Math.max(0, Math.min(x, w - 1)) / w) * SLOTS));
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) + 4,
      onPanResponderGrant: (e) => onChangeRef.current(getHour(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => onChangeRef.current(getHour(e.nativeEvent.locationX)),
      onPanResponderRelease: () => onChangeRef.current(null),
      onPanResponderTerminate: () => onChangeRef.current(null),
    })
  ).current;

  if (!slots || slots.length === 0) {
    return <Text style={{ color: T.sub, textAlign: "center" }}>Keine Daten</Text>;
  }

  const tapHint = lang === "de" ? "Tippen für Details" : "Tap for details";

  return (
    <View style={styles.wrapper}>
      {/* Price bubble (shows when a bar is selected) */}
      <View style={styles.labelArea}>
        {activeSlot ? (
          <View style={[styles.bubble, {
            backgroundColor: T.bubble,
            left: `${Math.max(5, Math.min(((activeIndex + 0.5) / SLOTS) * 100, 85))}%` as unknown as number,
          }]}>
            <Text style={[styles.bubbleText, { color: T.bubbleText }]}>
              {activeSlot.hour}:00
              {activeSlot.priceCt !== null ? ` · ${activeSlot.priceCt.toFixed(1).replace(".", ",")} ct` : " · –"}
            </Text>
          </View>
        ) : (
          // Tap affordance hint — only visible when nothing selected
          <Text style={[styles.tapHint, { color: T.sub }]}>{tapHint}</Text>
        )}
      </View>

      {/* Bar container with gesture */}
      <View
        style={styles.barContainer}
        onLayout={(e: LayoutChangeEvent) => { barWidth.current = e.nativeEvent.layout.width; }}
        {...pan.panHandlers}
      >
        {/* "Jetzt" vertical indicator — today only */}
        {isToday && (
          <View
            style={[styles.nowLine, {
              left: `${nowFraction * 100}%` as unknown as number,
              backgroundColor: T.sub,
            }]}
          >
            <Text style={[styles.nowLabel, { color: T.sub }]}>▾</Text>
          </View>
        )}

        {slots.map((slot) => {
          const isActive = slot.hour === activeHour;
          const BAR_MIN = 6;
          const BAR_MAX = 44;
          const range   = dayMax - dayMin;
          const slotH   = slot.priceCt !== null && range > 0
            ? Math.round(BAR_MIN + ((slot.priceCt - dayMin) / range) * (BAR_MAX - BAR_MIN))
            : Math.round((BAR_MIN + BAR_MAX) / 2);
          const activeH = Math.min(Math.max(Math.round(slotH * 1.5), 20), BAR_MAX);
          const barH    = isActive ? activeH : slotH;
          const barColor = slot.isPast
            ? ((T as any).barPast ?? "#d1d5db")
            : slot.priceCt !== null
              ? priceToGradientColor(slot.priceCt, dayMin, dayMax, slot.status)
              : statusToSlotColor(slot.status);

          return (
            // Full-column Pressable — entire column height is tappable, not just the tiny bar
            <Pressable
              key={slot.hour}
              style={({ pressed }) => ({
                flex: 1,
                height: "100%",
                justifyContent: "flex-end",
                opacity: slot.isPast ? 0.45 : pressed ? 0.75 : 1,
              })}
              onPress={() => onActiveHourChange(isActive ? null : slot.hour)}
            >
              <View
                style={{
                  height: barH,
                  backgroundColor: barColor,
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                  borderWidth: isActive ? 1.5 : 0,
                  borderColor: isActive ? T.bubble : "transparent",
                }}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Hour labels */}
      <View style={styles.labelsRow}>
        {LABEL_HOURS.map((h) => (
          <Text key={h} style={[styles.hourLabel, {
            color: T.sub,
            position: "absolute",
            left: `${(h / 23) * 100}%` as unknown as number,
          }]}>
            {h}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:      { width: "100%", marginTop: 10 },
  labelArea:    { height: 32, position: "relative", justifyContent: "flex-end", marginBottom: 3 },
  tapHint:      { fontSize: 10, textAlign: "right", opacity: 0.45, paddingBottom: 2 },
  bubble: {
    position: "absolute", bottom: 2,
    transform: [{ translateX: -40 }],
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
  },
  bubbleText:   { fontSize: 11, fontWeight: "600" } as any,
  // Bar area — relative so "Jetzt" line can be positioned inside
  barContainer: {
    flexDirection: "row",
    height: 44,
    alignItems: "flex-end",
    borderRadius: 8,
    overflow: "hidden",
    gap: 1.5,
    backgroundColor: "transparent",
    position: "relative",
  },
  // "Jetzt" line
  nowLine: {
    position: "absolute",
    bottom: 0,
    width: 1.5,
    top: 0,
    zIndex: 10,
    opacity: 0.5,
  },
  nowLabel: {
    position: "absolute",
    top: -14,
    fontSize: 10,
    transform: [{ translateX: -3 }],
    opacity: 0.6,
  },
  labelsRow:    { height: 16, position: "relative", marginTop: 3 },
  hourLabel:    { fontSize: 10, transform: [{ translateX: -4 }] },
});
