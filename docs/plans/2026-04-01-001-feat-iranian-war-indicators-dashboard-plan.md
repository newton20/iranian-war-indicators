---
title: "feat: Iranian War Indicators Dashboard"
type: feat
status: active
date: 2026-04-01
origin: docs/brainstorms/2026-04-01-iranian-war-indicators-requirements.md
---

# Iranian War Indicators Dashboard

## Overview

Build a daily-updated geopolitical risk dashboard combining two indicators: (1) Strait of Hormuz shipping status (binary OPEN/CLOSED from IMF PortWatch transit counts) and (2) TACO Stress Index (Deutsche Bank's 4-component "Trump Always Caves" methodology reconstructed from public data). Includes a combined GREEN/YELLOW/RED risk badge, historical charts with event markers, and a Claude Code CLI skill for terminal reports.

Built by forking [hormuz-tracker](https://github.com/johnsmalls22-rgb/hormuz-tracker) (MIT, Next.js 16 + React 19 + Recharts 3.8) as reference, stripping to essentials, and extending with TACO panel + data pipeline + Vercel Postgres persistence.

## Problem Statement / Motivation

During the Iran/Middle East crisis (Strait of Hormuz effectively closed since Feb 28, 2026), mainstream media and political signals are unreliable for assessing actual risk. Two bottom-level data indicators cut through the noise: are ships transiting the Strait, and is the TACO market pattern (politicians cave under domestic pressure) still holding? Currently requires manually checking scattered sources. This dashboard automates that into a 10-second check. (see origin: `docs/brainstorms/2026-04-01-iranian-war-indicators-requirements.md`)

## Proposed Solution

### Architecture

```
  ┌─────────────────────────────────────────────────────────────┐
  │  Vercel Cron (daily, 21:30 UTC / after 4pm ET)              │
  │  GET /api/cron                                              │
  │  ┌────────────────────────────────────────────────────────┐ │
  │  │            Data Pipeline (parallel fetches)             │ │
  │  │  ┌──────────┐ ┌──────────┐ ┌───────┐ ┌─────────────┐ │ │
  │  │  │PortWatch │ │Yahoo Fin │ │ FRED  │ │RCP/Gallup   │ │ │
  │  │  │(transits)│ │(S&P,Oil) │ │(2 srs)│ │(approval)   │ │ │
  │  │  └────┬─────┘ └────┬─────┘ └───┬───┘ └──────┬──────┘ │ │
  │  │       └──────┬──────┴───────────┴────────────┘        │ │
  │  │              ▼                                         │ │
  │  │     Normalize + Compute TACO + Determine Hormuz Status │ │
  │  │              ▼                                         │ │
  │  │     Upsert to Vercel Postgres (idempotent)             │ │
  │  └────────────────────────────────────────────────────────┘ │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  Next.js Dashboard (SSR from Postgres)                      │
  │  ┌─────────────────────────────────────────────────────┐   │
  │  │  [COMBINED RISK BADGE: GREEN/YELLOW/RED]             │   │
  │  │  "Status as of 2026-03-31" + data quality indicators │   │
  │  ├──────────────────────┬──────────────────────────────┤   │
  │  │  HORMUZ PANEL         │  TACO PANEL                  │   │
  │  │  [OPEN/CLOSED/UNKNOWN]│  Stress: 6.2/10 (gauge)     │   │
  │  │  47 transits          │  Approval: 38% (stale: 3d)  │   │
  │  │  ┌────────────────┐  │  S&P 30d: -4.2%             │   │
  │  │  │ Transits + Oil  │  │  Inflation: 3.1%            │   │
  │  │  │ (Recharts,      │  │  T-bill: 3.68%              │   │
  │  │  │  dual axis,     │  │  ┌─────────────────────┐    │   │
  │  │  │  event markers) │  │  │ TACO composite chart │    │   │
  │  │  └────────────────┘  │  │ (backfill from 2025) │    │   │
  │  │                      │  │ + event markers       │    │   │
  │  │                      │  └─────────────────────┘    │   │
  │  └──────────────────────┴──────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  Claude Code Skill: /iran-indicators                        │
  │  GET /api/report → JSON → formatted terminal output         │
  │  Reads latest stored data (no re-fetch)                     │
  │  Includes threshold warnings when values are extreme        │
  └─────────────────────────────────────────────────────────────┘
```

### Data Sources (all free)

| Data | Source | API Key? | Frequency | Latency | FRED Series |
|------|--------|----------|-----------|---------|-------------|
| Hormuz transits | IMF PortWatch chokepoint dataset | No | Daily | 1-2 days | — |
| S&P 500 | Yahoo Finance (^GSPC) | No | Daily (market days) | Same day after close | — |
| Brent crude | Yahoo Finance (BZ=F) | No | Daily | Same day | — |
| 1Y Inflation Exp. | FRED API | Yes (free) | Monthly | ~2 weeks | EXPINF1YR |
| 3M T-bill yield | FRED API | Yes (free) | Daily (market days) | Same day | DTB3 |
| Approval rating | RealClearPolitics scrape | No | Irregular | 0-7 days | — |
| War risk premium | TBD (gated on finding free source) | TBD | TBD | TBD | — |

### Database Schema

```sql
-- Daily indicator snapshots (one row per day)
CREATE TABLE daily_indicators (
  id            SERIAL PRIMARY KEY,
  date          DATE NOT NULL UNIQUE,

  -- Hormuz
  hormuz_transits     INTEGER,          -- NULL = data unavailable
  hormuz_status       VARCHAR(10),      -- 'OPEN', 'CLOSED', 'UNKNOWN'
  oil_price_brent     DECIMAL(8,2),     -- BZ=F close

  -- TACO components (raw values)
  approval_rating     DECIMAL(5,2),     -- e.g., 38.50 (%)
  approval_date       DATE,             -- when this poll was published
  sp500_30d_return    DECIMAL(8,4),     -- e.g., -0.0420 (-4.2%)
  inflation_1y        DECIMAL(5,4),     -- e.g., 0.0310 (3.1%)
  tbill_3m            DECIMAL(5,4),     -- e.g., 0.0368 (3.68%)

  -- TACO composite
  taco_score          DECIMAL(4,2),     -- 0.00 - 10.00
  taco_components_available INTEGER DEFAULT 4, -- how many of 4 fetched OK

  -- Combined
  risk_badge          VARCHAR(10),      -- 'GREEN', 'YELLOW', 'RED'

  -- Metadata
  data_quality        VARCHAR(20) DEFAULT 'complete', -- 'complete', 'partial', 'stale'
  pipeline_run_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_daily_date ON daily_indicators(date DESC);

-- Event annotations (hardcoded seed, manually maintained)
CREATE TABLE event_annotations (
  id          SERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  label       VARCHAR(100) NOT NULL,
  category    VARCHAR(20) DEFAULT 'general' -- 'crisis', 'policy', 'market'
);

-- Seed data
INSERT INTO event_annotations (date, label, category) VALUES
  ('2025-04-02', 'Liberation Day tariffs', 'policy'),
  ('2026-02-28', 'Strait of Hormuz closed', 'crisis'),
  ('2026-03-09', 'Maritime intelligence daily', 'crisis');
```

### TACO Composite Formula

```typescript
// lib/taco.ts
interface TacoInput {
  approval: number | null;      // percentage, e.g., 38.5
  sp500Return: number | null;   // decimal, e.g., -0.042
  inflation1y: number | null;   // decimal, e.g., 0.031
  tbill3m: number | null;       // decimal, e.g., 0.0368
}

interface TacoResult {
  score: number;                // 0-10
  componentsAvailable: number;  // 0-4
  breakdown: {
    approval: number | null;    // 0-10 (individual component score)
    sp500: number | null;
    inflation: number | null;
    tbill: number | null;
  };
}

// Normalization bounds (see origin: requirements R8)
const BOUNDS = {
  approval:  { min: 55, max: 30 },   // INVERTED: lower approval = higher stress
  sp500:     { min: 0, max: -0.25 },  // INVERTED: negative return = higher stress
  inflation: { min: 0.02, max: 0.06 },
  tbill:     { min: 0.03, max: 0.06 },
} as const;

function normalize(value: number, min: number, max: number): number {
  const clamped = Math.max(Math.min(value, Math.max(min, max)), Math.min(min, max));
  return ((clamped - min) / (max - min)) * 10;
}

export function computeTacoScore(input: TacoInput): TacoResult {
  const components = [
    input.approval !== null ? normalize(input.approval, BOUNDS.approval.min, BOUNDS.approval.max) : null,
    input.sp500Return !== null ? normalize(input.sp500Return, BOUNDS.sp500.min, BOUNDS.sp500.max) : null,
    input.inflation1y !== null ? normalize(input.inflation1y, BOUNDS.inflation.min, BOUNDS.inflation.max) : null,
    input.tbill3m !== null ? normalize(input.tbill3m, BOUNDS.tbill.min, BOUNDS.tbill.max) : null,
  ];

  const available = components.filter(c => c !== null) as number[];
  const score = available.length > 0
    ? available.reduce((a, b) => a + b, 0) / available.length
    : 0;

  return {
    score: Math.round(score * 100) / 100,
    componentsAvailable: available.length,
    breakdown: {
      approval: components[0],
      sp500: components[1],
      inflation: components[2],
      tbill: components[3],
    },
  };
}
```

### Combined Risk Badge Logic

```typescript
// lib/badge.ts
type BadgeColor = 'GREEN' | 'YELLOW' | 'RED';
type HormuzStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';

// Provisional thresholds (configurable via env vars)
const TACO_LOW = Number(process.env.TACO_THRESHOLD_LOW ?? 4.0);
const TACO_HIGH = Number(process.env.TACO_THRESHOLD_HIGH ?? 7.0);

export function computeBadge(hormuz: HormuzStatus, tacoScore: number): BadgeColor {
  if (hormuz === 'UNKNOWN') return 'YELLOW'; // can't assess without data
  if (hormuz === 'CLOSED' && tacoScore >= TACO_HIGH) return 'RED';
  if (hormuz === 'CLOSED' || tacoScore >= TACO_HIGH) return 'YELLOW';
  if (tacoScore >= TACO_LOW) return 'YELLOW';
  return 'GREEN';
}
```

### Partial Failure Strategy

When a data source fails during the pipeline:
1. **Log** the error with full context (source, error type, timestamp)
2. **Use last-known-good value** from the most recent successful fetch in the DB
3. **Set `data_quality`** to `'partial'` for that day's row
4. **Track `taco_components_available`** (e.g., 3/4 if approval scrape failed)
5. **Dashboard shows** a warning icon next to stale components with "Last updated: [date]"
6. **Skill output** includes data quality: `TACO Stress: 6.2/10 (3/4 components, approval stale 3d)`

## Technical Considerations

### Visual Design System (from design review)

**Theme:** Dark monitoring dashboard (like Bloomberg/Grafana)
- Background: `#0a0a0a` (near-black)
- Surface: `#171717` (panels)
- Text primary: `#fafafa`
- Text muted: `#a1a1aa`
- Border: `#27272a` (subtle separators)

**Badge Colors:**
- GREEN: `#22c55e` bg, `#052e16` text → "LOW RISK"
- YELLOW: `#eab308` bg, `#422006` text → "ELEVATED"
- RED: `#ef4444` bg, `#450a0a` text → "HIGH RISK"
- UNKNOWN: `#6b7280` bg, `#1f2937` text → "DATA UNAVAILABLE"

**Typography:**
- Numbers/metrics: `font-mono` (JetBrains Mono or system monospace), tabular-nums
- Labels/headings: system sans-serif (Tailwind default)
- Badge text: 24px bold
- Panel headings: 18px semibold
- Metrics: 36px bold monospace
- Chart labels: 12px muted

**Charts (Recharts):**
- Hormuz transits: `#60a5fa` (blue line)
- Brent crude overlay: `#f97316` (orange line, right y-axis)
- TACO composite: `#a78bfa` (purple line)
- Grid lines: `#27272a`
- Event markers: `#525252` dashed vertical lines with `#a1a1aa` labels

**TACO Gauge:** Simple semi-circular arc
- Gradient: green (0) → yellow (5) → red (10)
- Large score number centered inside arc (36px mono bold)
- No decorative elements

**Layout:** No decorative cards, no borders on panels. Use spacing and background color to separate sections. No rounded corners on main panels. Utilitarian.

**Responsive:**
- Desktop (≥1024px): Two-panel side-by-side, charts 300px height
- Tablet (768-1023px): Two-panel side-by-side, narrower
- Mobile (<768px): Single column stacked. Charts 200px height

**Accessibility:**
- Badge colors always paired with text labels (not color-only)
- Charts have tabular data alternative for screen readers
- Min touch target: 44px
- WCAG AA contrast (4.5:1) on all badge text

### Performance
- Pipeline: 5+ parallel API fetches via `Promise.allSettled()`, worst case ~5s total
- Dashboard: SSR from Postgres, ~100-400 data points per chart, sub-second render
- Skill: Single GET to `/api/report` reading latest row from DB, sub-100ms

### Security
- FRED API key in Vercel environment variables only (never client-side)
- No user auth needed (read-only public dashboard)
- RCP scraping: respect robots.txt, use reasonable User-Agent

### Key Risks
1. **RCP scraping fragility** — HTML structure changes break approval data silently. Mitigation: validate parsed value is a reasonable percentage (30-60%), log raw HTML on parse failure, flag stale data.
2. **IMF PortWatch lag** — Transit data may lag 1-2 days. Mitigation: show explicit data date, not "last updated".
3. **War risk insurance data** — No confirmed free source. Gated: research during Phase 2, implement only if free/scrapable source found.

## System-Wide Impact

### Interaction Graph
```
Vercel Cron (21:30 UTC)
  → GET /api/cron (with CRON_SECRET header)
    → fetchPortWatch() → parse transit count → determine OPEN/CLOSED/UNKNOWN
    → fetchYahooFinance('GSPC', 'BZ=F') → parse S&P close + 30d return, Brent close
    → fetchFRED('EXPINF1YR', 'DTB3') → parse latest values
    → fetchApprovalRating() → scrape RCP → parse percentage
    → computeTacoScore(all components) → composite 0-10
    → computeBadge(hormuzStatus, tacoScore) → GREEN/YELLOW/RED
    → upsertDailyIndicator(date, allData) → Postgres
```

### Error Propagation
```
fetchPortWatch() fails → hormuz_status = 'UNKNOWN', data_quality = 'partial'
fetchYahooFinance() fails → sp500 + oil = null, use last known, data_quality = 'partial'
fetchFRED() fails → inflation + tbill = null, taco uses 2/4 components
fetchApprovalRating() fails → approval = null, taco uses 3/4 components
All fail → all null, data_quality = 'stale', badge = 'YELLOW'
DB upsert fails → pipeline retries once, then logs error (cron runs again tomorrow)
```

### State Lifecycle Risks
- **Partial day data:** Pipeline runs after market close, so S&P/T-bill data is complete for the day. Approval and PortWatch may lag. No orphaned state risk since upsert is atomic per date.
- **Backfill + daily overlap:** Backfill inserts historical rows. Daily cron upserts today's row. `ON CONFLICT (date) DO UPDATE` prevents duplicates.

## Acceptance Criteria

### Functional Requirements
- [ ] Dashboard shows combined risk badge (GREEN/YELLOW/RED) at top of page
- [ ] Hormuz panel: binary status (OPEN/CLOSED/UNKNOWN), transit count, historical chart with Brent crude overlay
- [ ] TACO panel: composite score (0-10 gauge), 4-component breakdown, historical chart back to 2025
- [ ] Event annotation markers on both historical charts
- [ ] "Status as of [date]" timestamp with data quality indicator
- [ ] Daily cron pipeline fetches all 5+ data sources and stores in Postgres
- [ ] Pipeline is idempotent (safe to re-run)
- [ ] Pipeline handles partial failures gracefully (stores partial data, uses last-known-good)
- [ ] UNKNOWN badge when Hormuz data is unavailable
- [ ] YELLOW badge + explanation when one indicator is stressed or data is partial
- [ ] Claude Code skill `/iran-indicators` prints formatted report with threshold alerts
- [ ] Historical backfill from early 2025 to present

### Non-Functional Requirements
- [ ] Dashboard loads in <3 seconds
- [ ] All data sources are free (no paid APIs)
- [ ] Cron runs daily at 21:30 UTC (after 4pm ET market close, accounting for DST)
- [ ] FRED API key stored in Vercel env vars only

### Quality Gates
- [ ] TACO formula unit tests with known historical values
- [ ] Badge logic unit tests for all Hormuz x TACO combinations
- [ ] Pipeline integration test with mocked API responses
- [ ] Empty state, error state, and stale state UI all render correctly

## Implementation Phases

### Phase 1: Foundation (~10 min with CC)
**Goal:** Forked repo, stripped, Vercel project + Postgres initialized

1. Fork `johnsmalls22-rgb/hormuz-tracker` (or clone as reference)
2. Initialize git repo in `iranian-war-indicators/`
3. Set up Next.js 16 project with Tailwind CSS 4, Recharts 3.8
4. Extract useful code from fork: PortWatch fetch logic, Recharts chart patterns, Tailwind config
5. Strip all unused components (keep: chart patterns. Remove: HormuzMap, CrisisSimulator, NavalForcesPanel, StrandedCargo, WeatherBar, BypassRoutes, CountryImpact, NewsPanel, VesselList, and related API routes)
6. Set up Vercel project, link Postgres database
7. Run schema migration (daily_indicators + event_annotations tables)
8. Create `.env.example` with: `FRED_API_KEY`, `DATABASE_URL`, `CRON_SECRET`
9. Create `CLAUDE.md` with project conventions

**Files:**
- `app/layout.tsx` — root layout
- `app/page.tsx` — dashboard page (skeleton)
- `lib/db.ts` — Postgres connection using raw `@vercel/postgres` with `sql` tagged templates (no ORM, per eng review)
- `lib/db-schema.sql` — raw SQL schema (run manually or via setup script)
- `lib/fetchers/safe-fetch.ts` — shared utility: try/catch, timeout, `{data, error}` return type (DRY across 4 fetchers)
- `.env.example`
- `CLAUDE.md`
- `vercel.json` — cron configuration

### Phase 2: Data Pipeline (~15 min with CC)
**Goal:** All data fetchers working, TACO formula implemented, cron route running

1. `lib/fetchers/portwatch.ts` — fetch IMF PortWatch daily transit count for Hormuz
2. `lib/fetchers/yahoo-finance.ts` — fetch S&P 500 (^GSPC) and Brent crude (BZ=F)
3. `lib/fetchers/fred.ts` — fetch EXPINF1YR and DTB3 from FRED API
4. `lib/fetchers/approval.ts` — scrape RealClearPolitics approval rating
5. `lib/taco.ts` — TACO composite formula (as specified above)
6. `lib/badge.ts` — combined risk badge logic
7. `lib/pipeline.ts` — orchestrate all fetches with `Promise.allSettled()`, compute scores, upsert to DB
8. `app/api/cron/route.ts` — Vercel cron handler (validates CRON_SECRET, calls pipeline)
9. `vercel.json` — configure cron schedule: `"crons": [{ "path": "/api/cron", "schedule": "30 21 * * *" }]`

**Error handling per fetcher:**
- Each fetcher returns `{ data: T | null, error: string | null }`
- Pipeline collects all results, computes what it can, flags partial data
- Upsert uses `ON CONFLICT (date) DO UPDATE`

**Files:**
- `lib/fetchers/portwatch.ts`
- `lib/fetchers/yahoo-finance.ts`
- `lib/fetchers/fred.ts`
- `lib/fetchers/approval.ts`
- `lib/taco.ts`
- `lib/badge.ts`
- `lib/pipeline.ts`
- `app/api/cron/route.ts`
- `vercel.json`

### Phase 3: Dashboard UI (~15 min with CC)
**Goal:** Full dashboard rendering from DB data

1. `app/page.tsx` — main dashboard page (Server Component, reads from Postgres)
2. `components/RiskBadge.tsx` — GREEN/YELLOW/RED badge with explanation text
3. `components/HormuzPanel.tsx` — status badge + transit count + data date
4. `components/TacoPanel.tsx` — gauge + 4-component breakdown + data quality indicators
5. `components/HistoricalChart.tsx` — reusable Recharts chart with dual axis support + event markers
6. `components/EventMarker.tsx` — annotation rendering on charts
7. `components/DataQualityIndicator.tsx` — stale/partial data warnings
8. `components/EmptyState.tsx` — "Awaiting first data run" state

**State coverage:**
- Loading: skeleton placeholders
- Empty: "Run the pipeline first" message
- Error/UNKNOWN: gray badge, "Data unavailable since [date]"
- Partial: show available data + warning icons on stale components
- Success: full dashboard with all indicators

**Files:**
- `app/page.tsx`
- `components/RiskBadge.tsx`
- `components/HormuzPanel.tsx`
- `components/TacoPanel.tsx`
- `components/HistoricalChart.tsx`
- `components/EventMarker.tsx`
- `components/DataQualityIndicator.tsx`
- `components/EmptyState.tsx`

### Phase 4: Historical Backfill (~10 min with CC)
**Goal:** Charts populated from early 2025 to present

1. `scripts/backfill.ts` — one-time script that:
   - Fetches historical S&P 500 and Brent crude from Yahoo Finance (daily data since 2025-01-20)
   - Fetches historical EXPINF1YR and DTB3 from FRED (full series)
   - Fetches historical approval data (RCP aggregate or 538 CSV for pre-March 2025)
   - Fetches historical PortWatch transit counts
   - Computes historical TACO scores for each day
   - Bulk inserts into `daily_indicators`
2. Handle weekends/holidays: skip non-trading days for market data, use last known value
3. Handle different update frequencies: EXPINF1YR is monthly, interpolate or use step function

**Files:**
- `scripts/backfill.ts`
- `package.json` — add `"backfill": "npx tsx scripts/backfill.ts"` script

### Phase 5: Claude Code Skill (~5 min with CC)
**Goal:** `/iran-indicators` skill prints formatted terminal report

1. `app/api/report/route.ts` — API endpoint returning latest indicator data as JSON
2. `.claude/commands/iran-indicators.md` — Claude Code custom slash command that:
   - Calls the Vercel deployment's `/api/report` endpoint
   - Formats the JSON into a concise terminal report
   - Adds threshold alerts when values are extreme

**Skill output format:**
```
Risk Level: YELLOW
Hormuz: CLOSED (0 transits, as of 2026-03-31)
TACO Stress: 7.3/10 (approval 36%, S&P -8.2%, inflation 3.4%, T-bill 4.1%)
WARNING: TACO stress at 7.3/10 — elevated since Liberation Day
WARNING: Hormuz closed for 32 consecutive days
Oil: Brent $94.20 (+18% 30d)
Data quality: 4/4 components current
```

**Threshold alert rules (hardcoded, configurable later):**
- Hormuz transits < 10 → "WARNING: Hormuz transits critically low"
- Hormuz CLOSED for > 7 days → "WARNING: Hormuz closed for N consecutive days"
- TACO score > 7.0 → "WARNING: TACO stress elevated"
- TACO score > 9.0 → "CRITICAL: TACO stress at extreme levels"
- Oil price 30d change > 20% → "WARNING: Oil price surging"

**Files:**
- `app/api/report/route.ts`
- `.claude/commands/iran-indicators.md`

### Phase 6: Polish & Deploy (~5 min with CC)
**Goal:** Production-ready deployment

1. Add event annotation seed data to DB
2. Test all error states (mock each API failure)
3. Test empty state (fresh DB)
4. Deploy to Vercel
5. Run backfill script against production DB
6. Verify cron fires and stores data
7. Run `/iran-indicators` skill to verify end-to-end

**Files:**
- No new files; testing and deployment

## Alternative Approaches Considered

1. **Build entirely from scratch** — rejected because the fork's PortWatch integration and Recharts patterns save meaningful time. (see origin: CEO review approach decision)
2. **Skill-only, no dashboard** — rejected by user. The visual charts and combined badge provide value beyond the terminal report.
3. **Python + Streamlit** — rejected in brainstorm. Next.js + Vercel provides cleaner deployment, cron integration, and modern frontend.

## Dependencies & Prerequisites

- Vercel account (free tier sufficient)
- FRED API key (free registration at fred.stlouisfed.org)
- Mapbox token NOT needed (we're stripping the map component)
- Node.js 20+ (for Next.js 16)
- RealClearPolitics must remain scrapable (fragile dependency)

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| RCP scraping breaks | High | Medium | Validate parsed values, fall back to last known, alert via skill |
| PortWatch data lag > 2 days | Medium | Medium | Show explicit data date, not "last updated" |
| FRED API key expires | Low | High | Validate key on startup, log explicit error |
| Yahoo Finance rate limits | Low | Low | Exponential backoff, max 3 retries |
| Fork code is unusable | Medium | Low | Already planning to extract selectively, not wholesale adopt |
| War risk data unavailable | High | Low | Feature gated, deferred to Phase 2 if no free source |

## Future Considerations

- **Phase 2:** Detailed tanker tracking (vessel types, sizes, flagging)
- **Phase 3:** War risk insurance premiums, port congestion data
- **Real-time:** AISStream WebSocket for live vessel positions (fork already has this)
- **Alerts:** Email/push notifications when indicators cross thresholds
- **ML:** Regime change detection, predictive modeling

## Test Specifications

**Framework:** Vitest (add to devDependencies: `vitest`, `@testing-library/react`)

### Unit Tests: `lib/__tests__/taco.test.ts`
| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | All components present | approval:38, sp500:-0.08, inflation:0.031, tbill:0.04 | Score ~5.5, components:4 |
| 2 | One component null | approval:null, rest present | Score computed from 3, components:3 |
| 3 | All null | all null | Score:0, components:0 |
| 4 | Values at min bounds | approval:55, sp500:0, inflation:0.02, tbill:0.03 | Score:0.0 (all stress=0) |
| 5 | Values at max bounds | approval:30, sp500:-0.25, inflation:0.06, tbill:0.06 | Score:10.0 (all stress=10) |
| 6 | Values outside bounds (clamped) | approval:20, sp500:-0.40 | Components clamped to 10 |
| 7 | Inverted bounds correct | approval:30 (low) = stress 10, approval:55 (high) = stress 0 | Verify direction |

### Unit Tests: `lib/__tests__/badge.test.ts`
| # | Test Case | Hormuz | TACO | Expected Badge |
|---|-----------|--------|------|----------------|
| 1 | All clear | OPEN | 2.0 | GREEN |
| 2 | TACO moderate | OPEN | 5.0 | YELLOW |
| 3 | TACO high, Hormuz open | OPEN | 8.0 | YELLOW |
| 4 | Hormuz closed, TACO low | CLOSED | 3.0 | YELLOW |
| 5 | Both alarming | CLOSED | 8.0 | RED |
| 6 | Data unavailable | UNKNOWN | 5.0 | YELLOW |

### Integration Tests: `lib/__tests__/pipeline.test.ts`
| # | Test Case | Setup | Expected |
|---|-----------|-------|----------|
| 1 | Happy path | Mock all fetchers succeed | Complete row, quality:'complete' |
| 2 | Partial failure | Mock 1 fetcher fail | Partial row, quality:'partial', taco 3/4 |
| 3 | All fail | Mock all fetchers fail | All null, quality:'stale' |
| 4 | Idempotent | Run pipeline twice same date | One row (upsert) |
| 5 | Parse validation | Mock fetcher returns NaN | Treated as null, logged |

### API Route Tests: `app/api/__tests__/cron.test.ts`
| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Valid CRON_SECRET | 200, pipeline runs |
| 2 | Invalid CRON_SECRET | 401 |
| 3 | Pipeline throws | 500, error logged |

### API Route Tests: `app/api/__tests__/report.test.ts`
| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Data exists | JSON with all fields |
| 2 | No data | Empty state response |
| 3 | Stale data | Includes staleness warning |

### Fetcher Tests: `lib/fetchers/__tests__/*.test.ts`
Each fetcher: happy path + API down + parse error (3 tests each, 12 total)

**Total: 26 test cases across 6 test files**

## Documentation Plan

- `CLAUDE.md` — project conventions, data sources, TACO formula, cron timing
- `README.md` — setup instructions, env vars, deployment
- `.env.example` — required environment variables

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-04-01-iranian-war-indicators-requirements.md](docs/brainstorms/2026-04-01-iranian-war-indicators-requirements.md) — Key decisions: fork approach, 4-component TACO, free data sources, Vercel deployment, phased Hormuz
- **CEO plan:** [~/.gstack/projects/iranian-war-indicators/ceo-plans/2026-04-01-iranian-war-indicators.md] — 6 accepted scope expansions (oil overlay, skill alerts, insurance gated, event markers, backfill, combined badge)

### Internal References

- Upstream fork: [github.com/johnsmalls22-rgb/hormuz-tracker](https://github.com/johnsmalls22-rgb/hormuz-tracker) — MIT license, Next.js 16, Recharts 3.8, PortWatch integration
- Video summary: `C:\Users\dunliu\Downloads\iranian war indicator.md`

### External References

- IMF PortWatch Hormuz dataset: [portwatch.imf.org](https://portwatch.imf.org/datasets/42132aa4e2fc4d41bdaf9a445f688931_0/about)
- FRED EXPINF1YR: [fred.stlouisfed.org/series/EXPINF1YR](https://fred.stlouisfed.org/series/EXPINF1YR)
- FRED DTB3: [fred.stlouisfed.org/series/DTB3](https://fred.stlouisfed.org/series/DTB3)
- Deutsche Bank TACO methodology: [France24](https://www.france24.com/en/economy/20260327-financial-analysts-move-to-counter-trump-middle-east-war-uncertainty-with-taco-index), [Yahoo Finance](https://finance.yahoo.com/economy/policy/articles/wall-street-actually-came-index-221355598.html)
- RealClearPolling: [realclearpolling.com/polls/approval/donald-trump/approval-rating](https://www.realclearpolling.com/polls/approval/donald-trump/approval-rating)
- WTO Hormuz Trade Tracker: [datalab.wto.org](https://datalab.wto.org/Strait-of-Hormuz-Trade-Tracker)

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAN | 6 proposals, 6 accepted, 0 deferred |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAN | 1 issue (ORM), 3 critical gaps (parse errors) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAN | score: 5/10 → 8/10, 5 decisions |

- **UNRESOLVED:** 0
- **VERDICT:** CEO + ENG + DESIGN CLEARED — ready to implement
