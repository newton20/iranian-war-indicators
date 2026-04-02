---
date: 2026-04-01
topic: iranian-war-indicators
---

# Iranian War Indicators Dashboard

## Problem Frame

During the current Iran/Middle East crisis, mainstream media and political signals are unreliable for assessing actual risk. Two key indicators cut through the noise: (1) whether ships are physically transiting the Strait of Hormuz (the "heartbeat" of global energy supply), and (2) whether the TACO pattern ("Trump Always Caves") — the market's assumption that political leaders will back down under domestic pressure — is still holding or has broken. A daily automated pipeline and dashboard would replace the need to manually check scattered sources and provide a clear, at-a-glance risk assessment.

Source: YouTube video analysis (summary at `C:\Users\dunliu\Downloads\iranian war indicator.md`).

## Requirements

### Indicator 1: Strait of Hormuz Shipping (Phase 1: Binary Signal)

- R1. Fetch daily AIS vessel transit data for the Strait of Hormuz from a free, public source
- R2. Produce a binary signal: OPEN (ships transiting) or CLOSED (no transits detected)
- R3. Display daily transit count alongside the binary signal
- R4. Store historical data to show trends over time

### Indicator 2: TACO Stress Index

Based on Deutsche Bank strategist Maximilian Uleer's "Trump Stress Index" — four components measuring "maximum pain tolerance of the administration":

- R5. **Presidential Approval Ratings**: Fetch aggregated polling data from RealClearPolitics or Gallup (NOTE: FiveThirtyEight dissolved March 2025, CSV is stale). Fallback: Silver Bulletin (Nate Silver)
- R6. **Stock Market Performance**: Fetch S&P 500 data via Yahoo Finance (symbol: ^GSPC). 1-month drawdown = percentage change from closing price 30 calendar days ago to today's close
- R7. **Inflation Expectations**: Fetch 1-Year Expected Inflation Rate from FRED API (series: EXPINF1YR)
- R7b. **Treasury Yields**: Fetch T-bill yield data from FRED API
- R8. Compute a composite TACO Stress score (0-10 scale) from the four components using equal weights (25% each). Each component normalized to 0-10 using these bounds:
  - Approval: 55% (stress=0) to 30% (stress=10), inverted
  - S&P 500 30-day return: 0% (stress=0) to -25% (stress=10), inverted
  - 1Y Inflation Expectations: 2.0% (stress=0) to 6.0% (stress=10)
  - 3-Month T-bill Yield: 3.0% (stress=0) to 6.0% (stress=10)
  - Values outside bounds clamped to 0 or 10
  - Higher composite = more domestic pressure = TACO pattern at greater risk of breaking (policy reversal more likely)
- R9. Store historical data for all four components and the composite score
- R9b. **Historical backfill**: Reconstruct TACO composite from early 2025 to present using historical data from FRED/Yahoo/FiveThirtyEight

### Dashboard

- R10. Next.js app deployed on Vercel showing both indicators on a single page
- R10b. **Combined risk badge** at top of page: GREEN (Hormuz open + TACO low), YELLOW (one indicator stressed), RED (Hormuz closed + TACO broken)
- R11. Hormuz section: binary status badge (OPEN/CLOSED), daily transit count, historical chart with **Brent crude oil price overlay**
- R11b. **War risk insurance premium** data series on Hormuz panel (gated on finding a free data source; if unavailable, deferred to Phase 2)
- R12. TACO section: composite stress score with gauge/meter, breakdown of four components, historical chart with **backfill from early 2025**
- R12b. **Event annotation markers** on historical charts. Hardcoded JSON config of 3-5 seed events (e.g., "2026-02-28: Strait closed", "2025-04-02: Liberation Day tariffs"). No dynamic management UI in Phase 1
- R13. Auto-refresh or show "last updated" timestamp

### Pipeline

- R14. Daily automated data collection via Vercel Cron Jobs
- R15. Data stored in a lightweight database (Vercel Postgres or Turso/SQLite)
- R16. Pipeline must be idempotent — safe to re-run without duplicating data

### Claude Code Skill

