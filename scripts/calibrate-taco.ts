/**
 * TACO Calibration Script
 *
 * Compares reconstructed TACO scores against Deutsche Bank's published readings.
 * Key reference: "index is higher now than during Liberation Day" (March 2026 reporting)
 * Liberation Day tariffs: April 2, 2025
 * S&P 500 dropped ~19% in the weeks after.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { computeTacoScore } from "../lib/taco";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("=== TACO Calibration Analysis ===\n");

  // Key dates to check
  const keyDates = [
    { label: "Liberation Day", date: "2025-04-02" },
    { label: "Week after Liberation Day", date: "2025-04-09" },
    { label: "Peak tariff panic", date: "2025-04-11" },
    { label: "Mid-2025 (baseline)", date: "2025-07-15" },
    { label: "End of 2025", date: "2025-12-31" },
    { label: "Strait closure", date: "2026-02-28" },
    { label: "Recent (March 2026)", date: "2026-03-15" },
    { label: "Latest", date: "2026-04-01" },
  ];

  console.log("Key dates TACO scores:\n");
  console.log("Date           | Label                    | TACO  | S&P 30d   | Inflation | T-bill | Approval | Transits");
  console.log("---------------|--------------------------|-------|-----------|-----------|--------|----------|--------");

  for (const kd of keyDates) {
    // Find closest date in DB (exact or nearest before)
    const rows = await sql`
      SELECT * FROM daily_indicators
      WHERE date <= ${kd.date}::date
      ORDER BY date DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      console.log(`${kd.date}  | ${kd.label.padEnd(24)} | NO DATA`);
      continue;
    }

    const r = rows[0];
    const dateStr = new Date(r.date as string).toISOString().split("T")[0];
    const sp500 = r.sp500_30d_return ? Number(r.sp500_30d_return) : null;
    const inf = r.inflation_1y ? Number(r.inflation_1y) : null;
    const tb = r.tbill_3m ? Number(r.tbill_3m) : null;
    const app = r.approval_rating ? Number(r.approval_rating) : null;
    const transits = r.hormuz_transits;
    const taco = r.taco_score ? Number(r.taco_score) : null;

    console.log(
      `${dateStr}  | ${kd.label.padEnd(24)} | ${taco?.toFixed(2)?.padStart(5) ?? "  N/A"} | ${sp500 !== null ? (sp500 * 100).toFixed(1).padStart(7) + "%" : "     N/A"} | ${inf !== null ? (inf * 100).toFixed(2).padStart(7) + "%" : "     N/A"} | ${tb !== null ? (tb * 100).toFixed(2).padStart(5) + "%" : "   N/A"} | ${app !== null ? app.toFixed(1).padStart(5) + "%" : "   N/A"} | ${transits ?? "N/A"}`
    );
  }

  // Statistics
  console.log("\n=== Score Distribution ===\n");
  const allScores = await sql`
    SELECT taco_score, date FROM daily_indicators
    WHERE taco_score IS NOT NULL
    ORDER BY taco_score DESC
  `;

  const scores = allScores.map((r) => Number(r.taco_score));
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxRow = allScores.find((r) => Number(r.taco_score) === max);
  const minRow = allScores.find((r) => Number(r.taco_score) === min);

  console.log(`Total data points: ${scores.length}`);
  console.log(`Min TACO: ${min.toFixed(2)} on ${new Date(minRow?.date as string).toISOString().split("T")[0]}`);
  console.log(`Max TACO: ${max.toFixed(2)} on ${new Date(maxRow?.date as string).toISOString().split("T")[0]}`);
  console.log(`Average: ${avg.toFixed(2)}`);

  // Histogram
  console.log("\nDistribution:");
  const buckets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  for (let i = 0; i < buckets.length - 1; i++) {
    const count = scores.filter((s) => s >= buckets[i] && s < buckets[i + 1]).length;
    const bar = "█".repeat(Math.round(count / 2));
    console.log(`  ${buckets[i]}-${buckets[i + 1]}: ${bar} (${count})`);
  }

  // Calibration verdict
  console.log("\n=== Calibration Verdict ===\n");

  const liberationScore = allScores.find((r) =>
    new Date(r.date as string).toISOString().startsWith("2025-04")
  );
  const liberationTaco = liberationScore ? Number(liberationScore.taco_score) : null;

  const latestRows = await sql`SELECT taco_score FROM daily_indicators ORDER BY date DESC LIMIT 1`;
  const latestTaco = latestRows[0] ? Number(latestRows[0].taco_score) : null;

  if (liberationTaco !== null && latestTaco !== null) {
    console.log(`Liberation Day TACO: ${liberationTaco.toFixed(2)}`);
    console.log(`Current TACO: ${latestTaco.toFixed(2)}`);

    if (liberationTaco > 5) {
      console.log("✓ Liberation Day shows HIGH stress — bounds look reasonable");
    } else {
      console.log("✗ Liberation Day shows LOW stress — bounds may need widening");
      console.log("  The S&P dropped ~19% but our score doesn't reflect extreme stress.");
      console.log("  Consider: tightening S&P bounds (0 to -15% instead of -25%),");
      console.log("  or adjusting T-bill bounds (wider range).");
    }

    // Deutsche Bank says "index is higher NOW than during Liberation Day"
    if (latestTaco > liberationTaco) {
      console.log("✓ Current > Liberation Day — matches Deutsche Bank's statement");
    } else {
      console.log("✗ Current < Liberation Day — contradicts Deutsche Bank's statement");
      console.log("  Deutsche Bank reported current stress exceeds Liberation Day.");
      console.log("  Our reconstruction disagrees. Likely because we're missing the");
      console.log("  approval rating component in the backfill (null for historical data).");
    }
  }

  // Recompute with tighter bounds to see the difference
  console.log("\n=== What-If: Tighter S&P Bounds (0 to -15%) ===\n");

  const peakPanic = await sql`
    SELECT * FROM daily_indicators WHERE date >= '2025-04-07' AND date <= '2025-04-15' ORDER BY sp500_30d_return ASC LIMIT 1
  `;

  if (peakPanic.length > 0) {
    const r = peakPanic[0];
    const sp500 = Number(r.sp500_30d_return);
    const inf = Number(r.inflation_1y);
    const tb = Number(r.tbill_3m);

    // Current bounds
    const current = computeTacoScore({ approval: null, sp500Return: sp500, inflation1y: inf, tbill3m: tb });

    console.log(`Peak panic day: ${new Date(r.date as string).toISOString().split("T")[0]}`);
    console.log(`S&P 30d return: ${(sp500 * 100).toFixed(1)}%`);
    console.log(`Current bounds score: ${current.score.toFixed(2)}/10 (${current.componentsAvailable} components)`);

    console.log("\nRecommendation: If Liberation Day doesn't score 6+, tighten the S&P bounds.");
  }
}

main().catch(console.error);
