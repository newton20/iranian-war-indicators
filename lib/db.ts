import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;
function getDb() {
  if (!_sql) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL environment variable is not configured");
    }
    _sql = neon(dbUrl);
  }
  return _sql;
}

// Neon returns DECIMAL as strings and DATE as Date objects.
// This coerces them to the expected JS types with full field mapping.
function coerceRow(row: Record<string, unknown>): DailyIndicator {
  const coerceDate = (v: unknown): string => {
    if (v instanceof Date) return v.toISOString();
    return v !== null && v !== undefined ? String(v) : '';
  };
  const coerceNum = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return isNaN(n) ? null : n;
  };
  const coerceInt = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  return {
    id: Number(row.id),
    date: coerceDate(row.date),
    hormuz_transits: coerceInt(row.hormuz_transits),
    hormuz_status: row.hormuz_status ? String(row.hormuz_status) : null,
    oil_price_brent: coerceNum(row.oil_price_brent),
    approval_rating: coerceNum(row.approval_rating),
    approval_date: row.approval_date ? coerceDate(row.approval_date) : null,
    sp500_30d_return: coerceNum(row.sp500_30d_return),
    inflation_1y: coerceNum(row.inflation_1y),
    tbill_3m: coerceNum(row.tbill_3m),
    taco_score: coerceNum(row.taco_score),
    taco_components_available: Number(row.taco_components_available ?? 0),
    n_tanker: coerceInt(row.n_tanker),
    n_container: coerceInt(row.n_container),
    n_dry_bulk: coerceInt(row.n_dry_bulk),
    n_cargo: coerceInt(row.n_cargo),
    risk_badge: row.risk_badge ? String(row.risk_badge) : null,
    data_quality: String(row.data_quality ?? 'complete'),
    pipeline_run_at: coerceDate(row.pipeline_run_at),
    created_at: coerceDate(row.created_at),
  };
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
  n_tanker: number | null;
  n_container: number | null;
  n_dry_bulk: number | null;
  n_cargo: number | null;
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
  ` as Record<string, unknown>[];
  return rows[0] ? coerceRow(rows[0]) : null;
}

export async function getIndicatorHistory(
  days: number = 365
): Promise<DailyIndicator[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM daily_indicators
    ORDER BY date DESC
    LIMIT ${days}
  ` as Record<string, unknown>[];
  return rows.map(coerceRow);
}

export async function getEventAnnotations(): Promise<EventAnnotation[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM event_annotations ORDER BY date ASC
  ` as Record<string, unknown>[];
  return rows.map(r => {
    const date = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date ?? '');
    return {
      id: Number(r.id),
      date,
      label: String(r.label ?? ''),
      category: String(r.category ?? ''),
    } as EventAnnotation;
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
  n_tanker: number | null;
  n_container: number | null;
  n_dry_bulk: number | null;
  n_cargo: number | null;
}): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO daily_indicators (
      date, hormuz_transits, hormuz_status, oil_price_brent,
      approval_rating, approval_date, sp500_30d_return,
      inflation_1y, tbill_3m, taco_score, taco_components_available,
      risk_badge, data_quality, n_tanker, n_container, n_dry_bulk, n_cargo,
      pipeline_run_at
    ) VALUES (
      ${data.date}, ${data.hormuz_transits}, ${data.hormuz_status}, ${data.oil_price_brent},
      ${data.approval_rating}, ${data.approval_date}, ${data.sp500_30d_return},
      ${data.inflation_1y}, ${data.tbill_3m}, ${data.taco_score}, ${data.taco_components_available},
      ${data.risk_badge}, ${data.data_quality}, ${data.n_tanker}, ${data.n_container}, ${data.n_dry_bulk}, ${data.n_cargo},
      NOW()
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
      n_tanker = EXCLUDED.n_tanker,
      n_container = EXCLUDED.n_container,
      n_dry_bulk = EXCLUDED.n_dry_bulk,
      n_cargo = EXCLUDED.n_cargo,
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
  ` as Record<string, unknown>[];
  if (!rows[0]) {
    return {
      approval_rating: null,
      approval_date: null,
      sp500_30d_return: null,
      inflation_1y: null,
      tbill_3m: null,
      oil_price_brent: null,
      hormuz_transits: null,
    };
  }

  const coerceNum = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return isNaN(n) ? null : n;
  };
  const coerceDate = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v.toISOString();
    return String(v);
  };

  const r = rows[0];
  return {
    approval_rating: coerceNum(r.approval_rating),
    approval_date: coerceDate(r.approval_date),
    sp500_30d_return: coerceNum(r.sp500_30d_return),
    inflation_1y: coerceNum(r.inflation_1y),
    tbill_3m: coerceNum(r.tbill_3m),
    oil_price_brent: coerceNum(r.oil_price_brent),
    hormuz_transits: coerceNum(r.hormuz_transits),
  };
}
