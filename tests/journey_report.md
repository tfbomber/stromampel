# Executive Summary

| Persona | Mode | App Days | Precise | Fallback | No Window | Issues |
|---|---|---|---|---|---|---|
| Maria | daily_smart | 7/7 | 10 | 35 | 1 | 1⚠️ |
| Peter | daily_smart | 7/7 | 11 | 35 | 1 | ✅ |
| Lisa | daily_smart | 5/7 | 7 | 25 | 1 | 1⚠️ |
| Thomas | daily_smart | 3/7 | 2 | 15 | 1 | 2⚠️ |
| Sabine | once | 2/7 | 2 | 0 | 1 | 2⚠️ |
| Hans | daily_smart | 7/7 | 4 | 35 | 1 | 3⚠️ |
| EDGE | daily_smart | 7/7 | 14 | 35 | 0 | ✅ |
| EDGE | daily_smart | 7/7 | 8 | 35 | 2 | ✅ |
| EDGE | daily_smart | 0/7 | 0 | 0 | 0 | 2⚠️ |
| EDGE | daily_smart | 7/7 | 0 | 35 | 7 | 2⚠️ |

# StromAmpel — User Journey Test Report
Generated: 2026-04-24T08:42:29.615Z
Period: 7 days × 10 personas

---

## Maria — Morning Checker
> Opens app at 7AM daily, daily_smart mode, wants to know when to run dishwasher/washing machine

| Setting | Value |
|---|---|
| Mode | daily_smart |
| Timing | 30 min before |
| Surcharge | 23 ct |
| App open | Sun,Mon,Tue,Wed,Thu,Fri,Sat at 7:00 |

### Daily Log
| Day | DOW | Pattern | App | Open | Window | Core | Notifs | Issues |
|-----|-----|---------|-----|------|--------|------|--------|--------|
| 0 | Wed | normal_valley | ✅ | 7 | 11–16 Uhr | 11–14 Uhr | 2p+5f | ✅ |
| 1 | Thu | normal_valley | ✅ | 7 | 11–16 Uhr | 12–15 Uhr | 1p+5f | ✅ |
| 2 | Fri | flat_day | ✅ | 7 | none | — | 1p+5f | ✅ |
| 3 | Sat | normal_valley | ✅ | 7 | 11–16 Uhr | 11–14 Uhr | 2p+5f | ✅ |
| 4 | Sun | volatile | ✅ | 7 | 11–13 Uhr | 11–13 Uhr | 2p+5f | ✅ |
| 5 | Mon | normal_valley | ✅ | 7 | 11–16 Uhr | 12–15 Uhr | 1p+5f | ✅ |
| 6 | Tue | early_valley | ✅ | 7 | 2–6 Uhr | 2–5 Uhr | 1p+5f | 📱 Opened at 7:00 but cheap window already ended (2–6 Uhr) |

### Notifications Sent
- 11:00 "Heute: 11–14 Uhr · ≈26.1 ct"
- 13:00 "Morgen: 13–16 Uhr · ≈25.6 ct"
- 12:00 "Heute: 12–15 Uhr · ≈25.7 ct"
- 11:00 "Morgen: 11–14 Uhr · ≈25.4 ct"
- 11:00 "Heute: 11–14 Uhr · ≈25.9 ct"
- 20:00 "Morgen: 20–22 Uhr · ≈21.6 ct"
- 11:00 "Heute: 11–13 Uhr · ≈21.2 ct"
- 11:00 "Morgen: 11–14 Uhr · ≈26.0 ct"
- 12:00 "Heute: 12–15 Uhr · ≈25.4 ct"
- 13:00 "Morgen: 13–16 Uhr · ≈25.1 ct"

---

## Peter — Evening Planner
> Opens app around 18:00 to plan tomorrow, daily_smart, checks EV charging window

| Setting | Value |
|---|---|
| Mode | daily_smart |
| Timing | 60 min before |
| Surcharge | 25 ct |
| App open | Sun,Mon,Tue,Wed,Thu,Fri,Sat at 18:00 |

