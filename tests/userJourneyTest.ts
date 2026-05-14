// StromAmpel — User Journey Simulation
// Tests natural usage patterns across diverse user personas.
// Run: npx tsx tests/userJourneyTest.ts

import * as fs from 'fs';

// ── Inline core logic (avoids React Native imports) ─────────────────────────

type Status = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
interface HourSlot { hour: number; priceCt: number | null; status: Status; isPast: boolean; isCurrentHour: boolean; }
interface CheapWindow { startHour: number; endHour: number; label: string; avgCt: number; date: 'today'|'tomorrow'; coreLabel: string; coreAvgCt: number; coreStartHour: number; }
interface DayData { slots: HourSlot[]; cheapestWindow: CheapWindow|null; nextCheapWindow: CheapWindow|null; }
type NotifyMode = 'once' | 'daily_smart';
type Timing = 0 | 30 | 60;

const CHEAP_THRESHOLD = 0.12;
const CHEAP_MIN_HOURS = 2;
const CORE_BLOCK_HOURS = 3;

function classifyPrice(p: number, avg: number): Status {
  const abs = Math.max(Math.abs(avg), 0.5);
  if (p <= avg - abs * 0.12) return 'GREEN';
  if (p <= avg + abs * 0.10) return 'YELLOW';
  return 'RED';
}

function findBestCoreBlock(slots: HourSlot[]): { startHour: number; endHour: number; avgCt: number } | null {
  if (slots.length === 0) return null;
  const k = Math.min(CORE_BLOCK_HOURS, slots.length);
  let bestAvg = Infinity, bestStart = 0;
  for (let i = 0; i <= slots.length - k; i++) {
    const avg = slots.slice(i, i+k).reduce((s,x) => s+(x.priceCt??0), 0) / k;
    if (avg < bestAvg) { bestAvg = avg; bestStart = i; }
  }
  return { startHour: slots[bestStart].hour, endHour: slots[bestStart+k-1].hour+1, avgCt: Math.round(bestAvg*10)/10 };
}

function findNextCheapWindow(slots: HourSlot[], fromHour: number, date: 'today'|'tomorrow'): CheapWindow|null {
  const future = slots.filter(s => s.hour >= fromHour && s.priceCt !== null);
  if (future.length === 0) return null;
  const avg = future.reduce((s,x) => s+(x.priceCt??0), 0) / future.length;
  const ceil = avg - Math.abs(avg) * CHEAP_THRESHOLD;
  let best: CheapWindow|null = null;
  let i = 0;
  while (i < future.length) {
    if ((future[i].priceCt??Infinity) <= ceil) {
      let j = i, sum = 0;
      while (j < future.length && (future[j].priceCt??Infinity) <= ceil) { sum += future[j].priceCt??0; j++; }
      if (j-i >= CHEAP_MIN_HOURS) {
        const ws = future.slice(i, j);
        const core = findBestCoreBlock(ws);
        const c: CheapWindow = {
          startHour: future[i].hour, endHour: future[j-1].hour+1,
          label: `${future[i].hour}–${future[j-1].hour+1} Uhr`,
          avgCt: Math.round((sum/(j-i))*10)/10, date,
          coreLabel: core ? `${core.startHour}–${core.endHour} Uhr` : '',
          coreAvgCt: core?.avgCt ?? 0,
          coreStartHour: core?.startHour ?? future[i].hour,
        };
        if (!best || c.coreAvgCt < best.coreAvgCt) best = c;
        i = j; continue;
      }
    }
    i++;
  }
  return best;
}

// ── Price Pattern Generator ─────────────────────────────────────────────────

type PricePattern = 'normal_valley' | 'flat_day' | 'negative_noon' | 'volatile' | 'all_high' | 'early_valley';

function generatePrices(pattern: PricePattern): number[] {
  const h24 = Array.from({length:24}, (_,i) => i);
  switch (pattern) {
    case 'normal_valley':
      // Typical: expensive morning, cheap 11-16, expensive evening
      return h24.map(h => {
        if (h >= 0 && h < 6) return 4 + Math.random()*2;
        if (h >= 6 && h < 9) return 8 + Math.random()*3;
        if (h >= 9 && h < 11) return 6 + Math.random()*2;
        if (h >= 11 && h < 16) return 2 + Math.random()*2; // cheap
        if (h >= 16 && h < 20) return 9 + Math.random()*4;
        return 5 + Math.random()*2;
      });
    case 'flat_day':
      return h24.map(() => 5 + Math.random()*0.5);
    case 'negative_noon':
      return h24.map(h => {
        if (h >= 11 && h < 15) return -2 - Math.random()*3; // negative!
        if (h >= 6 && h < 11) return 3 + Math.random()*2;
        return 5 + Math.random()*3;
      });
    case 'volatile':
      return h24.map(() => -5 + Math.random()*20);
    case 'all_high':
      return h24.map(h => 12 + Math.random()*5 + (h >= 17 && h < 20 ? 5 : 0));
    case 'early_valley':
      return h24.map(h => {
        if (h >= 2 && h < 6) return 1 + Math.random()*1.5;
        return 6 + Math.random()*4;
      });
  }
}

