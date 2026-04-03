import { safeFetch } from "./safe-fetch";

export interface YahooFinanceResult {
  sp500Close: number;
  sp500_30dReturn: number;
  brentClose: number;
}

const SP500_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=2mo&interval=1d";
const BRENT_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/BZ%3DF?range=2mo&interval=1d";

interface ChartData {
  closes: number[];
  timestamps: number[];
}

async function parseChart(response: Response): Promise<ChartData> {
  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    throw new Error("No chart result returned from Yahoo Finance");
  }

  const closes: number[] =
    result.indicators?.adjclose?.[0]?.adjclose ??
    result.indicators?.quote?.[0]?.close ??
    [];
  const timestamps: number[] = result.timestamp ?? [];

  if (closes.length === 0 || timestamps.length === 0) {
    throw new Error("Empty price data from Yahoo Finance");
  }

  return { closes, timestamps };
}

function calculate30dReturn(
  closes: number[],
  timestamps: number[]
): { latestClose: number; return30d: number } {
  // Filter out null/undefined entries
  const validPairs: { close: number; ts: number }[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (closes[i] != null && timestamps[i] != null) {
      validPairs.push({ close: closes[i], ts: timestamps[i] });
    }
  }

  if (validPairs.length < 2) {
    throw new Error("Insufficient price data for 30d return calculation");
  }

  const latest = validPairs[validPairs.length - 1];
  const latestTs = latest.ts;
  const thirtyDaysAgoTs = latestTs - 30 * 24 * 60 * 60;

  // Find the closest data point to 30 days ago
  let closest = validPairs[0];
  let closestDiff = Math.abs(closest.ts - thirtyDaysAgoTs);
  for (const pair of validPairs) {
    const diff = Math.abs(pair.ts - thirtyDaysAgoTs);
    if (diff < closestDiff) {
      closest = pair;
      closestDiff = diff;
    }
  }

  const return30d = (latest.close - closest.close) / closest.close;
  return { latestClose: latest.close, return30d };
}

export async function fetchYahooFinance(): Promise<{
  data: YahooFinanceResult | null;
  error: string | null;
}> {
  const [sp500Result, brentResult] = await Promise.all([
    safeFetch<ChartData>(SP500_URL, parseChart, { timeoutMs: 15000 }),
    safeFetch<ChartData>(BRENT_URL, parseChart, { timeoutMs: 15000 }),
  ]);

  if (sp500Result.error || !sp500Result.data) {
    return {
      data: null,
      error: `S&P 500 fetch failed: ${sp500Result.error}`,
    };
  }

  if (brentResult.error || !brentResult.data) {
    return {
      data: null,
      error: `Brent crude fetch failed: ${brentResult.error}`,
    };
  }

  try {
    // Validate close prices are positive numbers
    for (const closes of [sp500Result.data.closes, brentResult.data.closes]) {
      for (const c of closes) {
        if (c != null && (typeof c !== "number" || !isFinite(c) || c <= 0)) {
          console.error(
            `Yahoo Finance parse error: invalid close price detected: ${c}`
          );
          return {
            data: null,
            error: `Yahoo Finance parse error: invalid close price (${c})`,
          };
        }
      }
    }

    // Validate timestamps are valid
    for (const ts of [
      ...sp500Result.data.timestamps,
      ...brentResult.data.timestamps,
    ]) {
      if (ts != null && (typeof ts !== "number" || !isFinite(ts) || ts <= 0)) {
        console.error(
          `Yahoo Finance parse error: invalid timestamp detected: ${ts}`
        );
        return {
          data: null,
          error: `Yahoo Finance parse error: invalid timestamp (${ts})`,
        };
      }
    }

    const sp500 = calculate30dReturn(
      sp500Result.data.closes,
      sp500Result.data.timestamps
    );

    // Validate 30-day return is within plausible range
    if (sp500.return30d < -0.5 || sp500.return30d > 0.5) {
      console.error(
        `Yahoo Finance parse error: S&P 500 30d return ${sp500.return30d} exceeds plausible range [-0.5, 0.5]`
      );
      return {
        data: null,
        error: `Yahoo Finance parse error: 30d return ${sp500.return30d} is implausible (>50% swing)`,
      };
    }

    const brentCloses = brentResult.data.closes.filter((c) => c != null);
    const brentClose = brentCloses[brentCloses.length - 1];

    if (!brentClose || brentClose <= 0) {
      console.error(
        `Yahoo Finance parse error: invalid Brent close price: ${brentClose}`
      );
      return {
        data: null,
        error: `Yahoo Finance parse error: invalid Brent close price (${brentClose})`,
      };
    }

    console.log(
      `Yahoo Finance: S&P 500 ${sp500.latestClose.toFixed(2)}, 30d return ${(sp500.return30d * 100).toFixed(2)}%, Brent $${brentClose.toFixed(2)}`
    );

    return {
      data: {
        sp500Close: sp500.latestClose,
        sp500_30dReturn: Math.round(sp500.return30d * 10000) / 10000,
        brentClose,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Calculation error",
    };
  }
}
