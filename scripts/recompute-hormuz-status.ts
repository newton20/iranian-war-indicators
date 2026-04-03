/**
 * Recompute hormuz_status using the new 4-state tanker-aware logic,
 * then recompute risk_badge via computeBadge.
 *
 * Run after deploying the RESTRICTED status changes.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { computeTacoScore } from "../lib/taco";
import { computeBadge, HormuzStatus } from "../lib/badge";

const sql = neon(process.env.DATABASE_URL!);

function deriveHormuzStatus(
  hormuzTransits: number | null,
  nTanker: number | null
): HormuzStatus {
  if (hormuzTransits === null) return "UNKNOWN";
  if (nTanker === 0 && hormuzTransits === 0) return "CLOSED";
  if (nTanker === 0 && hormuzTransits > 0) return "RESTRICTED";
  if (nTanker !== null && nTanker > 0 && nTanker <= 3) return "RESTRICTED";
  return "OPEN";
}

async function main() {
  const rows = await sql`SELECT * FROM daily_indicators ORDER BY date ASC`;
  console.log(`Recomputing Hormuz status for ${rows.length} rows...\n`);

  let updated = 0;
  let changed = 0;

  for (const row of rows) {
    const hormuzTransits =
      row.hormuz_transits !== null && row.hormuz_transits !== undefined
        ? Number(row.hormuz_transits)
        : null;
    const nTanker =
      row.n_tanker !== null && row.n_tanker !== undefined
        ? Number(row.n_tanker)
        : null;

    const newStatus = deriveHormuzStatus(hormuzTransits, nTanker);
    const oldStatus = row.hormuz_status ?? "UNKNOWN";

    // Recompute badge with new status
    const tacoScore = row.taco_score !== null ? Number(row.taco_score) : 0;
    const newBadge = computeBadge(newStatus, tacoScore);

    const statusChanged = newStatus !== oldStatus;
    const badgeChanged = newBadge !== row.risk_badge;

    if (statusChanged || badgeChanged) {
      await sql`
        UPDATE daily_indicators
        SET hormuz_status = ${newStatus},
            risk_badge = ${newBadge}
        WHERE id = ${row.id}
      `;
      changed++;

      if (statusChanged) {
        const dateStr = row.date instanceof Date
          ? row.date.toISOString().split("T")[0]
          : String(row.date).split("T")[0];
        console.log(
          `  ${dateStr}: ${oldStatus} -> ${newStatus} (tankers: ${nTanker}, total: ${hormuzTransits}, badge: ${row.risk_badge} -> ${newBadge})`
        );
      }
    }

    updated++;
    if (updated % 100 === 0) {
      console.log(`  Processed ${updated}/${rows.length}`);
    }
  }

  console.log(`\nDone! Processed ${updated} rows, ${changed} changed.`);
}

main().catch(console.error);
