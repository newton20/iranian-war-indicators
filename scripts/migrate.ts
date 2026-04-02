import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Running schema migration...");

  await sql`CREATE TABLE IF NOT EXISTS daily_indicators (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    hormuz_transits INTEGER,
    hormuz_status VARCHAR(10),
    oil_price_brent DECIMAL(8,2),
    approval_rating DECIMAL(5,2),
    approval_date DATE,
    sp500_30d_return DECIMAL(8,4),
    inflation_1y DECIMAL(5,4),
    tbill_3m DECIMAL(5,4),
    taco_score DECIMAL(4,2),
    taco_components_available INTEGER DEFAULT 4,
    risk_badge VARCHAR(10),
    data_quality VARCHAR(20) DEFAULT 'complete',
    pipeline_run_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;
  console.log("  daily_indicators table created");

  await sql`CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_indicators(date DESC)`;
  console.log("  index created");

  await sql`CREATE TABLE IF NOT EXISTS event_annotations (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    label VARCHAR(100) NOT NULL,
    category VARCHAR(20) DEFAULT 'general'
  )`;
  console.log("  event_annotations table created");

  await sql`INSERT INTO event_annotations (date, label, category) VALUES
    ('2025-04-02', 'Liberation Day tariffs', 'policy'),
    ('2026-02-28', 'Strait of Hormuz closed', 'crisis'),
    ('2026-03-09', 'Maritime intelligence daily', 'crisis')
    ON CONFLICT DO NOTHING`;
  console.log("  seed data inserted");

  console.log("Schema migration complete!");
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