### Daily Log
| Day | DOW | Pattern | App | Open | Window | Core | Notifs | Issues |
|-----|-----|---------|-----|------|--------|------|--------|--------|
| 0 | Wed | normal_valley | ✅ | 18 | 20–23 Uhr | 20–23 Uhr | 2p+5f | ✅ |
| 1 | Thu | negative_noon | ✅ | 18 | 22–24 Uhr | 22–24 Uhr | 2p+5f | ✅ |
| 2 | Fri | normal_valley | ✅ | 18 | 20–22 Uhr | 20–22 Uhr | 2p+5f | ✅ |
| 3 | Sat | volatile | ✅ | 18 | 15–24 Uhr | 17–20 Uhr | 1p+5f | ✅ |
| 4 | Sun | normal_valley | ✅ | 18 | 20–24 Uhr | 21–24 Uhr | 1p+5f | ✅ |
| 5 | Mon | all_high | ✅ | 18 | none | — | 1p+5f | ✅ |
| 6 | Tue | normal_valley | ✅ | 18 | 20–22 Uhr | 20–22 Uhr | 2p+5f | ✅ |

### Notifications Sent
- 19:00 "Heute: 20–23 Uhr · ≈30.7 ct"
- 11:00 "Morgen: 12–15 Uhr · ≈22.0 ct"
- 21:00 "Heute: 22–24 Uhr · ≈30.2 ct"
- 12:00 "Morgen: 13–16 Uhr · ≈27.9 ct"
- 19:00 "Heute: 20–22 Uhr · ≈30.8 ct"
- 19:00 "Morgen: 20–23 Uhr · ≈25.7 ct"
- 12:00 "Morgen: 13–16 Uhr · ≈27.8 ct"
- 20:00 "Heute: 21–24 Uhr · ≈31.1 ct"
- 12:00 "Morgen: 13–16 Uhr · ≈27.8 ct"
- 19:00 "Heute: 20–22 Uhr · ≈30.9 ct"
- 10:00 "Morgen: 11–14 Uhr · ≈28.4 ct"

---

## Lisa — Weekday Only Office
> Opens app at work Mon-Fri 9AM, ignores weekends entirely

| Setting | Value |
|---|---|
| Mode | daily_smart |
| Timing | 30 min before |
| Surcharge | 23 ct |
| App open | Mon,Tue,Wed,Thu,Fri at 9:00 |

### Daily Log
| Day | DOW | Pattern | App | Open | Window | Core | Notifs | Issues |
|-----|-----|---------|-----|------|--------|------|--------|--------|
| 0 | Wed | normal_valley | ✅ | 9 | 11–16 Uhr | 12–15 Uhr | 2p+5f | ✅ |
| 1 | Thu | normal_valley | ✅ | 9 | 11–16 Uhr | 13–16 Uhr | 2p+5f | ✅ |
| 2 | Fri | normal_valley | ✅ | 9 | 11–16 Uhr | 13–16 Uhr | 2p+5f | ✅ |
| 3 | Sat | normal_valley | — | — | 11–16 Uhr | 12–15 Uhr | 0p+0f | ✅ |
| 4 | Sun | normal_valley | — | — | 11–16 Uhr | 13–16 Uhr | 0p+0f | ✅ |
| 5 | Mon | all_high | ✅ | 9 | 0–3 Uhr | 0–3 Uhr | 0p+5f | 📱 Opened at 9:00 but cheap window already ended (0–3 Uhr) |
| 6 | Tue | flat_day | ✅ | 9 | none | — | 1p+5f | ✅ |

### Notifications Sent
- 12:00 "Heute: 12–15 Uhr · ≈25.6 ct"
- 11:00 "Morgen: 11–14 Uhr · ≈26.1 ct"
- 13:00 "Heute: 13–16 Uhr · ≈25.8 ct"
- 13:00 "Morgen: 13–16 Uhr · ≈26.2 ct"
- 13:00 "Heute: 13–16 Uhr · ≈26.1 ct"
- 12:00 "Morgen: 12–15 Uhr · ≈25.6 ct"
- 11:00 "Morgen: 11–14 Uhr · ≈25.7 ct"

---

## Thomas — Business Traveler
> Only home 3 days/week (Mon/Fri/Sat), daily_smart but rarely opens app

| Setting | Value |
|---|---|
| Mode | daily_smart |
| Timing | 30 min before |
| Surcharge | 28 ct |
| App open | Mon,Fri,Sat at 8/20:00 |

