import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const rows = await sql`
    SELECT date, hormuz_transits, hormuz_status, oil_price_brent
    FROM daily_indicators
    WHERE hormuz_transits IS NOT NULL
    ORDER BY date DESC
    LIMIT 10
  `;
  console.log("Rows with transit data:");
  rows.forEach((r) => console.log(`  ${r.date} → transits: ${r.hormuz_transits}, oil: ${r.oil_price_brent}, status: ${r.hormuz_status}`));

  const countResult = await sql`SELECT COUNT(*) as cnt FROM daily_indicators WHERE hormuz_transits IS NOT NULL`;
  console.log(`\nTotal rows with transit data: ${countResult[0].cnt}`);

  const nullCount = await sql`SELECT COUNT(*) as cnt FROM daily_indicators WHERE hormuz_transits IS NULL`;
  console.log(`Rows WITHOUT transit data: ${nullCount[0].cnt}`);
}

main().catch(console.error);
