/**
 * Historical backfill script for Iranian War Indicators.
 *
 * Populates daily_indicators from 2025-01-20 to today using Yahoo Finance
 * (S&P 500 + Brent crude) and FRED (inflation expectations + T-bill).
 *
 * Approval ratings and Hormuz transit data are skipped (set to null / UNKNOWN).
 *
 * Usage:
 *   DATABASE_URL=... FRED_API_KEY=... npx tsx scripts/backfill.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { computeTacoScore } from "../lib/taco";
import { computeBadge } from "../lib/badge";
import { upsertDailyIndicator } from "../lib/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Returns true when the date falls on a weekday (Mon-Fri). */
function isTradingDay(d: Date): boolean {
  const day = d.getUTCDay();
  return day >= 1 && day <= 5;
}

/** Generate every calendar date between `from` and `to` inclusive. */
function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cur <= end) {
    dates.push(toDateStr(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Yahoo Finance helpers
// ---------------------------------------------------------------------------

interface YahooPriceMap {
  [date: string]: number;
}

async function fetchYahooPrices(symbol: string): Promise<YahooPriceMap> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d`;
  console.log(`  Fetching Yahoo Finance: ${symbol}`);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (backfill script)",
    },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance HTTP ${res.status} for ${symbol}: ${res.statusText}`);
  }

  const json = await res.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No chart result for ${symbol}`);

  const timestamps: number[] = result.timestamp;
  const closes: (number | null)[] =
    result.indicators?.adjclose?.[0]?.adjclose ??
    result.indicators?.quote?.[0]?.close ??
    [];

  const map: YahooPriceMap = {};
  for (let i = 0; i < timestamps.length; i++) {
    const date = toDateStr(new Date(timestamps[i] * 1000));
    const price = closes[i];
    if (price != null && isFinite(price)) {
      map[date] = price;
    }
  }
  return map;
}

/** Compute 30-day rolling return for each date in the price map. */
function rolling30dReturn(prices: YahooPriceMap): Record<string, number> {
  const sorted = Object.entries(prices).sort(([a], [b]) => a.localeCompare(b));
  const returns: Record<string, number> = {};

  for (let i = 0; i < sorted.length; i++) {
    const [date, price] = sorted[i];
    // Look back ~30 calendar days (approximately 21 trading days)
    const target = new Date(date + "T00:00:00Z");
    target.setUTCDate(target.getUTCDate() - 30);
    const targetStr = toDateStr(target);

    // Find the closest earlier date
    let refPrice: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (sorted[j][0] <= targetStr) {
        refPrice = sorted[j][1];
        break;
      }
    }
    // If we couldn't find a date at least 30 days back, try the earliest available
    if (refPrice === null && i > 20) {
      refPrice = sorted[0][1];
    }

    if (refPrice !== null && refPrice > 0) {
      returns[date] = (price - refPrice) / refPrice;
    }
  }
  return returns;
}

// ---------------------------------------------------------------------------
// FRED helpers
// ---------------------------------------------------------------------------

interface FredObsMap {
  [date: string]: number;
}

async function fetchFredSeries(seriesId: string): Promise<FredObsMap> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    console.warn(`  FRED_API_KEY not set — skipping ${seriesId}`);
    return {};
  }

  const url =
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${seriesId}` +
    `&api_key=${apiKey}` +
    `&file_type=json` +
    `&observation_start=2024-01-01`;

  console.log(`  Fetching FRED: ${seriesId}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED HTTP ${res.status} for ${seriesId}`);

  const json = await res.json();
  const observations: { date: string; value: string }[] = json.observations ?? [];

  const map: FredObsMap = {};
  for (const obs of observations) {
    if (obs.value === ".") continue; // FRED missing value marker
    const val = parseFloat(obs.value);
    if (isNaN(val)) continue;
    // FRED values are percentages (e.g., "3.10" means 3.10%), convert to decimal
    map[obs.date] = val / 100;
  }
  return map;
}

