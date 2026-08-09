import { describe, expect, it } from 'vitest'
import {
  addCalendarDays,
  canRecordCycleDate,
  enumerateLocalDates,
  getCycleEndDate,
  isLocalDate,
  nextLocalDate,
  toLocalDate,
} from './dates'
import { makeCycle } from './testUtils'

describe('domain dates', () => {
  it('adds calendar days across month, year, and leap-day boundaries', () => {
    expect(getCycleEndDate('2026-01-29')).toBe('2026-02-04')
    expect(getCycleEndDate('2026-12-29')).toBe('2027-01-04')
    expect(addCalendarDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addCalendarDays('2024-02-29', 1)).toBe('2024-03-01')
  })

  it('uses calendar dates instead of fixed 24-hour arithmetic around DST examples', () => {
    expect(addCalendarDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addCalendarDays('2026-11-01', 1)).toBe('2026-11-02')
  })

  it('formats local dates without slicing UTC strings', () => {
    expect(toLocalDate(new Date('2026-08-09T23:30:00-07:00'))).toBe('2026-08-10')
  })

  it('validates and enumerates local dates', () => {
    expect(isLocalDate('2026-02-29')).toBe(false)
    expect(isLocalDate('2024-02-29')).toBe(true)
    expect(enumerateLocalDates('2026-08-09', '2026-08-11')).toEqual([
      '2026-08-09',
      '2026-08-10',
      '2026-08-11',
    ])
    expect(nextLocalDate('2026-12-31')).toBe('2027-01-01')
  })

  it('allows records through the cycle end date but not the future or reviewed cycles', () => {
    const cycle = makeCycle({ startDate: '2026-08-09', endDate: '2026-08-15', status: 'active' })

    expect(canRecordCycleDate(cycle, '2026-08-15', '2026-08-15')).toBe(true)
    expect(canRecordCycleDate(cycle, '2026-08-16', '2026-08-16')).toBe(false)
    expect(canRecordCycleDate(cycle, '2026-08-12', '2026-08-11')).toBe(false)
    expect(canRecordCycleDate({ ...cycle, status: 'reviewed' }, '2026-08-12', '2026-08-20')).toBe(
      false,
    )
  })
})
