import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const PORTWATCH_URL =
  "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query" +
  "?where=portid=%27chokepoint6%27" +
  "&outFields=date,n_total" +
  "&orderByFields=date+ASC" +
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

  console.log(`  Got ${features.length} records from PortWatch`);

  let updated = 0;
  let skipped = 0;

  for (const f of features) {
    const dateMs = f.attributes.date;
    const transits = f.attributes.n_total;
    const dateStr = new Date(dateMs).toISOString().split("T")[0];

    // Only update rows that already exist (from the main backfill)
    // and set the transit data + status
    const hormuzStatus = transits > 0 ? "OPEN" : transits === 0 ? "CLOSED" : "UNKNOWN";

    try {
      await sql`
        UPDATE daily_indicators
        SET hormuz_transits = ${transits},
            hormuz_status = ${hormuzStatus}
        WHERE date = ${dateStr}
      `;
      updated++;
    } catch {
      skipped++;
    }

    if ((updated + skipped) % 100 === 0) {
      console.log(`  Progress: ${updated} updated, ${skipped} skipped`);
    }
  }

  console.log(`\nDone! Updated ${updated} rows with transit data, skipped ${skipped}.`);
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
