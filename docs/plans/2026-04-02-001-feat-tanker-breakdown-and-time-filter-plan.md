---
title: "feat: Vessel type breakdown + time range filter"
type: feat
status: active
date: 2026-04-02
origin: docs/brainstorms/2026-04-01-iranian-war-indicators-requirements.md
---

# Vessel Type Breakdown + Time Range Filter

## Overview

Two enhancements to the Iranian War Indicators dashboard:
1. **Phase 2 Hormuz: Vessel type breakdown** — Show tanker, container, dry bulk, and other vessel counts instead of just the total. This was planned as Phase 2 in the original requirements.
2. **Time range filter** — Let users select a time window (7d, 30d, 90d, 1y, All) for the historical charts.

## Problem Statement

The current dashboard shows only total vessel transits (`n_total`). Users can't see whether it's oil tankers or container ships that stopped moving — a critical distinction since oil tanker traffic is what matters for the energy supply thesis. Additionally, the charts always show the full year of data with no way to zoom into recent events.

## Proposed Solution

### Feature 1: Vessel Type Breakdown

**Data source:** The PortWatch API already returns per-type counts. Current URL only requests `date,n_total`. Expand to include:
- `n_tanker` — oil/chemical tankers (most relevant for Hormuz energy thesis)
- `n_container` — container ships
- `n_dry_bulk` — dry bulk carriers
- `n_general_cargo` — general cargo
- `n_roro` — roll-on/roll-off

**Database:** Add columns to `daily_indicators`:
```sql
ALTER TABLE daily_indicators ADD COLUMN IF NOT EXISTS n_tanker INTEGER;
ALTER TABLE daily_indicators ADD COLUMN IF NOT EXISTS n_container INTEGER;
ALTER TABLE daily_indicators ADD COLUMN IF NOT EXISTS n_dry_bulk INTEGER;
ALTER TABLE daily_indicators ADD COLUMN IF NOT EXISTS n_cargo INTEGER;
```

**UI:** Replace the single "5 vessels in transit" number with a breakdown:
```
  Strait of Hormuz                    OPEN
  5 vessels in transit
  ┌─────────────────────────────────┐
  │ Tankers  2  ████████            │
  │ Container 1  ████               │
  │ Dry Bulk  1  ████               │
  │ Other     1  ████               │
  └─────────────────────────────────┘
```
Small horizontal bar chart or stat row showing each type. Tankers highlighted since they're the energy-relevant metric.

**Transit chart update:** Option to toggle between "Total" and "Tankers Only" view on the transit trend chart (since tanker traffic is the energy signal).

### Feature 2: Time Range Filter

**Approach:** Client-side filtering. The page already fetches 365 days of history. Add a row of time range buttons above the charts:

```
  [ 7D ] [ 30D ] [ 90D ] [ 1Y ] [ ALL ]
```

When clicked, filter the `history` array to only include the last N days. This is purely a client-side state change — no new API calls needed (365 days covers all options).

**Scope:** The filter applies to ALL charts simultaneously (Hormuz transits, oil price, TACO composite). One shared filter state.

**Implementation:** 
- Add `TimeRangeFilter` component (row of buttons with active state)
- Convert `app/page.tsx` to use a client wrapper for the filter state, keeping data fetching as server component
- Pass filtered history to both panels

## Technical Approach

### Files to modify:

**Feature 1 (vessel types):**
- `lib/fetchers/portwatch.ts` — expand `outFields` to include `n_tanker,n_container,n_dry_bulk,n_general_cargo,n_roro`
- `lib/db.ts` — add vessel type fields to `DailyIndicator` interface and `upsertDailyIndicator`
- `lib/pipeline.ts` — pass vessel type data through to DB
- `components/HormuzPanel.tsx` — add vessel type breakdown display
- `components/VesselBreakdown.tsx` — new component: horizontal bar breakdown
- `scripts/backfill-portwatch.ts` — update to also fetch and store vessel type data

**Feature 2 (time filter):**
- `components/TimeRangeFilter.tsx` — new component: button row
- `components/DashboardClient.tsx` — new client wrapper holding filter state
- `app/page.tsx` — refactor to use DashboardClient for interactivity
- `components/HormuzPanel.tsx` — accept filtered history
- `components/TacoPanel.tsx` — accept filtered history

**Migration:**
- `scripts/migrate-vessel-types.ts` — ALTER TABLE to add new columns

### Implementation Order:

1. **DB migration** — add columns (~2 min)
2. **PortWatch fetcher update** — expand fields, update types (~5 min)
3. **Pipeline + DB update** — wire vessel types through pipeline to DB (~5 min)
4. **VesselBreakdown component** — horizontal bar display (~5 min)
5. **HormuzPanel update** — integrate breakdown (~3 min)
6. **TimeRangeFilter component** — button row with state (~5 min)
7. **DashboardClient wrapper** — client component managing filter state (~5 min)
8. **Backfill vessel types** — re-run PortWatch backfill with new fields (~3 min)
9. **Tests** — update existing + add new for vessel types (~5 min)

**Total: ~40 min with CC**

## Acceptance Criteria

- [ ] Hormuz panel shows vessel type breakdown (tankers, containers, dry bulk, other)
- [ ] Tanker count highlighted as the energy-relevant metric
- [ ] Time range buttons (7D, 30D, 90D, 1Y, ALL) filter all charts simultaneously
- [ ] Active time range button is visually highlighted
- [ ] Default time range is 1Y (current behavior)
- [ ] Historical data backfilled with vessel type breakdown
- [ ] Pipeline stores vessel type data daily going forward
- [ ] Existing tests still pass + new tests for vessel breakdown

## Dependencies & Risks

- **PortWatch API fields:** Confirmed available (`n_tanker`, `n_container`, `n_dry_bulk`, `n_general_cargo`, `n_roro`) from earlier investigation
- **Client-side filtering:** No API changes needed for time filter — data already fetched
- **DB migration:** Non-breaking (ADD COLUMN with NULL default)

## Sources

- **Origin document:** [docs/brainstorms/2026-04-01-iranian-war-indicators-requirements.md](docs/brainstorms/2026-04-01-iranian-war-indicators-requirements.md) — Phase 2: "Detailed tanker tracking (vessel types, sizes, flagging)"
- **PortWatch API fields:** Confirmed in earlier investigation (n_tanker, n_container, n_dry_bulk, n_general_cargo, n_roro, plus capacity_* fields)
- **Existing patterns:** `components/HormuzPanel.tsx`, `lib/fetchers/portwatch.ts`, `components/HistoricalChart.tsx`

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAN | 1 issue (toggle→dual-line), 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — ready to implement
- **Eng review note:** Use dual-line chart (total + tankers) instead of toggle button
