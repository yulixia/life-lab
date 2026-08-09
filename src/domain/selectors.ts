import { compareLocalDate, enumerateLocalDates } from './dates'
import {
  DomainError,
  type CycleReview,
  type CycleStatus,
  type DailyEntry,
  type EnergyCategory,
  type EnergyEntry,
  type ExperimentCycle,
  type ItemStatus,
  type LifeItem,
  type LifeLabState,
  type LocalDate,
  type Track,
} from './types'

export const openCycleStatuses = ['scheduled', 'active', 'review_due'] satisfies CycleStatus[]

export function isOpenCycle(cycle: ExperimentCycle): boolean {
  return openCycleStatuses.some((status) => status === cycle.status)
}

export function selectOpenCycleByTrack(
  state: LifeLabState,
  track: Track,
): ExperimentCycle | null {
  const itemIds = new Set(state.items.filter((item) => item.track === track).map((item) => item.id))
  const openCycles = state.cycles.filter((cycle) => itemIds.has(cycle.itemId) && isOpenCycle(cycle))

  if (openCycles.length > 1) {
    throw new DomainError('invalid_state', `track ${track} has multiple open cycles`)
  }

  return openCycles[0] ?? null
}

export function selectCycleDay(
  cycle: ExperimentCycle,
  today: LocalDate,
): 'scheduled' | 'review_due' | 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  if (compareLocalDate(today, cycle.startDate) < 0) {
    return 'scheduled'
  }
  if (compareLocalDate(today, cycle.endDate) > 0 || cycle.status === 'review_due') {
    return 'review_due'
  }

  const dates = enumerateLocalDates(cycle.startDate, today)
  return dates.length as 1 | 2 | 3 | 4 | 5 | 6 | 7
}

export function selectCycleCounts(
  cycle: ExperimentCycle,
  entries: DailyEntry[],
): { practiced: number; notPracticed: number; blank: number } {
  const cycleDates = new Set(enumerateLocalDates(cycle.startDate, cycle.endDate))
  let practiced = 0
  let notPracticed = 0

  for (const entry of entries) {
    if (entry.cycleId !== cycle.id || !cycleDates.has(entry.date)) {
      continue
    }
    if (entry.status === 'practiced') {
      practiced += 1
    } else {
      notPracticed += 1
    }
  }

  return {
    practiced,
    notPracticed,
    blank: 7 - practiced - notPracticed,
  }
}

export function selectRecentEnergy(
  state: LifeLabState,
  category: EnergyCategory,
  limit = 5,
): EnergyEntry[] {
  return state.energyEntries
    .filter((entry) => entry.category === category)
    .sort(sortEnergyEntries)
    .slice(0, limit)
}

export function selectTopFeelingTags(
  state: LifeLabState,
  category: EnergyCategory,
  limit = 3,
): string[] {
  const recent = selectRecentEnergy(state, category, 30)
  const stats = new Map<string, { count: number; lastIndex: number }>()

  recent.forEach((entry, index) => {
    entry.feelingTags.forEach((tag) => {
      const current = stats.get(tag)
      stats.set(tag, {
        count: (current?.count ?? 0) + 1,
        lastIndex: current ? Math.min(current.lastIndex, index) : index,
      })
    })
  })

  return [...stats.entries()]
    .sort(([, left], [, right]) => right.count - left.count || left.lastIndex - right.lastIndex)
    .slice(0, limit)
    .map(([tag]) => tag)
}

export function selectLatestDecision(
  state: LifeLabState,
): { review: CycleReview; item: LifeItem } | null {
  const latestReview = [...state.reviews].sort((left, right) =>
    right.submittedAt.localeCompare(left.submittedAt),
  )[0]

  if (!latestReview) {
    return null
  }

  const cycle = state.cycles.find((candidate) => candidate.id === latestReview.cycleId)
  const item = cycle ? state.items.find((candidate) => candidate.id === cycle.itemId) : undefined
  return item ? { review: latestReview, item } : null
}

export type LibraryTrackFilter = 'all' | Track
export type LibraryStatusFilter = 'all' | ItemStatus

export function selectLibraryItems(
  state: LifeLabState,
  trackFilter: LibraryTrackFilter = 'all',
  statusFilter: LibraryStatusFilter = 'all',
): LifeItem[] {
  return state.items
    .filter((item) => trackFilter === 'all' || item.track === trackFilter)
    .filter((item) => statusFilter === 'all' || item.status === statusFilter)
    .sort(sortLibraryItems)
}

export function selectItemById(state: LifeLabState, itemId: string): LifeItem | null {
  return state.items.find((item) => item.id === itemId) ?? null
}

export function selectCyclesByItem(state: LifeLabState, itemId: string): ExperimentCycle[] {
  return state.cycles
    .filter((cycle) => cycle.itemId === itemId)
    .sort((left, right) => right.cycleNumber - left.cycleNumber)
}

export function selectOpenCycleForItem(
  state: LifeLabState,
  itemId: string,
): ExperimentCycle | null {
  return state.cycles.find((cycle) => cycle.itemId === itemId && isOpenCycle(cycle)) ?? null
}

export function selectEffectiveCyclePlan(
  cycle: ExperimentCycle,
  date: LocalDate,
): { actionPlan: string; minimumStandard: string; idealStandard?: string } {
  const effectiveAdjustments = cycle.adjustments
    .filter((adjustment) => compareLocalDate(adjustment.effectiveFrom, date) <= 0)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom) || right.createdAt.localeCompare(left.createdAt))

  return effectiveAdjustments.reduce(
    (plan, adjustment) => ({
      actionPlan: adjustment.actionPlan ?? plan.actionPlan,
      minimumStandard: adjustment.minimumStandard ?? plan.minimumStandard,
      idealStandard: adjustment.idealStandard ?? plan.idealStandard,
    }),
    {
      actionPlan: cycle.actionPlan,
      minimumStandard: cycle.minimumStandard,
      idealStandard: cycle.idealStandard,
    },
  )
}

export function selectDailyEntry(
  state: LifeLabState,
  cycleId: string,
  date: LocalDate,
): DailyEntry | null {
  return state.dailyEntries.find((entry) => entry.cycleId === cycleId && entry.date === date) ?? null
}

function sortEnergyEntries(left: EnergyEntry, right: EnergyEntry): number {
  return (
    right.occurredAt.localeCompare(left.occurredAt) ||
    right.createdAt.localeCompare(left.createdAt)
  )
}

function sortLibraryItems(left: LifeItem, right: LifeItem): number {
  const statusRank: Record<ItemStatus, number> = {
    review_due: 0,
    active: 1,
    exploring: 2,
    long_term: 3,
    archived: 4,
  }

  return statusRank[left.status] - statusRank[right.status] || right.updatedAt.localeCompare(left.updatedAt)
}
