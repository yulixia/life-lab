import { describe, expect, it } from 'vitest'
import {
  addCycleAdjustment,
  createExperimentCycle,
  createLifeItem,
  deleteEnergyEntry,
  findDuplicateItemTitle,
  refreshTemporalState,
  restoreArchivedItem,
  saveDailyEntry,
  saveEnergyEntry,
  submitCycleReview,
  updateLifeItem,
} from './transitions'
import { selectEffectiveCyclePlan } from './selectors'
import { DomainError } from './types'
import { atLocalNoon, idSequence, makeCycle, makeItem, makeState } from './testUtils'

describe('domain transitions', () => {
  it('creates and edits life items while trimming optional fields', () => {
    const state = makeState()
    const created = createLifeItem(
      state,
      {
        title: '  写作  ',
        track: 'ideal_self',
        why: '  想稳定表达  ',
        question: '',
      },
      atLocalNoon('2026-08-09'),
      idSequence('item'),
    )

    expect(created.items[0]).toMatchObject({
      id: 'item-1',
      title: '写作',
      track: 'ideal_self',
      why: '想稳定表达',
      question: undefined,
      status: 'exploring',
    })

    const edited = updateLifeItem(
      created,
      'item-1',
      { title: '晨间写作', track: 'side_hustle', why: '', question: '能否形成线索？' },
      atLocalNoon('2026-08-10'),
    )
    expect(edited.items[0]).toMatchObject({
      title: '晨间写作',
      track: 'side_hustle',
      why: undefined,
      question: '能否形成线索？',
    })
  })

  it('finds same-track duplicate titles but allows saving', () => {
    const state = makeState({ items: [makeItem({ title: '写作', track: 'ideal_self' })] })

    expect(findDuplicateItemTitle(state, { title: '写作', track: 'ideal_self' })?.id).toBe('item-1')
    expect(findDuplicateItemTitle(state, { title: '写作', track: 'side_hustle' })).toBeNull()
  })

  it('prevents changing track while an item has an open cycle and restores archived items', () => {
    const item = makeItem({ status: 'active', track: 'ideal_self' })
    const state = makeState({ items: [item], cycles: [makeCycle({ itemId: item.id, status: 'active' })] })

    expect(() =>
      updateLifeItem(
        state,
        item.id,
        { title: item.title, track: 'side_hustle', why: '', question: '' },
        atLocalNoon('2026-08-09'),
      ),
    ).toThrowError(DomainError)

    const archived = makeState({
      items: [makeItem({ id: 'archived', status: 'archived', archivedAt: '2026-08-09T04:00:00.000Z' })],
    })
    expect(restoreArchivedItem(archived, 'archived', atLocalNoon('2026-08-10')).items[0]).toMatchObject({
      status: 'exploring',
      archivedAt: undefined,
    })
  })

  it('refreshes scheduled and active cycles using local calendar boundaries', () => {
    const item = makeItem()
    const state = makeState({
      items: [item],
      cycles: [
        makeCycle({
          status: 'scheduled',
          startDate: '2026-08-09',
          endDate: '2026-08-15',
        }),
      ],
    })

    const active = refreshTemporalState(state, atLocalNoon('2026-08-09'))
    expect(active.cycles[0].status).toBe('active')
    expect(active.items[0].status).toBe('active')

    const reviewDue = refreshTemporalState(active, atLocalNoon('2026-08-16'))
    expect(reviewDue.cycles[0].status).toBe('review_due')
    expect(reviewDue.items[0].status).toBe('review_due')
  })

  it('creates a seven-day cycle and blocks a second open cycle on the same track', () => {
    const item = makeItem()
    const state = makeState({ items: [item] })
    const next = createExperimentCycle(
      state,
      {
        itemId: item.id,
        startDate: '2026-08-31',
        question: '这件事值得继续吗？',
        actionPlan: '每天做一次',
        minimumStandard: '至少 5 分钟',
      },
      atLocalNoon('2026-08-30'),
      idSequence('cycle'),
    )

    expect(next.cycles[0]).toMatchObject({
      cycleNumber: 1,
      startDate: '2026-08-31',
      endDate: '2026-09-06',
      status: 'scheduled',
    })

    expect(() =>
      createExperimentCycle(
        next,
        {
          itemId: item.id,
          startDate: '2026-09-01',
          question: '第二个同轨实践？',
          actionPlan: '每天做一次',
          minimumStandard: '至少 5 分钟',
        },
        atLocalNoon('2026-08-30'),
        idSequence('other'),
      ),
    ).toThrowError(DomainError)
  })

  it('upserts one daily entry per cycle and date with practiced validation', () => {
    const cycle = makeCycle()
    const state = makeState({ items: [makeItem({ status: 'active' })], cycles: [cycle] })
    const ids = idSequence('entry')

    const saved = saveDailyEntry(
      state,
      {
        cycleId: cycle.id,
        date: '2026-08-09',
        status: 'practiced',
        actionSummary: '写了开头',
        durationMinutes: 20,
        feelingTags: ['稳定', '稳定', '  '],
        energyDelta: 1,
      },
      atLocalNoon('2026-08-09'),
      ids,
    )

    const updated = saveDailyEntry(
      saved,
      {
        cycleId: cycle.id,
        date: '2026-08-09',
        status: 'not_practiced',
        missReason: 'busy',
      },
      atLocalNoon('2026-08-09'),
      ids,
    )

    expect(updated.dailyEntries).toHaveLength(1)
    expect(updated.dailyEntries[0]).toMatchObject({
      id: 'entry-1',
      status: 'not_practiced',
      missReason: 'busy',
    })
    expect(saved.dailyEntries[0].feelingTags).toEqual(['稳定'])
    expect(() =>
      saveDailyEntry(
        state,
        { cycleId: cycle.id, date: '2026-08-10', status: 'practiced' },
        atLocalNoon('2026-08-10'),
        ids,
      ),
    ).toThrowError(DomainError)
  })

  it('adds cycle adjustments that affect the effective day and later dates only', () => {
    const cycle = makeCycle({
      actionPlan: '每天写 20 分钟',
      minimumStandard: '写 10 分钟',
      idealStandard: '写 40 分钟',
    })
    const state = makeState({ items: [makeItem({ status: 'active' })], cycles: [cycle] })

    const adjusted = addCycleAdjustment(
      state,
      {
        cycleId: cycle.id,
        effectiveFrom: '2026-08-11',
        actionPlan: '每天写 5 分钟',
        minimumStandard: '打开文档',
      },
      atLocalNoon('2026-08-11'),
      idSequence('adjustment'),
    )

    expect(adjusted.cycles[0].endDate).toBe(cycle.endDate)
    expect(selectEffectiveCyclePlan(adjusted.cycles[0], '2026-08-10')).toMatchObject({
      actionPlan: '每天写 20 分钟',
      minimumStandard: '写 10 分钟',
    })
    expect(selectEffectiveCyclePlan(adjusted.cycles[0], '2026-08-11')).toMatchObject({
      actionPlan: '每天写 5 分钟',
      minimumStandard: '打开文档',
      idealStandard: '写 40 分钟',
    })
  })

  it('submits each review once, freezes the old cycle, and creates continuation from next local day', () => {
    const cycle = makeCycle({ status: 'review_due' })
    const stateWithEntries = saveDailyEntry(
      makeState({ items: [makeItem({ status: 'review_due' })], cycles: [cycle] }),
      {
        cycleId: cycle.id,
        date: '2026-08-15',
        status: 'not_practiced',
      },
      atLocalNoon('2026-08-20'),
      idSequence('entry'),
    )

    const reviewed = submitCycleReview(
      stateWithEntries,
      {
        cycleId: cycle.id,
        factSummary: '完成 0 天，错过 1 天。',
        conclusion: '继续一轮再看。',
        decision: 'continue',
      },
      atLocalNoon('2026-08-20'),
      idSequence('review'),
    )

    expect(reviewed.reviews[0]).toMatchObject({
      effectiveDays: 0,
      missedDays: 1,
      blankDays: 6,
      decision: 'continue',
    })
    expect(reviewed.cycles[0]).toMatchObject({ status: 'reviewed', reviewId: 'review-1' })
    expect(reviewed.cycles[1]).toMatchObject({
      id: 'review-2',
      cycleNumber: 2,
      startDate: '2026-08-21',
      endDate: '2026-08-27',
      status: 'scheduled',
    })
    expect(() =>
      saveDailyEntry(
        reviewed,
        { cycleId: cycle.id, date: '2026-08-14', status: 'not_practiced' },
        atLocalNoon('2026-08-20'),
        idSequence('late'),
      ),
    ).toThrowError(DomainError)
  })

  it('saves, edits, and deletes energy entries while allowing mixed category and delta', () => {
    const state = makeState()
    const saved = saveEnergyEntry(
      state,
      {
        category: 'energy',
        occurredAt: '2026-08-09T03:00:00.000Z',
        scene: '  公园  ',
        event: '散步后有精神',
        feelingTags: ['轻松', '轻松', '清醒'],
        energyDelta: -1,
        reason: '虽然归为有能量，但身体有点累',
      },
      new Date('2026-08-09T04:00:00.000Z'),
      idSequence('energy'),
    )

    expect(saved.energyEntries[0]).toMatchObject({
      id: 'energy-1',
      category: 'energy',
      scene: '公园',
      feelingTags: ['轻松', '清醒'],
      energyDelta: -1,
    })

    const edited = saveEnergyEntry(
      saved,
      {
        id: 'energy-1',
        category: 'drain',
        occurredAt: '2026-08-09T03:30:00.000Z',
        event: '临时会议',
        feelingTags: ['疲惫'],
        energyDelta: 1,
      },
      new Date('2026-08-09T04:00:00.000Z'),
      idSequence('energy'),
    )
    expect(edited.energyEntries).toHaveLength(1)
    expect(edited.energyEntries[0]).toMatchObject({ id: 'energy-1', category: 'drain', energyDelta: 1 })
    expect(deleteEnergyEntry(edited, 'energy-1', new Date('2026-08-09T05:00:00.000Z')).energyEntries).toEqual([])
  })

  it('rejects future energy entries', () => {
    expect(() =>
      saveEnergyEntry(
        makeState(),
        {
          category: 'energy',
          occurredAt: '2026-08-10T00:00:00.000Z',
          event: '未来事件',
          energyDelta: 0,
        },
        new Date('2026-08-09T04:00:00.000Z'),
        idSequence('energy'),
      ),
    ).toThrowError(DomainError)
  })

  it('requires changed plan fields for adjust-and-continue decisions', () => {
    const cycle = makeCycle({ status: 'review_due' })
    const state = makeState({ items: [makeItem({ status: 'review_due' })], cycles: [cycle] })

    expect(() =>
      submitCycleReview(
        state,
        {
          cycleId: cycle.id,
          factSummary: '需要调整。',
          conclusion: '先降低标准。',
          decision: 'adjust_continue',
        },
        atLocalNoon('2026-08-20'),
        idSequence('review'),
      ),
    ).toThrowError(DomainError)
  })

  it('uses adjusted fields when adjust-and-continue creates the next cycle', () => {
    const cycle = makeCycle({ status: 'review_due', actionPlan: '旧行动', minimumStandard: '旧标准' })
    const state = makeState({ items: [makeItem({ status: 'review_due' })], cycles: [cycle] })

    const reviewed = submitCycleReview(
      state,
      {
        cycleId: cycle.id,
        factSummary: '需要调整后继续。',
        conclusion: '降低标准继续。',
        decision: 'adjust_continue',
        adjustedPlan: {
          actionPlan: '新行动',
          minimumStandard: '新标准',
        },
      },
      atLocalNoon('2026-08-20'),
      idSequence('review'),
    )

    expect(reviewed.cycles[1]).toMatchObject({
      actionPlan: '新行动',
      minimumStandard: '新标准',
      startDate: '2026-08-21',
      status: 'scheduled',
    })
  })

  it.each([
    ['defer', 'exploring', undefined],
    ['long_term', 'long_term', undefined],
    ['archive', 'archived', '2026-08-20T04:00:00.000Z'],
  ] as const)('updates item status for %s reviews', (decision, status, archivedAt) => {
    const cycle = makeCycle({ status: 'review_due' })
    const state = makeState({ items: [makeItem({ status: 'review_due' })], cycles: [cycle] })

    const reviewed = submitCycleReview(
      state,
      {
        cycleId: cycle.id,
        factSummary: '复盘事实。',
        conclusion: '本轮结论。',
        decision,
      },
      new Date('2026-08-20T04:00:00.000Z'),
      idSequence('review'),
    )

    expect(reviewed.items[0]).toMatchObject({ status, archivedAt })
    expect(reviewed.cycles).toHaveLength(1)
    expect(reviewed.cycles[0].status).toBe('reviewed')
  })
})
