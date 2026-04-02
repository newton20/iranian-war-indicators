import { describe, it, expect } from 'vitest'
import { computeBadge } from '@/lib/badge'

describe('computeBadge', () => {
  it('returns GREEN for OPEN + low TACO score', () => {
    expect(computeBadge('OPEN', 2.0)).toBe('GREEN')
  })

  it('returns YELLOW for OPEN + moderate TACO score', () => {
    expect(computeBadge('OPEN', 5.0)).toBe('YELLOW')
  })

  it('returns YELLOW for OPEN + high TACO score', () => {
    expect(computeBadge('OPEN', 8.0)).toBe('YELLOW')
  })

  it('returns YELLOW for CLOSED + low TACO score', () => {
    expect(computeBadge('CLOSED', 3.0)).toBe('YELLOW')
  })

  it('returns RED for CLOSED + high TACO score', () => {
    expect(computeBadge('CLOSED', 8.0)).toBe('RED')
  })

  it('returns YELLOW for UNKNOWN status regardless of TACO score', () => {
    expect(computeBadge('UNKNOWN', 5.0)).toBe('YELLOW')
  })
})
