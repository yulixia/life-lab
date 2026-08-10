import { describe, expect, it } from 'vitest'
import { atLocalNoon, idSequence, makeCycle, makeItem, makeState } from './testUtils'
import {
  archiveLifeItem,
  convertArchivedItemToLongTerm,
  createExperimentCycle,
  deleteLifeItem,
  endCycleEarly,
  refreshTemporalState,
  restartLongTermItem,
  restoreArchivedItem,
  saveDailyEntry,
  saveEnergyEntry,
  saveLongTermEntry,
  submitCycleReview,
  terminateLongTermItem,
} from './transitions'
import { DomainError, type DailyEntry } from './types'

function dailyEntry(cycleId: string, date: string, status: DailyEntry['status'] = 'practiced'): DailyEntry {
  return {
    id: `${cycleId}-${date}`,
    cycleId,
    date,
    status,
    actionSummary: status === 'practiced' ? '完成今天的行动' : undefined,
    feelingTags: [],
    createdAt: '2026-08-09T04:00:00.000Z',
    updatedAt: '2026-08-09T04:00:00.000Z',
  }
}

describe('new item state flow', () => {
  it('settles a full seven-day record as completed and a partial record as concluded', () => {
    const completedCycle = makeCycle({ id: 'full', status: 'active' })
    const concludedCycle = makeCycle({ id: 'partial', itemId: 'item-2', status: 'active' })
    const completedDates = ['09', '10', '11', '12', '13', '14', '15'].map((day) => dailyEntry('full', `2026-08-${day}`))
    const state = makeState({
      items: [makeItem({ id: 'item-1', status: 'active' }), makeItem({ id: 'item-2', status: 'active' })],
      cycles: [completedCycle, concludedCycle],
      dailyEntries: [...completedDates, dailyEntry('partial', '2026-08-09'), dailyEntry('partial', '2026-08-10', 'not_practiced')],
    })

    const settled = refreshTemporalState(state, atLocalNoon('2026-08-16'))

    expect(settled.cycles.map((cycle) => cycle.status)).toEqual(['completed', 'concluded'])
    expect(settled.items.map((item) => item.status)).toEqual(['completed', 'concluded'])
  })

  it('only allows a daily record for today during an active cycle', () => {
    const cycle = makeCycle({ status: 'active' })
    const state = makeState({ items: [makeItem({ status: 'active' })], cycles: [cycle] })
    expect(() => saveDailyEntry(state, { cycleId: cycle.id, date: '2026-08-08', status: 'practiced', actionSummary: '补记' }, atLocalNoon('2026-08-09'), idSequence('entry'))).toThrowError(DomainError)
    expect(saveDailyEntry(state, { cycleId: cycle.id, date: '2026-08-09', status: 'not_practiced' }, atLocalNoon('2026-08-09'), idSequence('entry')).dailyEntries).toHaveLength(1)
  })

  it('keeps multiple unpracticed reason tags and an optional description', () => {
    const cycle = makeCycle({ status: 'active' })
    const state = makeState({ items: [makeItem({ status: 'active' })], cycles: [cycle] })

    const saved = saveDailyEntry(
      state,
      {
        cycleId: cycle.id,
        date: '2026-08-09',
        status: 'not_practiced',
        missReasonTags: ['忙碌', '临时安排'],
        missReasonOther: '临时会议延长到很晚。',
      },
      atLocalNoon('2026-08-09'),
      idSequence('entry'),
    )

    expect(saved.dailyEntries[0]).toMatchObject({
      status: 'not_practiced',
      missReasonTags: ['忙碌', '临时安排'],
      missReasonOther: '临时会议延长到很晚。',
    })
  })

  it('requires an item-level record before a current cycle can be terminated', () => {
    const previous = makeCycle({ id: 'cycle-old', status: 'reviewed', cycleNumber: 1 })
    const current = makeCycle({ id: 'cycle-current', status: 'active', cycleNumber: 2 })
    const state = makeState({
      items: [makeItem({ status: 'active' })],
      cycles: [previous, current],
      dailyEntries: [dailyEntry(previous.id, '2026-08-09')],
    })

    const ended = endCycleEarly(state, current.id, atLocalNoon('2026-08-10'))
    expect(ended.cycles.find((cycle) => cycle.id === current.id)?.status).toBe('terminated')
    expect(ended.items[0].status).toBe('terminated')

    expect(() => endCycleEarly(makeState({ items: [makeItem({ status: 'active' })], cycles: [makeCycle()] }), 'cycle-1', atLocalNoon('2026-08-10'))).toThrowError(DomainError)
  })

  it('uses the cycle outcome during review and freezes its record', () => {
    const cycle = makeCycle({ status: 'concluded' })
    const state = makeState({ items: [makeItem({ status: 'concluded' })], cycles: [cycle] })
    const reviewed = submitCycleReview(state, { cycleId: cycle.id, factSummary: '记录不完整。', conclusion: '下轮缩小范围。' }, atLocalNoon('2026-08-16'), idSequence('review'))

    expect(reviewed.cycles[0]).toMatchObject({ status: 'reviewed', reviewId: 'review-1' })
    expect(reviewed.reviews[0].decision).toBe('concluded')
    expect(reviewed.items[0].status).toBe('concluded')
    expect(() => saveDailyEntry(reviewed, { cycleId: cycle.id, date: '2026-08-15', status: 'practiced', actionSummary: '晚了' }, atLocalNoon('2026-08-16'), idSequence('entry'))).toThrowError(DomainError)
  })

  it('only starts another round after the latest outcome is reviewed', () => {
    const reviewedCycle = makeCycle({ status: 'reviewed', reviewId: 'review-1' })
    const item = makeItem({ status: 'completed' })
    const state = makeState({ items: [item], cycles: [reviewedCycle] })
    const next = createExperimentCycle(state, { itemId: item.id, startDate: '2026-08-20', question: '再验证一次？', actionPlan: '每天做一次', minimumStandard: '至少开始' }, atLocalNoon('2026-08-20'), idSequence('cycle'))

    expect(next.items[0].status).toBe('active')
    expect(next.cycles.at(-1)).toMatchObject({ cycleNumber: 2, status: 'active' })
    expect(() => createExperimentCycle(next, { itemId: item.id, startDate: '2026-08-20', question: '重复开启？', actionPlan: '每天做一次', minimumStandard: '至少开始' }, atLocalNoon('2026-08-20'), idSequence('again'))).toThrowError(DomainError)
  })

  it('archives only a reviewed completed or concluded item and restores the exact prior status', () => {
    const cycle = makeCycle({ status: 'reviewed', reviewId: 'review-1' })
    const state = makeState({ items: [makeItem({ status: 'concluded' })], cycles: [cycle] })
    const archived = archiveLifeItem(state, 'item-1', atLocalNoon('2026-08-16'))
    expect(archived.items[0]).toMatchObject({ status: 'archived', archivedFromStatus: 'concluded' })
    expect(restoreArchivedItem(archived, 'item-1', atLocalNoon('2026-08-17')).items[0].status).toBe('concluded')
    expect(() => archiveLifeItem(makeState({ items: [makeItem({ status: 'terminated' })], cycles: [cycle] }), 'item-1', atLocalNoon('2026-08-16'))).toThrowError(DomainError)
  })

  it('deletes only an item with no daily record across all rounds', () => {
    const empty = makeState({ items: [makeItem({ status: 'active' })], cycles: [makeCycle()] })
    expect(deleteLifeItem(empty, 'item-1', atLocalNoon('2026-08-10')).items).toEqual([])
    const withHistory = makeState({ items: [makeItem({ status: 'active' })], cycles: [makeCycle()], dailyEntries: [dailyEntry('cycle-1', '2026-08-09')] })
    expect(() => deleteLifeItem(withHistory, 'item-1', atLocalNoon('2026-08-10'))).toThrowError(DomainError)
  })

  it('turns archived successes into long-term items and keeps their daily history through restart', () => {
    const archived = makeState({ items: [makeItem({ status: 'archived', archivedFromStatus: 'completed' })] })
    const longTerm = convertArchivedItemToLongTerm(archived, 'item-1', atLocalNoon('2026-08-16'))
    const recorded = saveLongTermEntry(longTerm, { itemId: 'item-1', date: '2026-08-16', note: '散步完成' }, atLocalNoon('2026-08-16'), idSequence('long'))
    const terminated = terminateLongTermItem(recorded, 'item-1', atLocalNoon('2026-08-17'))
    const restarted = restartLongTermItem(terminated, 'item-1', atLocalNoon('2026-08-18'))

    expect(restarted.items[0].status).toBe('long_term')
    expect(restarted.longTermEntries).toMatchObject([{ date: '2026-08-16', note: '散步完成' }])
    expect(() => saveLongTermEntry(terminated, { itemId: 'item-1', date: '2026-08-17' }, atLocalNoon('2026-08-17'), idSequence('long'))).toThrowError(DomainError)
  })

  it('keeps the chosen category for a neutral energy entry', () => {
    const saved = saveEnergyEntry(
      makeState(),
      { category: 'drain', occurredAt: '2026-08-09T04:00:00.000Z', event: '等待回复', feelingTags: [], energyDelta: 0 },
      atLocalNoon('2026-08-09'),
      idSequence('energy'),
    )

    expect(saved.energyEntries).toMatchObject([{ category: 'drain', event: '等待回复', energyDelta: 0 }])
  })
})
