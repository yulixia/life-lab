import type { ExperimentCycle, LifeItem, LifeLabState, LocalDate, UUID } from './types'

export function makeState(overrides: Partial<LifeLabState> = {}): LifeLabState {
  const now = '2026-08-09T04:00:00.000Z'
  return {
    schemaVersion: 1,
    meta: {
      createdAt: now,
      updatedAt: now,
      hasSeenLocalDataNotice: false,
    },
    items: [],
    cycles: [],
    dailyEntries: [],
    reviews: [],
    energyEntries: [],
    ...overrides,
  }
}

export function makeItem(overrides: Partial<LifeItem> = {}): LifeItem {
  const now = '2026-08-09T04:00:00.000Z'
  return {
    id: 'item-1',
    title: '晨间写作',
    track: 'ideal_self',
    status: 'exploring',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function makeCycle(overrides: Partial<ExperimentCycle> = {}): ExperimentCycle {
  const now = '2026-08-09T04:00:00.000Z'
  return {
    id: 'cycle-1',
    itemId: 'item-1',
    cycleNumber: 1,
    startDate: '2026-08-09',
    endDate: '2026-08-15',
    status: 'active',
    question: '每天写作是否让我更稳定？',
    actionPlan: '每天写 20 分钟',
    minimumStandard: '写满 10 分钟',
    adjustments: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function idSequence(prefix = 'id'): () => UUID {
  let current = 0
  return () => `${prefix}-${++current}`
}

export function atLocalNoon(date: LocalDate): Date {
  return new Date(`${date}T12:00:00+08:00`)
}
