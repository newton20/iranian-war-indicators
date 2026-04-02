import { neon } from "@neondatabase/serverless";

function getDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return sql;
}

// Neon returns DECIMAL as strings and DATE as Date objects.
// This coerces them to the expected JS types.
function coerceRow(row: Record<string, unknown>): Record<string, unknown> {
  const result = { ...row };
  // Coerce dates to ISO strings
  for (const key of ['date', 'approval_date', 'pipeline_run_at', 'created_at']) {
    if (result[key] instanceof Date) {
      result[key] = (result[key] as Date).toISOString();
    } else if (result[key] !== null && result[key] !== undefined) {
      result[key] = String(result[key]);
    }
  }
  // Coerce numeric strings to numbers
  for (const key of ['oil_price_brent', 'approval_rating', 'sp500_30d_return', 'inflation_1y', 'tbill_3m', 'taco_score']) {
    if (typeof result[key] === 'string') {
      result[key] = parseFloat(result[key] as string);
      if (isNaN(result[key] as number)) result[key] = null;
    }
  }
  return result;
}

export interface DailyIndicator {
  id: number;
  date: string;
  hormuz_transits: number | null;
  hormuz_status: string | null;
  oil_price_brent: number | null;
  approval_rating: number | null;
  approval_date: string | null;
  sp500_30d_return: number | null;
  inflation_1y: number | null;
  tbill_3m: number | null;
  taco_score: number | null;
  taco_components_available: number;
  risk_badge: string | null;
  data_quality: string;
  pipeline_run_at: string;
  created_at: string;
}

export interface EventAnnotation {
  id: number;
  date: string;
  label: string;
  category: string;
}

export async function getLatestIndicator(): Promise<DailyIndicator | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM daily_indicators ORDER BY date DESC LIMIT 1
  `;
  return rows[0] ? (coerceRow(rows[0]) as unknown as DailyIndicator) : null;
}

export async function getIndicatorHistory(
  days: number = 365
): Promise<DailyIndicator[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM daily_indicators
    ORDER BY date DESC
    LIMIT ${days}
  `;
  return rows.map(r => coerceRow(r) as unknown as DailyIndicator);
}

export async function getEventAnnotations(): Promise<EventAnnotation[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM event_annotations ORDER BY date ASC
  `;
  return rows.map(r => {
    const row = { ...r };
    if (row.date instanceof Date) row.date = (row.date as Date).toISOString().split('T')[0];
    return row as EventAnnotation;
  });
}

export async function upsertDailyIndicator(data: {
  date: string;
  hormuz_transits: number | null;
  hormuz_status: string;
  oil_price_brent: number | null;
  approval_rating: number | null;
  approval_date: string | null;
  sp500_30d_return: number | null;
  inflation_1y: number | null;
  tbill_3m: number | null;
  taco_score: number;
  taco_components_available: number;
  risk_badge: string;
  data_quality: string;
}): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO daily_indicators (
      date, hormuz_transits, hormuz_status, oil_price_brent,
      approval_rating, approval_date, sp500_30d_return,
      inflation_1y, tbill_3m, taco_score, taco_components_available,
      risk_badge, data_quality, pipeline_run_at
    ) VALUES (
      ${data.date}, ${data.hormuz_transits}, ${data.hormuz_status}, ${data.oil_price_brent},
      ${data.approval_rating}, ${data.approval_date}, ${data.sp500_30d_return},
      ${data.inflation_1y}, ${data.tbill_3m}, ${data.taco_score}, ${data.taco_components_available},
      ${data.risk_badge}, ${data.data_quality}, NOW()
    )
    ON CONFLICT (date) DO UPDATE SET
      hormuz_transits = EXCLUDED.hormuz_transits,
      hormuz_status = EXCLUDED.hormuz_status,
      oil_price_brent = EXCLUDED.oil_price_brent,
      approval_rating = EXCLUDED.approval_rating,
      approval_date = EXCLUDED.approval_date,
      sp500_30d_return = EXCLUDED.sp500_30d_return,
      inflation_1y = EXCLUDED.inflation_1y,
      tbill_3m = EXCLUDED.tbill_3m,
      taco_score = EXCLUDED.taco_score,
      taco_components_available = EXCLUDED.taco_components_available,
      risk_badge = EXCLUDED.risk_badge,
      data_quality = EXCLUDED.data_quality,
      pipeline_run_at = NOW()
  `;
}

export async function getLastKnownValues(): Promise<{
  approval_rating: number | null;
  approval_date: string | null;
  sp500_30d_return: number | null;
  inflation_1y: number | null;
  tbill_3m: number | null;
  oil_price_brent: number | null;
  hormuz_transits: number | null;
}> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      approval_rating, approval_date, sp500_30d_return,
      inflation_1y, tbill_3m, oil_price_brent, hormuz_transits
    FROM daily_indicators
    WHERE data_quality != 'stale'
    ORDER BY date DESC
    LIMIT 1
  `;
  return (
    (rows[0] as { approval_rating: number | null; approval_date: string | null; sp500_30d_return: number | null; inflation_1y: number | null; tbill_3m: number | null; oil_price_brent: number | null; hormuz_transits: number | null }) ?? {
      approval_rating: null,
      approval_date: null,
      sp500_30d_return: null,
      inflation_1y: null,
      tbill_3m: null,
      oil_price_brent: null,
      hormuz_transits: null,
    }
  );
}