function buildSlots(prices: number[], nowHour: number, isToday: boolean): HourSlot[] {
  const fromH = isToday ? nowHour : 0;
  const future = prices.filter((_,i) => i >= fromH);
  const avg = future.length > 0 ? future.reduce((a,b) => a+b,0)/future.length : 0;
  return prices.map((p,h) => ({
    hour: h, priceCt: Math.round(p*10)/10,
    status: classifyPrice(p, avg),
    isPast: isToday && h < nowHour, isCurrentHour: isToday && h === nowHour,
  }));
}

// ── Notification Simulation ─────────────────────────────────────────────────

interface NotifEvent { day: number; hour: number; mode: NotifyMode; title: string; isFallback: boolean; }

function simulateNotification(
  todaySlots: HourSlot[], tomorrowSlots: HourSlot[]|null,
  nowHour: number, mode: NotifyMode, timing: Timing,
  surchargeCt: number, userPickedHour?: number,
): NotifEvent[] {
  const events: NotifEvent[] = [];
  const todayData = { slots: todaySlots, cheapestWindow: findNextCheapWindow(todaySlots, 0, 'today'), nextCheapWindow: findNextCheapWindow(todaySlots, nowHour, 'today') };
  const tomorrowData = tomorrowSlots ? { slots: tomorrowSlots, cheapestWindow: findNextCheapWindow(tomorrowSlots, 0, 'tomorrow'), nextCheapWindow: null } : null;

  if (mode === 'daily_smart') {
    const todayCore = todayData.nextCheapWindow ?? todayData.cheapestWindow;
    if (todayCore && todayCore.coreStartHour > nowHour) {
      const fireH = todayCore.coreStartHour - timing/60;
      const effCt = todayCore.coreAvgCt + surchargeCt;
      if (fireH >= 7 && fireH < 22) {
        events.push({ day: 0, hour: Math.round(fireH), mode, title: `Heute: ${todayCore.coreLabel} · ≈${effCt.toFixed(1)} ct`, isFallback: false });
      }
    }
    if (tomorrowData?.cheapestWindow) {
      const tw = tomorrowData.cheapestWindow;
      const fireH = tw.coreStartHour - timing/60;
      const effCt = tw.coreAvgCt + surchargeCt;
      if (fireH >= 7 && fireH < 22) {
        events.push({ day: 0, hour: Math.round(fireH), mode, title: `Morgen: ${tw.coreLabel} · ≈${effCt.toFixed(1)} ct`, isFallback: false });
      }
    }
    // Fallback runway
    for (let d = 2; d <= 6; d++) {
      events.push({ day: d, hour: 7, mode, title: 'Strompreise abrufen', isFallback: true });
    }
  } else if (mode === 'once' && userPickedHour !== undefined) {
    const fireH = userPickedHour - timing/60;
    if (fireH >= 7 && fireH < 22 && fireH > nowHour) {
      events.push({ day: 0, hour: Math.round(fireH), mode, title: `Einmalig: ${userPickedHour}:00`, isFallback: false });
    }
  }
  return events;
}

// ── Persona Definitions ─────────────────────────────────────────────────────

interface Persona {
  name: string; desc: string;
  notifyMode: NotifyMode; timing: Timing; surchargeCt: number;
  appOpenHours: number[]; // hours of day when user typically opens app
  appOpenDays: number[];  // days of week (0=Sun)
  pricePatterns: PricePattern[]; // 7-day pattern sequence
  actions?: Record<number, string[]>; // day → special actions
  userPickedHour?: number; // for once mode
}

