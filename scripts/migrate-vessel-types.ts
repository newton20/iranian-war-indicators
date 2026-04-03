import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Adding vessel type columns to daily_indicators...");

  await sql`ALTER TABLE daily_indicators ADD COLUMN IF NOT EXISTS n_tanker INTEGER`;
  await sql`ALTER TABLE daily_indicators ADD COLUMN IF NOT EXISTS n_container INTEGER`;
  await sql`ALTER TABLE daily_indicators ADD COLUMN IF NOT EXISTS n_dry_bulk INTEGER`;
  await sql`ALTER TABLE daily_indicators ADD COLUMN IF NOT EXISTS n_cargo INTEGER`;

  console.log("Done! Added n_tanker, n_container, n_dry_bulk, n_cargo columns.");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