### Daily Log
| Day | DOW | Pattern | App | Open | Window | Core | Notifs | Issues |
|-----|-----|---------|-----|------|--------|------|--------|--------|
| 0 | Wed | normal_valley | — | — | 11–16 Uhr | 11–14 Uhr | 0p+0f | ✅ |
| 1 | Thu | volatile | — | — | 12–14 Uhr | 12–14 Uhr | 0p+0f | ✅ |
| 2 | Fri | negative_noon | ✅ | 8 | 11–15 Uhr | 12–15 Uhr | 2p+5f | ✅ |
| 3 | Sat | normal_valley | ✅ | 20 | 11–16 Uhr | 11–14 Uhr | 0p+5f | 📱 Opened at 20:00 but cheap window already ended (11–16 Uhr) |
| 4 | Sun | early_valley | — | — | 2–6 Uhr | 2–5 Uhr | 0p+0f | ✅ |
| 5 | Mon | normal_valley | ✅ | 20 | 11–16 Uhr | 12–15 Uhr | 0p+5f | 📱 Opened at 20:00 but cheap window already ended (11–16 Uhr) |
| 6 | Tue | flat_day | — | — | none | — | 0p+0f | ✅ |

### Notifications Sent
- 12:00 "Heute: 12–15 Uhr · ≈25.3 ct"
- 13:00 "Morgen: 13–16 Uhr · ≈30.7 ct"

---

## Sabine — Once Mode User
> Uses once-mode notification, picks 14:00 window, opens app ~2x/week

| Setting | Value |
|---|---|
| Mode | once |
| Timing | 30 min before |
| Surcharge | 23 ct |
| App open | Tue,Fri at 10/19:00 |

### Daily Log
| Day | DOW | Pattern | App | Open | Window | Core | Notifs | Issues |
|-----|-----|---------|-----|------|--------|------|--------|--------|
| 0 | Wed | normal_valley | — | — | 11–16 Uhr | 11–14 Uhr | 0p+0f | ✅ |
| 1 | Thu | normal_valley | — | — | 11–16 Uhr | 12–15 Uhr | 0p+0f | ✅ |
| 2 | Fri | flat_day | ✅ | 10 | none | — | 1p+0f | ⚠️ Once-mode fired again on day 2 — should have reset after day 0 |
| 3 | Sat | normal_valley | — | — | 11–16 Uhr | 12–15 Uhr | 0p+0f | ✅ |
| 4 | Sun | early_valley | — | — | 2–6 Uhr | 3–6 Uhr | 0p+0f | ✅ |
| 5 | Mon | normal_valley | — | — | 11–16 Uhr | 13–16 Uhr | 0p+0f | ✅ |
| 6 | Tue | volatile | ✅ | 10 | 16–18 Uhr | 16–18 Uhr | 1p+0f | ⚠️ Once-mode fired again on day 6 — should have reset after day 0 |

### Notifications Sent
- 14:00 "Einmalig: 14:00"
- 14:00 "Einmalig: 14:00"

---

## Hans — Shift Worker (Night)
> Works nights, opens app at 22:00 or 5:00, interested in early-morning cheap windows

| Setting | Value |
|---|---|
| Mode | daily_smart |
| Timing | 0 min before |
| Surcharge | 23 ct |
| App open | Sun,Mon,Tue,Wed,Thu,Fri,Sat at 5/22:00 |

### Daily Log
| Day | DOW | Pattern | App | Open | Window | Core | Notifs | Issues |
|-----|-----|---------|-----|------|--------|------|--------|--------|
| 0 | Wed | early_valley | ✅ | 5 | 21–23 Uhr | 21–23 Uhr | 1p+5f | ✅ |
| 1 | Thu | early_valley | ✅ | 22 | 2–6 Uhr | 3–6 Uhr | 1p+5f | 📱 Opened at 22:00 but cheap window already ended (2–6 Uhr) |
| 2 | Fri | normal_valley | ✅ | 5 | 11–16 Uhr | 13–16 Uhr | 1p+5f | ✅ |
| 3 | Sat | early_valley | ✅ | 22 | 2–6 Uhr | 2–5 Uhr | 0p+5f | 📱 Opened at 22:00 but cheap window already ended (2–6 Uhr) |
| 4 | Sun | flat_day | ✅ | 5 | none | — | 0p+5f | ✅ |
| 5 | Mon | early_valley | ✅ | 22 | 2–6 Uhr | 2–5 Uhr | 1p+5f | 📱 Opened at 22:00 but cheap window already ended (2–6 Uhr) |
| 6 | Tue | volatile | ✅ | 5 | 5–8 Uhr | 5–8 Uhr | 0p+5f | ✅ |