/**
 * For a given date, find the latest observation on or before that date.
 * This implements the step-function (carry-forward) behavior needed for
 * monthly series like EXPINF1YR.
 */
function lookupLatest(
  map: FredObsMap,
  date: string,
  sortedKeys: string[]
): number | null {
  for (let i = sortedKeys.length - 1; i >= 0; i--) {
    if (sortedKeys[i] <= date) {
      return map[sortedKeys[i]];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is required");
    process.exit(1);
  }
  if (!process.env.FRED_API_KEY) {
    console.warn("WARNING: FRED_API_KEY not set — inflation and T-bill data will be skipped");
  }

  const START_DATE = "2025-01-20";
  const END_DATE = toDateStr(new Date());

  console.log(`Backfill: ${START_DATE} to ${END_DATE}\n`);

  // ---- Fetch all historical data in parallel ----
  console.log("Fetching historical data...");

  const [sp500Prices, brentPrices, inflationObs, tbillObs] = await Promise.all([
    fetchYahooPrices("^GSPC"),
    fetchYahooPrices("BZ=F"),
    fetchFredSeries("EXPINF1YR"),
    fetchFredSeries("DTB3"),
  ]);

  console.log(`  S&P 500: ${Object.keys(sp500Prices).length} days`);
  console.log(`  Brent:   ${Object.keys(brentPrices).length} days`);
  console.log(`  EXPINF1YR: ${Object.keys(inflationObs).length} observations`);
  console.log(`  DTB3:    ${Object.keys(tbillObs).length} observations\n`);

  // Compute rolling returns for S&P 500
  const sp500Returns = rolling30dReturn(sp500Prices);
  console.log(`  S&P 500 rolling returns computed: ${Object.keys(sp500Returns).length} days\n`);

  // Pre-sort FRED keys for step-function lookup
  const inflationKeys = Object.keys(inflationObs).sort();
  const tbillKeys = Object.keys(tbillObs).sort();

  // ---- Generate trading days ----
  const allDates = dateRange(START_DATE, END_DATE);
  const tradingDays = allDates.filter((d) => isTradingDay(new Date(d + "T00:00:00Z")));

  console.log(`Processing ${tradingDays.length} trading days...\n`);

  let upserted = 0;
  let skipped = 0;

  for (const date of tradingDays) {
    const sp500Close = sp500Prices[date] ?? null;
    const sp500Return = sp500Returns[date] ?? null;
    const brentClose = brentPrices[date] ?? null;
    const inflation = lookupLatest(inflationObs, date, inflationKeys);
    const tbill = lookupLatest(tbillObs, date, tbillKeys);

    // Skip days with no market data at all (holidays, etc.)
    if (sp500Close === null && brentClose === null) {
      skipped++;
      continue;
    }

    // Compute TACO score
    const taco = computeTacoScore({
      approval: null, // skipped in backfill
      sp500Return,
      inflation1y: inflation,
      tbill3m: tbill,
    });

    // Compute badge (Hormuz UNKNOWN since we don't have transit data)
    const badge = computeBadge("UNKNOWN", taco.score);

    // Determine data quality
    const quality = taco.componentsAvailable >= 3 ? "ok" : "partial";

    await upsertDailyIndicator({
      date,
      hormuz_transits: null,
      hormuz_status: "UNKNOWN",
      oil_price_brent: brentClose,
      approval_rating: null,
      approval_date: null,
      sp500_30d_return: sp500Return,
      inflation_1y: inflation,
      tbill_3m: tbill,
      taco_score: taco.score,
      taco_components_available: taco.componentsAvailable,
      risk_badge: badge,
      data_quality: quality,
      n_tanker: null,
      n_container: null,
      n_dry_bulk: null,
      n_cargo: null,
    });

    upserted++;

    if (upserted % 50 === 0) {
      console.log(`  Progress: ${upserted} rows upserted (${date})`);
    }
  }

  console.log(
    `\nDone! Upserted ${upserted} rows, skipped ${skipped} non-trading days.`
  );
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