const PERSONAS: Persona[] = [
  // GROUP A: Normal daily users
  {
    name: 'Maria — Morning Checker',
    desc: 'Opens app at 7AM daily, daily_smart mode, wants to know when to run dishwasher/washing machine',
    notifyMode: 'daily_smart', timing: 30, surchargeCt: 23,
    appOpenHours: [7], appOpenDays: [0,1,2,3,4,5,6],
    pricePatterns: ['normal_valley','normal_valley','flat_day','normal_valley','volatile','normal_valley','early_valley'],
  },
  {
    name: 'Peter — Evening Planner',
    desc: 'Opens app around 18:00 to plan tomorrow, daily_smart, checks EV charging window',
    notifyMode: 'daily_smart', timing: 60, surchargeCt: 25,
    appOpenHours: [18], appOpenDays: [0,1,2,3,4,5,6],
    pricePatterns: ['normal_valley','negative_noon','normal_valley','volatile','normal_valley','all_high','normal_valley'],
  },
  {
    name: 'Lisa — Weekday Only Office',
    desc: 'Opens app at work Mon-Fri 9AM, ignores weekends entirely',
    notifyMode: 'daily_smart', timing: 30, surchargeCt: 23,
    appOpenHours: [9], appOpenDays: [1,2,3,4,5],
    pricePatterns: ['normal_valley','normal_valley','normal_valley','normal_valley','normal_valley','all_high','flat_day'],
  },
  // GROUP B: Non-standard usage
  {
    name: 'Thomas — Business Traveler',
    desc: 'Only home 3 days/week (Mon/Fri/Sat), daily_smart but rarely opens app',
    notifyMode: 'daily_smart', timing: 30, surchargeCt: 28,
    appOpenHours: [8, 20], appOpenDays: [1, 5, 6],
    pricePatterns: ['normal_valley','volatile','negative_noon','normal_valley','early_valley','normal_valley','flat_day'],
  },
  {
    name: 'Sabine — Once Mode User',
    desc: 'Uses once-mode notification, picks 14:00 window, opens app ~2x/week',
    notifyMode: 'once', timing: 30, surchargeCt: 23, userPickedHour: 14,
    appOpenHours: [10, 19], appOpenDays: [2, 5],
    pricePatterns: ['normal_valley','normal_valley','flat_day','normal_valley','early_valley','normal_valley','volatile'],
  },
  {
    name: 'Hans — Shift Worker (Night)',
    desc: 'Works nights, opens app at 22:00 or 5:00, interested in early-morning cheap windows',
    notifyMode: 'daily_smart', timing: 0, surchargeCt: 23,
    appOpenHours: [5, 22], appOpenDays: [0,1,2,3,4,5,6],
    pricePatterns: ['early_valley','early_valley','normal_valley','early_valley','flat_day','early_valley','volatile'],
  },
  // GROUP C: Edge cases
  {
    name: 'EDGE — Negative Prices Week',
    desc: 'Entire week has negative noon prices, tests classification + notification',
    notifyMode: 'daily_smart', timing: 30, surchargeCt: 20,
    appOpenHours: [8], appOpenDays: [0,1,2,3,4,5,6],
    pricePatterns: ['negative_noon','negative_noon','negative_noon','negative_noon','negative_noon','negative_noon','negative_noon'],
  },
  {
    name: 'EDGE — All High Prices',
    desc: 'No cheap window exists most days, tests "no window found" UX',
    notifyMode: 'daily_smart', timing: 30, surchargeCt: 30,
    appOpenHours: [9], appOpenDays: [0,1,2,3,4,5,6],
    pricePatterns: ['all_high','all_high','all_high','flat_day','all_high','all_high','all_high'],
  },
  {
    name: 'EDGE — App Never Opened After Setup',
    desc: 'Sets up daily_smart, then never opens app again for 7 days',
    notifyMode: 'daily_smart', timing: 30, surchargeCt: 23,
    appOpenHours: [9], appOpenDays: [], // never opens
    pricePatterns: ['normal_valley','normal_valley','normal_valley','normal_valley','normal_valley','normal_valley','normal_valley'],
  },
  {
    name: 'EDGE — Flat Price Day',
    desc: 'Spread < 1ct, tests spreadRatio dampening + classification edge',
    notifyMode: 'daily_smart', timing: 30, surchargeCt: 23,
    appOpenHours: [8], appOpenDays: [0,1,2,3,4,5,6],
    pricePatterns: ['flat_day','flat_day','flat_day','flat_day','flat_day','flat_day','flat_day'],
  },
];

// ── Simulation ──────────────────────────────────────────────────────────────

const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS = 7;

