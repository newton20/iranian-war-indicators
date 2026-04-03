import { fetchPortWatch } from "./fetchers/portwatch";
import { fetchYahooFinance } from "./fetchers/yahoo-finance";
import { fetchFred } from "./fetchers/fred";
import { fetchApproval } from "./fetchers/approval";
import { computeTacoScore, TacoInput } from "./taco";
import { computeBadge, HormuzStatus } from "./badge";
import { upsertDailyIndicator, getLastKnownValues } from "./db";

export async function runPipeline(): Promise<{
  success: boolean;
  summary: string;
}> {
  const today = new Date().toISOString().split("T")[0];
  const errors: string[] = [];

  // 1. Fetch all 4 sources in parallel
  const [portwatchResult, yahooResult, fredResult, approvalResult] =
    await Promise.allSettled([
      fetchPortWatch(),
      fetchYahooFinance(),
      fetchFred(),
      fetchApproval(),
    ]);

  const portwatch =
    portwatchResult.status === "fulfilled" ? portwatchResult.value : null;
  const yahoo =
    yahooResult.status === "fulfilled" ? yahooResult.value : null;
  const fred =
    fredResult.status === "fulfilled" ? fredResult.value : null;
  const approval =
    approvalResult.status === "fulfilled" ? approvalResult.value : null;

  // Track fetch outcomes
  let fetchSuccesses = 0;
  const totalFetches = 4;

  if (portwatch?.data) fetchSuccesses++;
  else errors.push(`PortWatch: ${portwatch?.error ?? "promise rejected"}`);

  if (yahoo?.data) fetchSuccesses++;
  else errors.push(`Yahoo Finance: ${yahoo?.error ?? "promise rejected"}`);

  if (fred?.data) fetchSuccesses++;
  else errors.push(`FRED: ${fred?.error ?? "promise rejected"}`);

  if (approval?.data) fetchSuccesses++;
  else errors.push(`Approval: ${approval?.error ?? "promise rejected"}`);

  // 2. For any failures, get last-known-good values from DB
  let fallback: Awaited<ReturnType<typeof getLastKnownValues>> | null = null;
  if (fetchSuccesses < totalFetches) {
    try {
      fallback = await getLastKnownValues();
    } catch (err) {
      errors.push(
        `DB fallback failed: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }

  // Build values with fallbacks
  const hormuzTransits =
    portwatch?.data?.transits ?? fallback?.hormuz_transits ?? null;
  const nTanker = portwatch?.data?.nTanker ?? null;
  const nContainer = portwatch?.data?.nContainer ?? null;
  const nDryBulk = portwatch?.data?.nDryBulk ?? null;
  const nCargo = portwatch?.data?.nCargo ?? null;
  const oilPriceBrent =
    yahoo?.data?.brentClose ?? fallback?.oil_price_brent ?? null;
  const sp50030dReturn =
    yahoo?.data?.sp500_30dReturn ?? fallback?.sp500_30d_return ?? null;
  const inflation1y =
    fred?.data?.inflation1y ?? fallback?.inflation_1y ?? null;
  const tbill3m = fred?.data?.tbill3m ?? fallback?.tbill_3m ?? null;
  const approvalRating =
    approval?.data?.approval ?? fallback?.approval_rating ?? null;
  // approval pollDate may be a range like "3/12 - 3/31" — extract the end date
  let approvalDate: string | null = null;
  const rawPollDate = approval?.data?.pollDate ?? null;
  if (rawPollDate) {
    // Try to parse "M/D - M/D" format → use end date with current year
    const rangeMatch = rawPollDate.match(/(\d{1,2})\/(\d{1,2})\s*$/);
    if (rangeMatch) {
      const month = rangeMatch[1].padStart(2, '0');
      const day = rangeMatch[2].padStart(2, '0');
      approvalDate = `${new Date().getFullYear()}-${month}-${day}`;
    } else {
      // Try direct ISO parse
      const d = new Date(rawPollDate);
      approvalDate = isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
    }
  }
  if (!approvalDate && fallback?.approval_date) {
    approvalDate = String(fallback.approval_date);
  }

  // 3. Compute TACO score
  const tacoInput: TacoInput = {
    approval: approvalRating,
    sp500Return: sp50030dReturn,
    inflation1y: inflation1y,
    tbill3m: tbill3m,
  };
  const taco = computeTacoScore(tacoInput);

  // 4. Determine Hormuz status (tanker-prioritized)
  let hormuzStatus: HormuzStatus;
  if (hormuzTransits === null) {
    hormuzStatus = "UNKNOWN";
  } else if (nTanker === 0 && hormuzTransits === 0) {
    hormuzStatus = "CLOSED";
  } else if (nTanker === 0 && hormuzTransits > 0) {
    hormuzStatus = "RESTRICTED";
  } else if (nTanker !== null && nTanker > 0 && nTanker <= 3) {
    hormuzStatus = "RESTRICTED";
  } else {
    hormuzStatus = "OPEN";
  }

  // 5. Compute badge
  const badge = computeBadge(hormuzStatus, taco.score);

  // 6. Determine data quality
  let dataQuality: string;
  if (fetchSuccesses === totalFetches) {
    dataQuality = "complete";
  } else if (fetchSuccesses === 0) {
    dataQuality = "stale";
  } else {
    dataQuality = "partial";
  }

  // 7. Upsert to DB
  try {
    await upsertDailyIndicator({
      date: today,
      hormuz_transits: hormuzTransits,
      hormuz_status: hormuzStatus,
      oil_price_brent: oilPriceBrent,
      approval_rating: approvalRating,
      approval_date: approvalDate,
      sp500_30d_return: sp50030dReturn,
      inflation_1y: inflation1y,
      tbill_3m: tbill3m,
      taco_score: taco.score,
      taco_components_available: taco.componentsAvailable,
      risk_badge: badge,
      data_quality: dataQuality,
      n_tanker: nTanker,
      n_container: nContainer,
      n_dry_bulk: nDryBulk,
      n_cargo: nCargo,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown DB error";
    return {
      success: false,
      summary: `Pipeline failed on DB upsert: ${msg}. Fetch errors: ${errors.join("; ")}`,
    };
  }

  // 8. Return summary
  const summary = [
    `Pipeline completed for ${today}.`,
    `Data quality: ${dataQuality} (${fetchSuccesses}/${totalFetches} sources).`,
    `TACO: ${taco.score} (${taco.componentsAvailable} components).`,
    `Badge: ${badge}. Hormuz: ${hormuzStatus}.`,
    errors.length > 0 ? `Errors: ${errors.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { success: true, summary };
}