- R17. Skill invokable as `/iran-indicators` that runs the pipeline and prints a concise terminal report
- R18. Report format: `Hormuz: OPEN/CLOSED (N transits today), TACO Stress: X.X/10 (approval XX%, S&P X.X%, inflation X.X%, T-bill X.X%)`
- R18b. **Threshold alerts**: Flag when indicators cross critical thresholds (e.g., "WARNING: Hormuz transits dropped below 10", "TACO stress at 8.5/10 — highest since Liberation Day")

## Success Criteria

- Both indicators update daily without manual intervention
- Dashboard loads in <3 seconds and clearly communicates risk status at a glance
- The Claude Code skill produces an accurate, current report when invoked
- All data sources are free and automatable

## Scope Boundaries

- Phase 1 only: binary Hormuz signal (no vessel type breakdown, no insurance data)
- No predictive modeling or AI analysis — just data collection and display
- No push notifications or email alerts in Phase 1 (terminal-output threshold warnings in the skill ARE in scope)
- No mobile-specific design (responsive is fine, but not a native app)
- TACO score formula will start with a simple weighted average of 4 components; can be refined later
- War risk insurance premium gated on finding a free data source; deferred to Phase 2 if unavailable

## Key Decisions

- **Tech stack**: Next.js + Vercel (cron jobs, Postgres, deployment)
- **All free data sources**: RealClearPolitics/Gallup for polling (538 dissolved March 2025), Yahoo Finance for S&P + Brent crude (continuous series), FRED for 1Y inflation expectations (EXPINF1YR) + T-bill yields (DTB3), public AIS via fork for shipping
- **Implementation approach**: Fork johnsmalls22-rgb/hormuz-tracker (existing open-source Next.js Hormuz dashboard), strip to binary signal, extend with TACO panel and pipeline
- **TACO uses 4 components** (matching Deutsche Bank's actual methodology): approval ratings, S&P 500, 1Y inflation expectations, T-bill yields
- **Phased Hormuz approach**: Phase 1 (binary), Phase 2 (detailed tanker tracking), Phase 3 (full maritime intelligence)
- **Skill outputs text report with threshold alerts**: No browser opening, no AI analysis — formatted data with warnings when values are extreme

## Dependencies / Assumptions

- Free AIS data source exists that covers Strait of Hormuz transits (needs validation during planning). Fallback: MarineTraffic paid tier (~$49/mo) or UNCTAD weekly summary reports as proxy
- FRED API key is free to obtain (confirmed: free registration at fred.stlouisfed.org)
- FiveThirtyEight dissolved March 2025; use RealClearPolitics or Gallup for approval data. Fallback: Silver Bulletin (Nate Silver)
- Vercel Hobby cron limited to once/day (sufficient). Postgres Hobby limit 256 MB; estimate ~1 KB/day/series = ~1.8 MB/year, well within limits
- Brent crude oil from Yahoo Finance (symbol: BZ=F)

## Outstanding Questions

### Resolve Before Planning

(None — all product decisions resolved)

### Deferred to Planning

- [Affects R1][Needs research] Verify fork's AIS data source still works. If not, evaluate: MarineTraffic paid tier, WTO Trade Tracker, UNCTAD
- [Affects R5][Needs research] Best scraping approach for RealClearPolitics or Gallup approval data — which is more stable/scrapable? (538 is dissolved)
- [Affects R6][Needs research] Find continuous Brent crude series on Yahoo Finance to avoid futures roll artifacts
- [Affects R11][Needs research] Free/scrapable source for war risk insurance premiums (Lloyd's, maritime insurance indices)
- [Affects R14][Technical] Cron timing: must run after 4pm ET (US market close). Specify exact UTC time accounting for DST
- [Affects R10b][Technical] Define numeric thresholds for GREEN/YELLOW/RED combined badge — tune after seeing backfilled data
- [Affects R15][Technical] Vercel Postgres vs Turso for the data store — cost and complexity tradeoffs at free tier
- [Affects R17][Technical] Skill implementation: Claude Code custom skill format and how to trigger the pipeline from CLI

## Next Steps

All product decisions resolved. Ready for structured implementation planning.

`/ce:plan` for structured implementation planning
