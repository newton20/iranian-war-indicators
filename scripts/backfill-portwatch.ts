import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const PORTWATCH_URL =
  "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query" +
  "?where=portid=%27chokepoint6%27" +
  "&outFields=date,n_total" +
  "&orderByFields=date+DESC" +
  "&resultRecordCount=2000" +
  "&f=json";

interface Feature {
  attributes: { date: number; n_total: number };
}

async function main() {
  console.log("Fetching PortWatch historical Hormuz transit data...");

  const response = await fetch(PORTWATCH_URL);
  const data = await response.json();
  const features: Feature[] = data.features ?? [];

  console.log(`  Got ${features.length} records from PortWatch\n`);

  // First, see what date formats exist in the DB
  const dbDates = await sql`SELECT DISTINCT date::text as d FROM daily_indicators ORDER BY d DESC LIMIT 5`;
  console.log("DB date format samples:", dbDates.map((r) => r.d));

  // Build a map of PortWatch date -> transit count
  const transitMap = new Map<string, number>();
  for (const f of features) {
    // PortWatch dates are UTC midnight epoch milliseconds
    const d = new Date(f.attributes.date);
    const dateStr = d.toISOString().split("T")[0]; // e.g., "2026-03-26"
    transitMap.set(dateStr, f.attributes.n_total);
  }

  console.log(`  PortWatch dates range: ${[...transitMap.keys()].sort()[0]} to ${[...transitMap.keys()].sort().pop()}`);
  console.log(`  Sample: ${[...transitMap.entries()].slice(0, 5).map(([d, t]) => `${d}:${t}`).join(", ")}\n`);

  // Now update using the DB's actual date values
  const allRows = await sql`SELECT id, date::text as date_str FROM daily_indicators ORDER BY date ASC`;
  console.log(`  DB has ${allRows.length} rows to check\n`);

  let updated = 0;
  let noMatch = 0;

  for (const row of allRows) {
    const dbDate = String(row.date_str).split("T")[0]; // handle both "2026-03-26" and "2026-03-26T00:00:00.000Z"
    const transits = transitMap.get(dbDate);

    if (transits !== undefined) {
      const status = transits > 0 ? "OPEN" : "CLOSED";
      await sql`
        UPDATE daily_indicators
        SET hormuz_transits = ${transits}, hormuz_status = ${status}
        WHERE id = ${row.id}
      `;
      updated++;
    } else {
      noMatch++;
    }

    if ((updated + noMatch) % 50 === 0 && updated > 0) {
      console.log(`  Progress: ${updated} updated, ${noMatch} no match`);
    }
  }

  console.log(`\nDone! Updated ${updated} rows, ${noMatch} had no matching PortWatch data.`);
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
