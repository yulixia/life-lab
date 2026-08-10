import { describe, expect, it } from 'vitest'
import { selectCycleCounts, selectCycleDay, selectLibraryItems, selectLongTermEntriesByItem, selectOpenCycleByTrack } from './selectors'
import { makeCycle, makeItem, makeState } from './testUtils'

describe('domain selectors', () => {
  it('defaults the library to active items and unions multiple selected status filters', () => {
    const state = makeState({
      items: [
        makeItem({ id: 'active', status: 'active' }),
        makeItem({ id: 'exploring', status: 'exploring' }),
        makeItem({ id: 'completed', status: 'completed' }),
        makeItem({ id: 'long-stopped', status: 'long_term_terminated' }),
      ],
    })
    expect(selectLibraryItems(state).map((item) => item.id)).toEqual(['active'])
    expect(selectLibraryItems(state, 'all', ['exploring', 'completed']).map((item) => item.id)).toEqual(['exploring', 'completed'])
    expect(selectLibraryItems(state, 'all', ['long_term']).map((item) => item.id)).toEqual(['long-stopped'])
  })

  it('keeps a pending-review cycle blocking its track', () => {
    const item = makeItem()
    const pendingReview = makeCycle({ status: 'concluded' })
    const state = makeState({ items: [item], cycles: [pendingReview] })
    expect(selectOpenCycleByTrack(state, 'ideal_self')).toBe(pendingReview)
  })

  it('reports seven-day record coverage and an ended cycle day', () => {
    const cycle = makeCycle({ startDate: '2026-08-09', endDate: '2026-08-15' })
    const state = makeState({
      cycles: [cycle],
      dailyEntries: [
        { id: 'one', cycleId: cycle.id, date: '2026-08-09', status: 'practiced', feelingTags: [], createdAt: '2026-08-09T04:00:00.000Z', updatedAt: '2026-08-09T04:00:00.000Z' },
        { id: 'two', cycleId: cycle.id, date: '2026-08-10', status: 'not_practiced', feelingTags: [], createdAt: '2026-08-10T04:00:00.000Z', updatedAt: '2026-08-10T04:00:00.000Z' },
      ],
    })
    expect(selectCycleDay(cycle, '2026-08-08')).toBe('scheduled')
    expect(selectCycleDay(cycle, '2026-08-11')).toBe(3)
    expect(selectCycleDay(cycle, '2026-08-16')).toBe('ended')
    expect(selectCycleCounts(cycle, state.dailyEntries)).toEqual({ practiced: 1, notPracticed: 1, recorded: 2, blank: 5 })
  })

  it('sorts long-term entries from the most recent completion', () => {
    const state = makeState({
      longTermEntries: [
        { id: 'first', itemId: 'item-1', date: '2026-08-09', createdAt: '2026-08-09T00:00:00.000Z', updatedAt: '2026-08-09T00:00:00.000Z' },
        { id: 'second', itemId: 'item-1', date: '2026-08-10', createdAt: '2026-08-10T00:00:00.000Z', updatedAt: '2026-08-10T00:00:00.000Z' },
      ],
    })
    expect(selectLongTermEntriesByItem(state, 'item-1').map((entry) => entry.id)).toEqual(['second', 'first'])
  })
})
