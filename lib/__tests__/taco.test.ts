import { describe, it, expect } from 'vitest'
import { computeTacoScore } from '@/lib/taco'

describe('computeTacoScore', () => {
  it('computes score with all components present', () => {
    // approval:38 → (55-38)/(55-30)*10 = 6.8
    // sp500:-0.08 → (0-(-0.08))/(0-(-0.15))*10 = 5.33
    // inflation:0.031 → (0.031-0.02)/(0.04-0.02)*10 = 5.5
    // tbill:0.04 → (0.04-0.03)/(0.05-0.03)*10 = 5.0
    // avg = (6.8+5.33+5.5+5.0)/4 = 5.66
    const result = computeTacoScore({
      approval: 38,
      sp500Return: -0.08,
      inflation1y: 0.031,
      tbill3m: 0.04,
    })

    expect(result.componentsAvailable).toBe(4)
    expect(result.score).toBeCloseTo(5.66, 1)
  })

  it('handles one null component', () => {
    const result = computeTacoScore({
      approval: null,
      sp500Return: -0.08,
      inflation1y: 0.031,
      tbill3m: 0.04,
    })

    expect(result.componentsAvailable).toBe(3)
    expect(result.breakdown.approval).toBeNull()
    // avg of (5.33 + 5.5 + 5.0) / 3 = 5.28
    expect(result.score).toBeCloseTo(5.28, 1)
  })

  it('handles all null components', () => {
    const result = computeTacoScore({
      approval: null,
      sp500Return: null,
      inflation1y: null,
      tbill3m: null,
    })

    expect(result.score).toBe(0)
    expect(result.componentsAvailable).toBe(0)
  })

  it('returns score 0 when all values are at min bounds', () => {
    const result = computeTacoScore({
      approval: 55,
      sp500Return: 0,
      inflation1y: 0.02,
      tbill3m: 0.03,
    })

    expect(result.score).toBe(0)
  })

  it('returns score 10 when all values are at max bounds', () => {
    // New bounds: sp500 max=-0.15, inflation max=0.04, tbill max=0.05
    const result = computeTacoScore({
      approval: 30,
      sp500Return: -0.15,
      inflation1y: 0.04,
      tbill3m: 0.05,
    })

    expect(result.score).toBe(10)
  })

  it('clamps values outside bounds to 10', () => {
    const result = computeTacoScore({
      approval: 20,
      sp500Return: -0.4,
      inflation1y: null,
      tbill3m: null,
    })

    expect(result.breakdown.approval).toBe(10)
    expect(result.breakdown.sp500).toBe(10)
    expect(result.score).toBe(10)
  })

  it('inverts approval so lower value means higher stress', () => {
    const lowApproval = computeTacoScore({
      approval: 30, sp500Return: null, inflation1y: null, tbill3m: null,
    })
    const highApproval = computeTacoScore({
      approval: 55, sp500Return: null, inflation1y: null, tbill3m: null,
    })

    expect(lowApproval.breakdown.approval).toBe(10)
    expect(highApproval.breakdown.approval).toBeCloseTo(0, 5)
  })
})