### Notifications Sent
- 21:00 "Heute: 21–23 Uhr · ≈29.2 ct"
- 12:00 "Morgen: 12–15 Uhr · ≈25.2 ct"
- 13:00 "Heute: 13–16 Uhr · ≈25.7 ct"
- 10:00 "Morgen: 10–12 Uhr · ≈19.6 ct"

---

## EDGE — Negative Prices Week
> Entire week has negative noon prices, tests classification + notification

| Setting | Value |
|---|---|
| Mode | daily_smart |
| Timing | 30 min before |
| Surcharge | 20 ct |
| App open | Sun,Mon,Tue,Wed,Thu,Fri,Sat at 8:00 |

### Daily Log
| Day | DOW | Pattern | App | Open | Window | Core | Notifs | Issues |
|-----|-----|---------|-----|------|--------|------|--------|--------|
| 0 | Wed | negative_noon | ✅ | 8 | 11–15 Uhr | 11–14 Uhr | 2p+5f | ✅ |
| 1 | Thu | negative_noon | ✅ | 8 | 11–15 Uhr | 11–14 Uhr | 2p+5f | ✅ |
| 2 | Fri | negative_noon | ✅ | 8 | 11–15 Uhr | 12–15 Uhr | 2p+5f | ✅ |
| 3 | Sat | negative_noon | ✅ | 8 | 11–15 Uhr | 11–14 Uhr | 2p+5f | ✅ |
| 4 | Sun | negative_noon | ✅ | 8 | 11–15 Uhr | 11–14 Uhr | 2p+5f | ✅ |
| 5 | Mon | negative_noon | ✅ | 8 | 11–15 Uhr | 11–14 Uhr | 2p+5f | ✅ |
| 6 | Tue | negative_noon | ✅ | 8 | 11–15 Uhr | 11–14 Uhr | 2p+5f | ✅ |

### Notifications Sent
- 11:00 "Heute: 11–14 Uhr · ≈16.2 ct"
- 12:00 "Morgen: 12–15 Uhr · ≈15.6 ct"
- 11:00 "Heute: 11–14 Uhr · ≈17.0 ct"
- 12:00 "Morgen: 12–15 Uhr · ≈15.4 ct"
- 12:00 "Heute: 12–15 Uhr · ≈16.2 ct"
- 11:00 "Morgen: 11–14 Uhr · ≈15.8 ct"
- 11:00 "Heute: 11–14 Uhr · ≈16.0 ct"
- 11:00 "Morgen: 11–14 Uhr · ≈16.5 ct"
- 11:00 "Heute: 11–14 Uhr · ≈16.3 ct"
- 11:00 "Morgen: 11–14 Uhr · ≈16.0 ct"
- 11:00 "Heute: 11–14 Uhr · ≈16.4 ct"
- 12:00 "Morgen: 12–15 Uhr · ≈16.7 ct"
- 11:00 "Heute: 11–14 Uhr · ≈17.0 ct"
- 12:00 "Morgen: 12–15 Uhr · ≈16.5 ct"

---

## EDGE — All High Prices
> No cheap window exists most days, tests "no window found" UX

| Setting | Value |
|---|---|
| Mode | daily_smart |
| Timing | 30 min before |
| Surcharge | 30 ct |
| App open | Sun,Mon,Tue,Wed,Thu,Fri,Sat at 9:00 |