interface DayLog {
  day: number; dow: string; pattern: string;
  appOpened: boolean; openHour: number|null;
  cheapWindow: string|null; coreWindow: string|null; coreStartH: number|null;
  currentStatus: string|null; currentPrice: number|null;
  notifsScheduled: number; notifsPrecise: number; notifsFallback: number;
  notifDetails: string[];
  issues: string[];
}

function simulate(p: Persona): { logs: DayLog[]; globalIssues: string[] } {
  const logs: DayLog[] = [];
  const globalIssues: string[] = [];
  let totalPrecise = 0, totalFallback = 0, noWindowDays = 0;
  let notifContentSet = new Set<string>();

  for (let d = 0; d < DAYS; d++) {
    const startDow = 3; // start on Wednesday
    const dow = (startDow + d) % 7;
    const pattern = p.pricePatterns[d % p.pricePatterns.length];
    const prices = generatePrices(pattern as PricePattern);
    const tomorrowPrices = generatePrices(p.pricePatterns[(d+1) % p.pricePatterns.length] as PricePattern);

    const appOpened = p.appOpenDays.includes(dow);
    const openHour = appOpened ? p.appOpenHours[d % p.appOpenHours.length] : null;
    const issues: string[] = [];

    // Build slots
    const nowH = openHour ?? 10;
    const todaySlots = buildSlots(prices, nowH, true);
    const tomorrowSlots = buildSlots(tomorrowPrices, 0, false);

    // Current price
    const currentSlot = todaySlots.find(s => s.hour === nowH);
    const currentStatus = currentSlot?.status ?? null;
    const currentPrice = currentSlot?.priceCt ?? null;

    // Cheap windows
    const cheapW = findNextCheapWindow(todaySlots, 0, 'today');
    const nextW = findNextCheapWindow(todaySlots, nowH, 'today');
    const effectiveW = nextW ?? cheapW;

    if (!effectiveW && pattern !== 'all_high' && pattern !== 'flat_day') {
      issues.push('⚠️ No cheap window found on non-flat/non-high day');
    }
    if (!effectiveW) noWindowDays++;

    // Notification simulation
    let notifs: NotifEvent[] = [];
    if (appOpened) {
      notifs = simulateNotification(todaySlots, tomorrowSlots, nowH, p.notifyMode, p.timing, p.surchargeCt, p.userPickedHour);
    }
    const precise = notifs.filter(n => !n.isFallback);
    const fallback = notifs.filter(n => n.isFallback);
    totalPrecise += precise.length;
    totalFallback += fallback.length;

    // Check notification timing vs quiet hours
    for (const n of precise) {
      if (n.hour < 7 || n.hour >= 22) issues.push(`🔇 Notification at ${n.hour}:00 — outside quiet hours!`);
      notifContentSet.add(n.title);
    }

    // Check: user opens at 18:00 but cheap window was 11-16 → missed!
    if (appOpened && openHour && effectiveW && effectiveW.endHour <= openHour) {
      issues.push(`📱 Opened at ${openHour}:00 but cheap window already ended (${effectiveW.label})`);
    }

    // Check: coreStartHour vs startHour consistency
    if (effectiveW && effectiveW.coreStartHour < effectiveW.startHour) {
      issues.push(`🐛 coreStartHour (${effectiveW.coreStartHour}) < startHour (${effectiveW.startHour}) — impossible!`);
    }

    // Check: once-mode — notification only fires once, should reset
    if (p.notifyMode === 'once' && d > 0 && precise.length > 0) {
      issues.push(`⚠️ Once-mode fired again on day ${d} — should have reset after day 0`);
    }

    // Negative price classification
    if (pattern === 'negative_noon') {
      const negSlots = todaySlots.filter(s => (s.priceCt??0) < 0);
      const nonGreen = negSlots.filter(s => s.status !== 'GREEN');
      if (nonGreen.length > 0) {
        issues.push(`🔴 ${nonGreen.length} negative-price slots NOT classified GREEN (neg-avg bug?)`);
      }
    }

    // Flat day: all slots should be similar status
    if (pattern === 'flat_day') {
      const statuses = todaySlots.filter(s => !s.isPast).map(s => s.status);
      const unique = new Set(statuses);
      if (unique.size > 2) {
        issues.push(`⚠️ Flat day has ${unique.size} different statuses — spread dampening issue?`);
      }
    }

    logs.push({
      day: d, dow: DOW[dow], pattern,
      appOpened, openHour,
      cheapWindow: effectiveW?.label ?? null,
      coreWindow: effectiveW?.coreLabel ?? null,
      coreStartH: effectiveW?.coreStartHour ?? null,
      currentStatus: currentStatus ?? null,
      currentPrice,
      notifsScheduled: notifs.length, notifsPrecise: precise.length, notifsFallback: fallback.length,
      notifDetails: precise.map(n => `${n.hour}:00 "${n.title}"`),
      issues,
    });
  }

  // Global checks
  if (totalPrecise === 0 && p.notifyMode === 'daily_smart' && p.appOpenDays.length > 0) {
    globalIssues.push('⚠️ SILENT: daily_smart enabled but 0 precise notifications in 7 days');
  }
  if (noWindowDays >= 5) globalIssues.push(`⚠️ ${noWindowDays}/7 days had no cheap window`);
  if (p.appOpenDays.length === 0) {
    globalIssues.push('📱 User never opens app — only fallback notifications work');
    if (totalFallback === 0) globalIssues.push('🔴 No fallback scheduled either — user gets 0 notifications!');
  }

  return { logs, globalIssues };
}

