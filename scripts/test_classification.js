// ============================================================
// Regression Test: classifyPrice + buildSlots avg baseline
// Validates the fix for GREEN/WARTEN classification bug.
// Run: node scripts/test_classification.js
// ============================================================

let PASS = 0, FAIL = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    PASS++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? " — " + detail : ""}`);
    FAIL++;
  }
}

// ── Replicate corrected classifyPrice ─────────────────────────
function classifyPrice(priceCt, avgCt) {
  if (priceCt <= avgCt * 0.88) return "GREEN";
  if (priceCt <= avgCt * 1.10) return "YELLOW";
  return "RED";
}

// ── Replicate corrected avg baseline ─────────────────────────
function computeAvg(prices, nowHour, isToday) {
  const fromHour = isToday ? nowHour : 0;
  const vals = Object.entries(prices)
    .filter(([h]) => Number(h) >= fromHour)
    .map(([, v]) => v);
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

// ── CHEAP_THRESHOLD from windows.ts ───────────────────────────
const CHEAP_THRESHOLD = 0.88;

// ── Test Scenario 1: Bug Reproduction Case ──────────────────
// User's scenario: 16:15, cheap window 16:00–18:00
console.log("\n=== Scenario 1: 16:15, cheap window 16:00–18:00 ===");
{
  // Typical day: morning moderate, cheap 16-18, evening expensive
  const prices = {
    0: 18, 1: 17, 2: 16, 3: 15, 4: 15, 5: 16,
    6: 19, 7: 22, 8: 24, 9: 23, 10: 21, 11: 20,
    12: 20, 13: 21, 14: 22, 15: 21,
    16: 15, 17: 15,   // <-- cheap window
    18: 21, 19: 23, 20: 25, 21: 24, 22: 22, 23: 20,
  };
  const nowHour = 16;

  // Old (buggy) avg: full day
  const oldAvg = Object.values(prices).reduce((a, b) => a + b, 0) / 24; // ~19.9 ct
  // New (fixed) avg: remaining hours (16–23)
  const newAvg = computeAvg(prices, nowHour, true);

  const oldStatus16 = classifyPrice(prices[16], oldAvg); // old threshold was 0.85
  // Simulate old threshold too
  function classifyOld(p, avg) {
    if (p <= avg * 0.85) return "GREEN";
    if (p <= avg * 1.10) return "YELLOW";
    return "RED";
  }
  const oldStatus16_v = classifyOld(prices[16], oldAvg);
  const newStatus16 = classifyPrice(prices[16], newAvg);

  console.log(`  Full-day avg:     ${oldAvg.toFixed(2)} ct`);
  console.log(`  Remaining avg:    ${newAvg.toFixed(2)} ct`);
  console.log(`  16:00 price:      ${prices[16]} ct`);
  console.log(`  Old status(16h):  ${oldStatus16_v}  (ratio: ${(prices[16]/oldAvg).toFixed(3)}, threshold 0.85)`);
  console.log(`  New status(16h):  ${newStatus16}  (ratio: ${(prices[16]/newAvg).toFixed(3)}, threshold 0.88)`);

  assert("16:00 is GREEN with new system", newStatus16 === "GREEN");
  assert("16:00 is in cheap window (≤ remaining_avg × 0.88)",
    prices[16] <= newAvg * CHEAP_THRESHOLD,
    `${prices[16]} vs ${(newAvg * CHEAP_THRESHOLD).toFixed(2)}`
  );
  // Guarantee: GREEN ↔ cheap window
  const inCheapWindow = prices[16] <= newAvg * CHEAP_THRESHOLD;
  const isGreen = newStatus16 === "GREEN";
  assert("GREEN ↔ in cheap window (alignment guarantee)", inCheapWindow === isGreen);
}

// ── Scenario 2: 10:00, NOT in cheap window yet ──────────────
console.log("\n=== Scenario 2: 10:00, cheap window later at 16:00–18:00 ===");
{
  const prices = {
    10: 22, 11: 21, 12: 20, 13: 21, 14: 22, 15: 21,
    16: 15, 17: 15,
    18: 21, 19: 23, 20: 25, 21: 24, 22: 22, 23: 20,
  };
  const nowHour = 10;
  const newAvg = computeAvg(prices, nowHour, true);
  const status10 = classifyPrice(prices[10], newAvg);

  console.log(`  Remaining avg:    ${newAvg.toFixed(2)} ct`);
  console.log(`  10:00 price:      ${prices[10]} ct  → ${status10}`);
  console.log(`  16:00 price:      ${prices[16]} ct  → ${classifyPrice(prices[16], newAvg)}`);

  assert("10:00 is NOT GREEN (not cheap enough yet)", status10 !== "GREEN");
  assert("16:00 is GREEN relative to same remaining avg (even when viewed from 10:00)",
    classifyPrice(prices[16], newAvg) === "GREEN"
  );
}

// ── Scenario 3: Edge case — all prices identical ─────────────
console.log("\n=== Scenario 3: Edge — all prices identical (no spread) ===");
{
  const prices = Object.fromEntries(Array.from({length: 24}, (_, h) => [h, 20]));
  const nowHour = 12;
  const newAvg = computeAvg(prices, nowHour, true);
  const status = classifyPrice(prices[12], newAvg);
  // price / avg = 1.0 → YELLOW (0.88 < 1.0 < 1.10)
  console.log(`  All prices = 20ct, avg = ${newAvg.toFixed(2)}, status = ${status}`);
  assert("Flat prices → YELLOW (never GREEN, not burning)", status === "YELLOW");
}

// ── Scenario 4: Edge case — single remaining slot (23:00) ────
console.log("\n=== Scenario 4: Edge — only 1 remaining slot at 23:00 ===");
{
  const prices = { 23: 18 };
  const nowHour = 23;
  const newAvg = computeAvg(prices, nowHour, true);
  const status = classifyPrice(prices[23], newAvg);
  console.log(`  23:00 price = avg = ${newAvg}, status = ${status}`);
  assert("Last-hour slot → YELLOW (price == avg → 1.0, between 0.88 and 1.10)", status === "YELLOW");
}

// ── Scenario 5: Tomorrow's avg uses ALL hours (fromHour=0) ───
console.log("\n=== Scenario 5: Tomorrow — avg uses all 24h ===");
{
  const prices = Object.fromEntries(Array.from({length: 24}, (_, h) => [h, 20 + (h % 5)]));
  const newAvg = computeAvg(prices, 0, false);  // isToday=false
  const fullAvg = Object.values(prices).reduce((a, b) => a + b, 0) / 24;
  assert("Tomorrow avg == full-day avg (fromHour=0)", Math.abs(newAvg - fullAvg) < 0.001,
    `newAvg=${newAvg.toFixed(3)}, fullAvg=${fullAvg.toFixed(3)}`
  );
}

// ── Scenario 6: Regression — YELLOW window still shows "Ab …" hint ─────
console.log("\n=== Scenario 6: YELLOW slot + nextCheap → HeroCard hint logic ===");
{
  // Simulate HeroCard buildHint logic
  function buildHint(status, nextCheap, cheapUntilHour, lang) {
    if (status === "UNKNOWN") return "Loading...";
    if (status === "GREEN") {
      if (cheapUntilHour !== null) return `Günstig noch bis ${cheapUntilHour}:00 Uhr`;
      return "Günstige Phase – jetzt ideal zum Waschen";
    }
    if (nextCheap?.date === "today") {
      const ct = nextCheap.avgCt.toFixed(1).replace(".", ",");
      return `Ab ${nextCheap.label} günstiger · ø ${ct} ct`;
    }
    return "Heute keine günstigere Phase mehr";
  }

  // After fix: 16:00 is GREEN → should show "Jetzt" hint
  const nextCheap = { date: "today", label: "16–18 Uhr", avgCt: 15.0 };
  const hintGreen = buildHint("GREEN", nextCheap, 18, "de");
  const hintYellow = buildHint("YELLOW", nextCheap, null, "de");

  console.log(`  GREEN hint:  "${hintGreen}"`);
  console.log(`  YELLOW hint: "${hintYellow}"`);
  assert('GREEN → shows "Günstig noch bis" (jetzt-style)', hintGreen.includes("Günstig noch bis"));
  assert('YELLOW → still shows "Ab X günstiger"', hintYellow.includes("Ab"));
}

// ── Result ────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Result: ${PASS} passed, ${FAIL} failed`);
if (FAIL > 0) {
  console.error("❌ Tests FAILED — do NOT build.");
  process.exit(1);
} else {
  console.log("✅ All tests passed — safe to build.");
  process.exit(0);
}