### Daily Log
| Day | DOW | Pattern | App | Open | Window | Core | Notifs | Issues |
|-----|-----|---------|-----|------|--------|------|--------|--------|
| 0 | Wed | all_high | ✅ | 9 | none | — | 0p+5f | ✅ |
| 1 | Thu | all_high | ✅ | 9 | 10–13 Uhr | 10–13 Uhr | 1p+5f | ✅ |
| 2 | Fri | all_high | ✅ | 9 | 14–16 Uhr | 14–16 Uhr | 1p+5f | ✅ |
| 3 | Sat | flat_day | ✅ | 9 | none | — | 0p+5f | ✅ |
| 4 | Sun | all_high | ✅ | 9 | 13–17 Uhr | 13–16 Uhr | 2p+5f | ✅ |
| 5 | Mon | all_high | ✅ | 9 | 10–13 Uhr | 10–13 Uhr | 2p+5f | ✅ |
| 6 | Tue | all_high | ✅ | 9 | 15–17 Uhr | 15–17 Uhr | 2p+5f | ✅ |

### Notifications Sent
- 10:00 "Heute: 10–13 Uhr · ≈43.3 ct"
- 14:00 "Heute: 14–16 Uhr · ≈42.4 ct"
- 13:00 "Heute: 13–16 Uhr · ≈42.8 ct"
- 15:00 "Morgen: 15–17 Uhr · ≈42.6 ct"
- 10:00 "Heute: 10–13 Uhr · ≈42.7 ct"
- 12:00 "Morgen: 12–14 Uhr · ≈42.4 ct"
- 15:00 "Heute: 15–17 Uhr · ≈42.9 ct"
- 13:00 "Morgen: 13–15 Uhr · ≈42.7 ct"

---

## EDGE — App Never Opened After Setup
> Sets up daily_smart, then never opens app again for 7 days

| Setting | Value |
|---|---|
| Mode | daily_smart |
| Timing | 30 min before |
| Surcharge | 23 ct |
| App open |  at 9:00 |

### Daily Log
| Day | DOW | Pattern | App | Open | Window | Core | Notifs | Issues |
|-----|-----|---------|-----|------|--------|------|--------|--------|
| 0 | Wed | normal_valley | — | — | 11–16 Uhr | 11–14 Uhr | 0p+0f | ✅ |
| 1 | Thu | normal_valley | — | — | 11–16 Uhr | 11–14 Uhr | 0p+0f | ✅ |
| 2 | Fri | normal_valley | — | — | 11–16 Uhr | 13–16 Uhr | 0p+0f | ✅ |
| 3 | Sat | normal_valley | — | — | 11–16 Uhr | 11–14 Uhr | 0p+0f | ✅ |
| 4 | Sun | normal_valley | — | — | 11–16 Uhr | 11–14 Uhr | 0p+0f | ✅ |
| 5 | Mon | normal_valley | — | — | 11–16 Uhr | 13–16 Uhr | 0p+0f | ✅ |
| 6 | Tue | normal_valley | — | — | 11–16 Uhr | 13–16 Uhr | 0p+0f | ✅ |

### Global Issues
- 📱 User never opens app — only fallback notifications work
- 🔴 No fallback scheduled either — user gets 0 notifications!

---

## EDGE — Flat Price Day
> Spread < 1ct, tests spreadRatio dampening + classification edge

| Setting | Value |
|---|---|
| Mode | daily_smart |
| Timing | 30 min before |
| Surcharge | 23 ct |
| App open | Sun,Mon,Tue,Wed,Thu,Fri,Sat at 8:00 |

### Daily Log
| Day | DOW | Pattern | App | Open | Window | Core | Notifs | Issues |
|-----|-----|---------|-----|------|--------|------|--------|--------|
| 0 | Wed | flat_day | ✅ | 8 | none | — | 0p+5f | ✅ |
| 1 | Thu | flat_day | ✅ | 8 | none | — | 0p+5f | ✅ |
| 2 | Fri | flat_day | ✅ | 8 | none | — | 0p+5f | ✅ |
| 3 | Sat | flat_day | ✅ | 8 | none | — | 0p+5f | ✅ |
| 4 | Sun | flat_day | ✅ | 8 | none | — | 0p+5f | ✅ |
| 5 | Mon | flat_day | ✅ | 8 | none | — | 0p+5f | ✅ |
| 6 | Tue | flat_day | ✅ | 8 | none | — | 0p+5f | ✅ |

### Global Issues
- ⚠️ SILENT: daily_smart enabled but 0 precise notifications in 7 days
- ⚠️ 7/7 days had no cheap window
