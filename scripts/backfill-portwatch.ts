import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const PORTWATCH_URL =
  "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query" +
  "?where=portid=%27chokepoint6%27" +
  "&outFields=date,n_total,n_tanker,n_container,n_dry_bulk,n_general_cargo,n_roro" +
  "&orderByFields=date+DESC" +
  "&resultRecordCount=2000" +
  "&f=json";

interface Feature {
  attributes: {
    date: number;
    n_total: number;
    n_tanker?: number;
    n_container?: number;
    n_dry_bulk?: number;
    n_general_cargo?: number;
    n_roro?: number;
  };
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

  // Build a map of PortWatch date -> transit data
  interface TransitData {
    n_total: number;
    n_tanker: number | null;
    n_container: number | null;
    n_dry_bulk: number | null;
    n_cargo: number | null;
  }
  const transitMap = new Map<string, TransitData>();
  for (const f of features) {
    // PortWatch dates are UTC midnight epoch milliseconds
    const d = new Date(f.attributes.date);
    const dateStr = d.toISOString().split("T")[0]; // e.g., "2026-03-26"
    const a = f.attributes;
    const nTanker = typeof a.n_tanker === "number" && !isNaN(a.n_tanker) ? a.n_tanker : null;
    const nContainer = typeof a.n_container === "number" && !isNaN(a.n_container) ? a.n_container : null;
    const nDryBulk = typeof a.n_dry_bulk === "number" && !isNaN(a.n_dry_bulk) ? a.n_dry_bulk : null;
    const nGeneralCargo = typeof a.n_general_cargo === "number" && !isNaN(a.n_general_cargo) ? a.n_general_cargo : 0;
    const nRoro = typeof a.n_roro === "number" && !isNaN(a.n_roro) ? a.n_roro : 0;
    const nCargo = (nGeneralCargo || nRoro) ? nGeneralCargo + nRoro : null;
    transitMap.set(dateStr, { n_total: a.n_total, n_tanker: nTanker, n_container: nContainer, n_dry_bulk: nDryBulk, n_cargo: nCargo });
  }

  console.log(`  PortWatch dates range: ${[...transitMap.keys()].sort()[0]} to ${[...transitMap.keys()].sort().pop()}`);
  console.log(`  Sample: ${[...transitMap.entries()].slice(0, 5).map(([d, t]) => `${d}:${t.n_total}`).join(", ")}\n`);

  // Now update using the DB's actual date values
  const allRows = await sql`SELECT id, date::text as date_str FROM daily_indicators ORDER BY date ASC`;
  console.log(`  DB has ${allRows.length} rows to check\n`);

  let updated = 0;
  let noMatch = 0;

  for (const row of allRows) {
    const dbDate = String(row.date_str).split("T")[0]; // handle both "2026-03-26" and "2026-03-26T00:00:00.000Z"
    const data = transitMap.get(dbDate);

    if (data !== undefined) {
      const status = data.n_total > 0 ? "OPEN" : "CLOSED";
      await sql`
        UPDATE daily_indicators
        SET hormuz_transits = ${data.n_total}, hormuz_status = ${status},
            n_tanker = ${data.n_tanker}, n_container = ${data.n_container},
            n_dry_bulk = ${data.n_dry_bulk}, n_cargo = ${data.n_cargo}
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
