/**
 * TACO Stress Index
 * Computes a composite 0-10 stress score from political and economic indicators.
 */

export interface TacoInput {
  approval: number | null;
  sp500Return: number | null;
  inflation1y: number | null;
  tbill3m: number | null;
}

export interface TacoResult {
  score: number;
  componentsAvailable: number;
  breakdown: {
    approval: number | null;
    sp500: number | null;
    inflation: number | null;
    tbill: number | null;
  };
}

const BOUNDS = {
  approval: { min: 55, max: 30 },
  sp500: { min: 0, max: -0.25 },
  inflation: { min: 0.02, max: 0.06 },
  tbill: { min: 0.03, max: 0.06 },
} as const;

/**
 * Clamp a value between min and max bounds, then scale to 0-10.
 * When min > max (e.g. approval where lower is worse), the direction is inverted.
 */
function normalize(
  value: number,
  bounds: { min: number; max: number }
): number {
  const { min, max } = bounds;
  const clamped = max > min
    ? Math.max(min, Math.min(max, value))
    : Math.max(max, Math.min(min, value));
  const ratio = (clamped - min) / (max - min);
  return ratio * 10;
}

export function computeTacoScore(input: TacoInput): TacoResult {
  const breakdown: TacoResult["breakdown"] = {
    approval: null,
    sp500: null,
    inflation: null,
    tbill: null,
  };

  const scores: number[] = [];

  if (input.approval !== null) {
    const s = normalize(input.approval, BOUNDS.approval);
    breakdown.approval = s;
    scores.push(s);
  }

  if (input.sp500Return !== null) {
    const s = normalize(input.sp500Return, BOUNDS.sp500);
    breakdown.sp500 = s;
    scores.push(s);
  }

  if (input.inflation1y !== null) {
    const s = normalize(input.inflation1y, BOUNDS.inflation);
    breakdown.inflation = s;
    scores.push(s);
  }

  if (input.tbill3m !== null) {
    const s = normalize(input.tbill3m, BOUNDS.tbill);
    breakdown.tbill = s;
    scores.push(s);
  }

  const score =
    scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

  return {
    score: Math.round(score * 100) / 100,
    componentsAvailable: scores.length,
    breakdown,
  };
}
