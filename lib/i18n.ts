// ============================================================
// lib/i18n.ts — Lightweight i18n context (DE / EN)
//
// No external library. Pattern mirrors ThemeContext.
// Usage: const { t, lang } = useI18n();
//        t("today") → "Heute" | "Today"
// ============================================================

import React, { createContext, useContext } from "react";

export type Language = "de" | "en";

// ── Translation table ─────────────────────────────────────
const translations = {
  de: {
    // ── Settings sheet ─────────────────────────────────
    settings:           "⚙️ Einstellungen",
    myTariff:           "MEIN STROMTARIF",
    dynamic:            "Dynamisch",
    dynamicSub:         "Preis ändert sich",
    fixed:              "Fester Preis",
    fixedSub:           "Preis fix",
    fixedNote:          "ℹ️ Spotpreise nur als Referenz.",
    myProvider:         "MEIN ANBIETER",
    appearance:         "ERSCHEINUNGSBILD",
    light:              "Hell",
    dark:               "Dunkel",
    language:           "SPRACHE",
    savedLocal:         "Nur lokal gespeichert",
    // ── Main screen ────────────────────────────────────
    appSub:             "Günstiger Strom – der richtige Moment",
    loading:            "Preise werden geladen …",
    errorLoad:          "Preisdaten konnten nicht geladen werden.\nBitte Internetverbindung prüfen.",
    retry:              "Nochmal versuchen",
    today:              "Heute",
    tomorrow:           "Morgen",
    cheapFrom:          "Günstiger ab",
    best:               "Beste:",
    tomorrowPending:    "Preise erscheinen täglich ab ~14:00 Uhr",
    tomorrowAuto:       "↻ App aktualisiert automatisch",
    fixedActive:        "Fester Strompreis aktiv",
    fixedActiveSub:     "Spotpreise nur zur Info",
    fixedFomo:          "Heute wäre Strom ≈{diff} ct günstiger mit dynamischem Tarif",
    notifyPrompt:       "Günstige Zeiten erinnern?",
    notifyYes:          "Ja, bitte",
    notifyBefore30:     "30 Min. vorher",
    notifyBefore60:     "1 Std. vorher",
    notifyOnStart:      "beim Start",
    notifyChange:       "Ändern",
    notifyOff:          "Aus",
    feedbackLink:       "Feedback",
    spotRef:            "Quelle: EPEX Spot / ENTSO-E",
    spotWithProvider:   "Spot + {p} · inkl. MwSt. · ohne Netzentgelt",
    // ── Feedback sheet ─────────────────────────────────
    feedbackTitle:      "✍️ Feedback",
    feedbackHint:       "Was gefällt dir? Was vermisst du?\nDein Input hilft uns dieser App zu verbessern.",
    feedbackPlaceholder:"Schreib uns etwas …",
    send:               "Senden",
    sending:            "…",
    cancel:             "Abbrechen",
    feedbackSent:       "Danke für dein Feedback!",
    feedbackError:      "Fehler beim Senden. Bitte nochmal versuchen.",
    // ── General ─────────────────────────────────────────
    otherProvider:      "Sonstiger",
    allgemein:          "Allgemein",
  },
  en: {
    // ── Settings sheet ─────────────────────────────────
    settings:           "⚙️ Settings",
    myTariff:           "MY ELECTRICITY TARIFF",
    dynamic:            "Dynamic",
    dynamicSub:         "Price changes hourly",
    fixed:              "Fixed Price",
    fixedSub:           "Price stays fixed",
    fixedNote:          "ℹ️ Spot prices are shown as reference.",
    myProvider:         "MY PROVIDER",
    appearance:         "APPEARANCE",
    light:              "Light",
    dark:               "Dark",
    language:           "LANGUAGE",
    savedLocal:         "Stored on this device only",
    // ── Main screen ────────────────────────────────────
    appSub:             "Smart electricity timing at a glance",
    loading:            "Loading prices …",
    errorLoad:          "Could not load price data.\nPlease check your internet connection.",
    retry:              "Try again",
    today:              "Today",
    tomorrow:           "Tomorrow",
    cheapFrom:          "Cheaper from",
    best:               "Best:",
    tomorrowPending:    "Tomorrow's prices appear daily from ~2:00 PM",
    tomorrowAuto:       "↻ Updates automatically",
    fixedActive:        "Fixed electricity tariff active",
    fixedActiveSub:     "Spot prices for reference only",
    fixedFomo:          "Today dynamic would be ≈{diff} ct cheaper",
    notifyPrompt:       "Get reminded about cheaper times?",
    notifyYes:          "Yes, please",
    notifyBefore30:     "30 min before",
    notifyBefore60:     "1 hour before",
    notifyOnStart:      "at start",
    notifyChange:       "Change",
    notifyOff:          "Off",
    feedbackLink:       "Feedback",
    spotRef:            "Source: EPEX Spot / ENTSO-E",
    spotWithProvider:   "Spot + {p} · incl. VAT · excl. grid fees",
    // ── Feedback sheet ─────────────────────────────────
    feedbackTitle:      "✍️ Feedback",
    feedbackHint:       "What do you like? What's missing?\nYour input helps us improve this app.",
    feedbackPlaceholder:"Write us something …",
    send:               "Send",
    sending:            "…",
    cancel:             "Cancel",
    feedbackSent:       "Thanks for your feedback!",
    feedbackError:      "Error sending. Please try again.",
    // ── General ─────────────────────────────────────────
    otherProvider:      "Other",
    allgemein:          "General",
  },
} as const;

export type TranslationKey = keyof typeof translations.de;
export type Translations   = typeof translations.de;

// ── Context ───────────────────────────────────────────────
interface I18nValue {
  lang: Language;
  t:    (key: TranslationKey) => string;
}

export const I18nContext = createContext<I18nValue>({
  lang: "de",
  t:    (key) => translations.de[key],
});

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Build a context value from a Language code */
export function makeI18n(lang: Language): I18nValue {
  const table = translations[lang];
  return {
    lang,
    t: (key: TranslationKey) => table[key] ?? translations.de[key],
  };
}
