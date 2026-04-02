import { describe, it, expect } from 'vitest'
import { computeTacoScore } from '@/lib/taco'

describe('computeTacoScore', () => {
  it('computes score with all components present', () => {
    const result = computeTacoScore({
      approval: 38,
      sp500Return: -0.08,
      inflation1y: 0.031,
      tbill3m: 0.04,
    })

    expect(result.componentsAvailable).toBe(4)
    expect(result.score).toBeCloseTo(4.02, 1)
    expect(result.breakdown.approval).toBeCloseTo(6.8, 5)
    expect(result.breakdown.sp500).toBeCloseTo(3.2, 5)
    expect(result.breakdown.inflation).toBeCloseTo(2.75, 5)
    expect(result.breakdown.tbill).toBeCloseTo(3.33, 1)
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
    expect(result.score).toBeCloseTo(3.09, 1)
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
    expect(result.breakdown.approval).toBeNull()
    expect(result.breakdown.sp500).toBeNull()
    expect(result.breakdown.inflation).toBeNull()
    expect(result.breakdown.tbill).toBeNull()
  })

  it('returns score 0 when all values are at min bounds', () => {
    const result = computeTacoScore({
      approval: 55,
      sp500Return: 0,
      inflation1y: 0.02,
      tbill3m: 0.03,
    })

    expect(result.score).toBe(0)
    expect(result.breakdown.approval).toBeCloseTo(0, 5)
    expect(result.breakdown.sp500).toBeCloseTo(0, 5)
    expect(result.breakdown.inflation).toBeCloseTo(0, 5)
    expect(result.breakdown.tbill).toBeCloseTo(0, 5)
  })

  it('returns score 10 when all values are at max bounds', () => {
    const result = computeTacoScore({
      approval: 30,
      sp500Return: -0.25,
      inflation1y: 0.06,
      tbill3m: 0.06,
    })

    expect(result.score).toBe(10)
    expect(result.breakdown.approval).toBe(10)
    expect(result.breakdown.sp500).toBe(10)
    expect(result.breakdown.inflation).toBe(10)
    expect(result.breakdown.tbill).toBe(10)
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
      approval: 30,
      sp500Return: null,
      inflation1y: null,
      tbill3m: null,
    })

    const highApproval = computeTacoScore({
      approval: 55,
      sp500Return: null,
      inflation1y: null,
      tbill3m: null,
    })

    expect(lowApproval.breakdown.approval).toBe(10)
    expect(highApproval.breakdown.approval).toBeCloseTo(0, 5)
  })
})
