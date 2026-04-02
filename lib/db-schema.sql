-- Iranian War Indicators - Database Schema
-- Run this against your Vercel Postgres instance to initialize

CREATE TABLE IF NOT EXISTS daily_indicators (
  id            SERIAL PRIMARY KEY,
  date          DATE NOT NULL UNIQUE,

  -- Hormuz
  hormuz_transits     INTEGER,
  hormuz_status       VARCHAR(10),
  oil_price_brent     DECIMAL(8,2),

  -- TACO components (raw values)
  approval_rating     DECIMAL(5,2),
  approval_date       DATE,
  sp500_30d_return    DECIMAL(8,4),
  inflation_1y        DECIMAL(5,4),
  tbill_3m            DECIMAL(5,4),

  -- TACO composite
  taco_score          DECIMAL(4,2),
  taco_components_available INTEGER DEFAULT 4,

  -- Combined
  risk_badge          VARCHAR(10),

  -- Metadata
  data_quality        VARCHAR(20) DEFAULT 'complete',
  pipeline_run_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_indicators(date DESC);

CREATE TABLE IF NOT EXISTS event_annotations (
  id          SERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  label       VARCHAR(100) NOT NULL,
  category    VARCHAR(20) DEFAULT 'general'
);

-- Seed events
INSERT INTO event_annotations (date, label, category) VALUES
  ('2025-04-02', 'Liberation Day tariffs', 'policy'),
  ('2026-02-28', 'Strait of Hormuz closed', 'crisis'),
  ('2026-03-09', 'Maritime intelligence daily', 'crisis')
ON CONFLICT DO NOTHING;
