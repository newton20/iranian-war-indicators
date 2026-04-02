# TODOS

## ~~P2: Calibrate TACO normalization bounds against backfilled data~~ DONE (2026-04-02)
Calibrated against 303 days of backfilled data. Tightened S&P (0 to -15%), inflation (2-4%), T-bill (3-5%). Liberation Day peak panic now scores 6.5/10 (was 3.88). Matches Deutsche Bank's characterization.

## P3: Pipeline integration tests
**What:** Add 5 integration test cases for pipeline.ts (per eng review test specs): happy path, partial failure, all fail, idempotent, parse validation.
**Why:** Pipeline is the core data path. Currently untested beyond the TACO/badge unit tests.
**Effort:** S / S
**Depends on:** None

## P3: Parse error handling for fetchers
**What:** Add validation + logging for format changes in PortWatch, FRED, and RCP fetchers (3 critical gaps from eng review).
**Why:** Silent data corruption if any API changes its response format.
**Effort:** S / S
**Depends on:** None