// ── Report ──────────────────────────────────────────────────────────────────

function generateReport(): string {
  const lines: string[] = [];
  lines.push('# StromAmpel — User Journey Test Report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Period: ${DAYS} days × ${PERSONAS.length} personas\n`);

  // Executive summary
  const summaryRows: string[][] = [['Persona','Mode','App Days','Precise','Fallback','No Window','Issues']];

  for (const p of PERSONAS) {
    const { logs, globalIssues } = simulate(p);
    const totalPrecise = logs.reduce((s,l) => s+l.notifsPrecise, 0);
    const totalFallback = logs.reduce((s,l) => s+l.notifsFallback, 0);
    const noWindow = logs.filter(l => !l.cheapWindow).length;
    const allIssues = [...globalIssues, ...logs.flatMap(l => l.issues)];

    summaryRows.push([
      p.name.split('—')[0].trim(), p.notifyMode,
      `${p.appOpenDays.length}/7`, `${totalPrecise}`, `${totalFallback}`,
      `${noWindow}`, allIssues.length > 0 ? `${allIssues.length}⚠️` : '✅',
    ]);

    lines.push(`---\n\n## ${p.name}`);
    lines.push(`> ${p.desc}\n`);
    lines.push(`| Setting | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| Mode | ${p.notifyMode} |`);
    lines.push(`| Timing | ${p.timing} min before |`);
    lines.push(`| Surcharge | ${p.surchargeCt} ct |`);
    lines.push(`| App open | ${p.appOpenDays.map(d=>DOW[d]).join(',')} at ${p.appOpenHours.join('/')}:00 |\n`);

    lines.push('### Daily Log');
    lines.push('| Day | DOW | Pattern | App | Open | Window | Core | Notifs | Issues |');
    lines.push('|-----|-----|---------|-----|------|--------|------|--------|--------|');
    for (const l of logs) {
      lines.push(`| ${l.day} | ${l.dow} | ${l.pattern} | ${l.appOpened?'✅':'—'} | ${l.openHour??'—'} | ${l.cheapWindow??'none'} | ${l.coreWindow??'—'} | ${l.notifsPrecise}p+${l.notifsFallback}f | ${l.issues.length>0?l.issues.join('; '):'✅'} |`);
    }

    if (globalIssues.length > 0) {
      lines.push('\n### Global Issues');
      globalIssues.forEach(i => lines.push(`- ${i}`));
    }

    // Notification details
    const allNotifs = logs.flatMap(l => l.notifDetails);
    if (allNotifs.length > 0) {
      lines.push('\n### Notifications Sent');
      allNotifs.forEach(n => lines.push(`- ${n}`));
    }
    lines.push('');
  }

  // Build summary table
  const execLines = ['# Executive Summary\n'];
  execLines.push('| ' + summaryRows[0].join(' | ') + ' |');
  execLines.push('|' + summaryRows[0].map(() => '---').join('|') + '|');
  for (let i = 1; i < summaryRows.length; i++) {
    execLines.push('| ' + summaryRows[i].join(' | ') + ' |');
  }

  return execLines.join('\n') + '\n\n' + lines.join('\n');
}

const report = generateReport();
fs.mkdirSync('tests', { recursive: true });
fs.writeFileSync('tests/journey_report.md', report, 'utf-8');
console.log(`✅ Report: tests/journey_report.md (${report.length} chars)`);
