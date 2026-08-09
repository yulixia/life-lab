import { describe, expect, it } from 'vitest'
import {
  selectCycleCounts,
  selectCycleDay,
  selectLatestDecision,
  selectLibraryItems,
  selectOpenCycleByTrack,
  selectRecentEnergy,
  selectTopFeelingTags,
} from './selectors'
import { DomainError } from './types'
import { makeCycle, makeItem, makeState } from './testUtils'

describe('domain selectors', () => {
  it('filters and sorts library items by status priority and updated time', () => {
    const state = makeState({
      items: [
        makeItem({
          id: 'old-active',
          status: 'active',
          track: 'ideal_self',
          updatedAt: '2026-08-08T00:00:00.000Z',
        }),
        makeItem({
          id: 'review',
          status: 'review_due',
          track: 'side_hustle',
          updatedAt: '2026-08-01T00:00:00.000Z',
        }),
        makeItem({
          id: 'new-exploring',
          status: 'exploring',
          track: 'ideal_self',
          updatedAt: '2026-08-10T00:00:00.000Z',
        }),
      ],
    })

    expect(selectLibraryItems(state).map((item) => item.id)).toEqual([
      'review',
      'old-active',
      'new-exploring',
    ])
    expect(selectLibraryItems(state, 'ideal_self').map((item) => item.id)).toEqual([
      'old-active',
      'new-exploring',
    ])
    expect(selectLibraryItems(state, 'all', 'review_due').map((item) => item.id)).toEqual(['review'])
  })

  it('selects the unique open cycle by track and reports corrupt duplicates', () => {
    const item = makeItem()
    const openCycle = makeCycle()
    const state = makeState({ items: [item], cycles: [openCycle] })

    expect(selectOpenCycleByTrack(state, 'ideal_self')).toBe(openCycle)
    expect(selectOpenCycleByTrack(state, 'side_hustle')).toBeNull()
    expect(() =>
      selectOpenCycleByTrack(
        makeState({
          items: [item],
          cycles: [openCycle, makeCycle({ id: 'cycle-2' })],
        }),
        'ideal_self',
      ),
    ).toThrowError(DomainError)
  })

  it('computes cycle day and seven-day counts', () => {
    const cycle = makeCycle({ startDate: '2026-08-09', endDate: '2026-08-15' })
    const state = makeState({
      cycles: [cycle],
      dailyEntries: [
        {
          id: 'entry-1',
          cycleId: cycle.id,
          date: '2026-08-09',
          status: 'practiced',
          feelingTags: [],
          createdAt: '2026-08-09T04:00:00.000Z',
          updatedAt: '2026-08-09T04:00:00.000Z',
        },
        {
          id: 'entry-2',
          cycleId: cycle.id,
          date: '2026-08-10',
          status: 'not_practiced',
          feelingTags: [],
          createdAt: '2026-08-10T04:00:00.000Z',
          updatedAt: '2026-08-10T04:00:00.000Z',
        },
      ],
    })

    expect(selectCycleDay(cycle, '2026-08-08')).toBe('scheduled')
    expect(selectCycleDay(cycle, '2026-08-11')).toBe(3)
    expect(selectCycleDay(cycle, '2026-08-16')).toBe('review_due')
    expect(selectCycleCounts(cycle, state.dailyEntries)).toEqual({
      practiced: 1,
      notPracticed: 1,
      blank: 5,
    })
  })

  it('sorts recent energy and ranks tags by frequency then recency', () => {
    const state = makeState({
      energyEntries: [
        {
          id: 'energy-1',
          category: 'energy',
          occurredAt: '2026-08-09T01:00:00.000Z',
          event: '散步',
          feelingTags: ['轻松', '清醒'],
          energyDelta: 1,
          createdAt: '2026-08-09T01:00:00.000Z',
          updatedAt: '2026-08-09T01:00:00.000Z',
        },
        {
          id: 'energy-2',
          category: 'energy',
          occurredAt: '2026-08-10T01:00:00.000Z',
          event: '写作',
          feelingTags: ['清醒', '稳定'],
          energyDelta: -1,
          createdAt: '2026-08-10T01:00:00.000Z',
          updatedAt: '2026-08-10T01:00:00.000Z',
        },
        {
          id: 'drain-1',
          category: 'drain',
          occurredAt: '2026-08-11T01:00:00.000Z',
          event: '争执',
          feelingTags: ['疲惫'],
          energyDelta: 1,
          createdAt: '2026-08-11T01:00:00.000Z',
          updatedAt: '2026-08-11T01:00:00.000Z',
        },
      ],
    })

    expect(selectRecentEnergy(state, 'energy').map((entry) => entry.id)).toEqual(['energy-2', 'energy-1'])
    expect(selectTopFeelingTags(state, 'energy')).toEqual(['清醒', '稳定', '轻松'])
  })

  it('returns the latest submitted decision with its item', () => {
    const item = makeItem()
    const cycle = makeCycle()
    const state = makeState({
      items: [item],
      cycles: [cycle],
      reviews: [
        {
          id: 'review-1',
          cycleId: cycle.id,
          effectiveDays: 1,
          missedDays: 0,
          blankDays: 6,
          factSummary: '事实',
          conclusion: '继续',
          decision: 'continue',
          submittedAt: '2026-08-10T00:00:00.000Z',
        },
      ],
    })

    expect(selectLatestDecision(state)).toEqual({ review: state.reviews[0], item })
  })
})
