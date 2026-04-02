/**
 * Recompute all stored TACO scores using the current formula bounds.
 * Run after changing bounds in lib/taco.ts.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { computeTacoScore } from "../lib/taco";
import { computeBadge, HormuzStatus } from "../lib/badge";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const rows = await sql`SELECT * FROM daily_indicators ORDER BY date ASC`;
  console.log(`Recomputing TACO scores for ${rows.length} rows...\n`);

  let updated = 0;
  for (const row of rows) {
    const approval = row.approval_rating ? Number(row.approval_rating) : null;
    const sp500 = row.sp500_30d_return ? Number(row.sp500_30d_return) : null;
    const inflation = row.inflation_1y ? Number(row.inflation_1y) : null;
    const tbill = row.tbill_3m ? Number(row.tbill_3m) : null;

    const taco = computeTacoScore({
      approval,
      sp500Return: sp500,
      inflation1y: inflation,
      tbill3m: tbill,
    });

    const hormuzStatus = (row.hormuz_status ?? "UNKNOWN") as HormuzStatus;
    const badge = computeBadge(hormuzStatus, taco.score);

    await sql`
      UPDATE daily_indicators
      SET taco_score = ${taco.score},
          taco_components_available = ${taco.componentsAvailable},
          risk_badge = ${badge}
      WHERE id = ${row.id}
    `;
    updated++;

    if (updated % 50 === 0) {
      console.log(`  Updated ${updated}/${rows.length}`);
    }
  }

  console.log(`\nDone! Recomputed ${updated} rows.`);

  // Show key dates with new scores
  const keyDates = ["2025-04-02", "2025-04-08", "2025-04-11", "2025-07-15", "2026-02-28", "2026-04-01"];
  console.log("\nKey dates after recalculation:");
  for (const d of keyDates) {
    const r = await sql`SELECT date, taco_score, risk_badge, sp500_30d_return FROM daily_indicators WHERE date <= ${d}::date ORDER BY date DESC LIMIT 1`;
    if (r[0]) {
      console.log(`  ${new Date(r[0].date as string).toISOString().split("T")[0]}: TACO ${Number(r[0].taco_score).toFixed(2)}, badge ${r[0].risk_badge}, S&P ${(Number(r[0].sp500_30d_return) * 100).toFixed(1)}%`);
    }
  }
}

main().catch(console.error);
