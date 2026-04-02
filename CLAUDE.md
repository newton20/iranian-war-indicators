# Iranian War Indicators Dashboard

## Project

Geopolitical risk dashboard combining Strait of Hormuz shipping status + TACO Stress Index. Next.js 16 + Tailwind CSS 4 + Recharts 3.8, deployed on Vercel with Neon Postgres.

## Stack

- **Framework:** Next.js 16 (App Router, Server Components)
- **Styling:** Tailwind CSS 4 (dark theme, CSS-first config)
- **Charts:** Recharts 3.8
- **Database:** Neon Postgres via `@neondatabase/serverless` (raw SQL, no ORM)
- **Deployment:** Vercel (cron at 21:30 UTC daily)
- **Tests:** Vitest

## Data Sources

| Data | Source | Key? |
|------|--------|------|
| Hormuz transits | IMF PortWatch | No |
| S&P 500 | Yahoo Finance (^GSPC) | No |
| Brent crude | Yahoo Finance (BZ=F) | No |
| 1Y Inflation | FRED (EXPINF1YR) | Yes |
| T-bill yield | FRED (DTB3) | Yes |
| Approval rating | RealClearPolitics scrape | No |

## TACO Formula

4-component composite, equal weights (25% each), normalized 0-10:
- Approval: 55% (stress=0) to 30% (stress=10), inverted
- S&P 30d return: 0% (stress=0) to -25% (stress=10), inverted
- 1Y Inflation: 2% (stress=0) to 6% (stress=10)
- T-bill: 3% (stress=0) to 6% (stress=10)

## Conventions

- Use `font-mono font-tabular` for all numbers/metrics
- All fetchers use `lib/fetchers/safe-fetch.ts` pattern returning `{data, error}`
- Dark theme only: bg `#0a0a0a`, surface `#171717`, text `#fafafa`
- Cron route validates `CRON_SECRET` header before running pipeline
- Database queries use raw `neon()` tagged templates, no ORM

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npx vitest           # Run tests
npx tsx scripts/backfill.ts  # One-time historical data backfill
```
