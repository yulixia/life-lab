import {
  addCalendarDays,
  canRecordCycleDate,
  compareLocalDate,
  getCycleEndDate,
  todayLocalDate,
} from './dates'
import { isOpenCycle, selectCycleCounts, selectOpenCycleByTrack } from './selectors'
import {
  DomainError,
  type CycleReview,
  type DailyEntry,
  type EnergyCategory,
  type EnergyDelta,
  type EnergyEntry,
  type ExperimentCycle,
  type ItemStatus,
  type LifeItem,
  type LifeLabState,
  type LocalDate,
  type ReviewDecision,
  type Track,
  type UUID,
} from './types'
import {
  normalizeOptionalText,
  normalizeRequiredText,
  normalizeTags,
  validateEnergyDelta,
  validateLocalDate,
  validateTrack,
} from './validation'

export type IdFactory = () => UUID

export type CreateCycleInput = {
  itemId: UUID
  startDate: LocalDate
  question: string
  positiveSignals?: string
  negativeSignals?: string
  actionPlan: string
  minimumStandard: string
  idealStandard?: string
}

export type SaveDailyEntryInput = {
  cycleId: UUID
  date: LocalDate
  status: 'practiced' | 'not_practiced'
  actionSummary?: string
  durationMinutes?: number
  feelingTags?: string[]
  energyDelta?: number
  observation?: string
  missReason?: DailyEntry['missReason']
  missReasonOther?: string
}

export type SubmitReviewInput = {
  cycleId: UUID
  factSummary: string
  energizing?: string
  draining?: string
  evidenceFor?: string
  evidenceAgainst?: string
  discovery?: string
  conclusion: string
  decision: ReviewDecision
  adjustedPlan?: {
    actionPlan?: string
    minimumStandard?: string
    idealStandard?: string
  }
}

export type SaveItemInput = {
  title: string
  track: Track
  why?: string
  question?: string
}

export type AddCycleAdjustmentInput = {
  cycleId: UUID
  effectiveFrom: LocalDate
  actionPlan?: string
  minimumStandard?: string
  idealStandard?: string
  reason?: string
}

export type SaveEnergyEntryInput = {
  id?: UUID
  category: EnergyCategory
  occurredAt: string
  scene?: string
  event: string
  feelingTags?: string[]
  energyDelta: number
  reason?: string
  reflection?: string
}

export function refreshTemporalState(state: LifeLabState, now = new Date()): LifeLabState {
  const today = todayLocalDate(now)
  let changed = false

  const cycles = state.cycles.map((cycle) => {
    if (cycle.status === 'scheduled' && compareLocalDate(today, cycle.endDate) > 0) {
      changed = true
      return { ...cycle, status: 'review_due' as const, updatedAt: now.toISOString() }
    }
    if (cycle.status === 'scheduled' && compareLocalDate(today, cycle.startDate) >= 0) {
      changed = true
      return { ...cycle, status: 'active' as const, updatedAt: now.toISOString() }
    }
    if (cycle.status === 'active' && compareLocalDate(today, cycle.endDate) > 0) {
      changed = true
      return { ...cycle, status: 'review_due' as const, updatedAt: now.toISOString() }
    }
    return cycle
  })

  if (!changed) {
    return state
  }

  const items = state.items.map((item) => {
    const openCycle = cycles.find((cycle) => cycle.itemId === item.id && isOpenCycle(cycle))
    if (!openCycle) {
      return item
    }
    const status: ItemStatus = openCycle.status === 'review_due' ? 'review_due' : 'active'
    return item.status === status ? item : { ...item, status, updatedAt: now.toISOString() }
  })

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    items,
    cycles,
  }
}

export function createLifeItem(
  state: LifeLabState,
  input: SaveItemInput,
  now: Date,
  createId: IdFactory,
): LifeLabState {
  validateTrack(input.track)
  const item: LifeItem = {
    id: createId(),
    title: normalizeRequiredText(input.title, 'title', 60),
    track: input.track,
    why: normalizeOptionalText(input.why, 500),
    question: normalizeOptionalText(input.question, 300),
    status: 'exploring',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    items: [...state.items, item],
  }
}

export function updateLifeItem(
  state: LifeLabState,
  itemId: UUID,
  input: SaveItemInput,
  now: Date,
): LifeLabState {
  validateTrack(input.track)
  const item = state.items.find((candidate) => candidate.id === itemId)
  if (!item) {
    throw new DomainError('not_found', 'item does not exist')
  }

  const hasOpenCycle = state.cycles.some((cycle) => cycle.itemId === item.id && isOpenCycle(cycle))
  if (hasOpenCycle && input.track !== item.track) {
    throw new DomainError('invalid_state', 'track cannot change while item has an open cycle')
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    items: state.items.map((candidate) =>
      candidate.id === item.id
        ? {
            ...candidate,
            title: normalizeRequiredText(input.title, 'title', 60),
            track: input.track,
            why: normalizeOptionalText(input.why, 500),
            question: normalizeOptionalText(input.question, 300),
            updatedAt: now.toISOString(),
          }
        : candidate,
    ),
  }
}

export function restoreArchivedItem(state: LifeLabState, itemId: UUID, now: Date): LifeLabState {
  const item = state.items.find((candidate) => candidate.id === itemId)
  if (!item) {
    throw new DomainError('not_found', 'item does not exist')
  }
  if (item.status !== 'archived') {
    throw new DomainError('invalid_state', 'only archived items can be restored')
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    items: state.items.map((candidate) =>
      candidate.id === item.id
        ? { ...candidate, status: 'exploring', archivedAt: undefined, updatedAt: now.toISOString() }
        : candidate,
    ),
  }
}

export function archiveLifeItem(state: LifeLabState, itemId: UUID, now: Date): LifeLabState {
  const item = state.items.find((candidate) => candidate.id === itemId)
  if (!item) {
    throw new DomainError('not_found', 'item does not exist')
  }
  if (item.status === 'archived') {
    return state
  }
  if (state.cycles.some((cycle) => cycle.itemId === item.id && isOpenCycle(cycle))) {
    throw new DomainError('invalid_state', 'open cycle must be reviewed before archiving')
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    items: state.items.map((candidate) =>
      candidate.id === item.id
        ? { ...candidate, status: 'archived', archivedAt: now.toISOString(), updatedAt: now.toISOString() }
        : candidate,
    ),
  }
}

export function deleteLifeItem(state: LifeLabState, itemId: UUID, now: Date): LifeLabState {
  if (!state.items.some((item) => item.id === itemId)) {
    throw new DomainError('not_found', 'item does not exist')
  }

  const cycleIds = new Set(
    state.cycles.filter((cycle) => cycle.itemId === itemId).map((cycle) => cycle.id),
  )

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    items: state.items.filter((item) => item.id !== itemId),
    cycles: state.cycles.filter((cycle) => cycle.itemId !== itemId),
    dailyEntries: state.dailyEntries.filter((entry) => !cycleIds.has(entry.cycleId)),
    reviews: state.reviews.filter((review) => !cycleIds.has(review.cycleId)),
  }
}

export function findDuplicateItemTitle(
  state: LifeLabState,
  input: Pick<SaveItemInput, 'title' | 'track'>,
  ignoredItemId?: UUID,
): LifeItem | null {
  const title = input.title.trim()
  if (!title) {
    return null
  }
  return (
    state.items.find(
      (item) => item.id !== ignoredItemId && item.track === input.track && item.title.trim() === title,
    ) ?? null
  )
}

export function createExperimentCycle(
  state: LifeLabState,
  input: CreateCycleInput,
  now: Date,
  createId: IdFactory,
): LifeLabState {
  validateLocalDate(input.startDate, 'startDate')
  const item = state.items.find((candidate) => candidate.id === input.itemId)
  if (!item) {
    throw new DomainError('not_found', 'item does not exist')
  }
  if (item.status === 'archived') {
    throw new DomainError('invalid_state', 'archived item must be restored before starting a cycle')
  }
  if (isEndedItemStatus(item.status)) {
    throw new DomainError('invalid_state', 'ended item cannot restart; create a new item instead')
  }
  if (selectOpenCycleByTrack(state, item.track)) {
    throw new DomainError('track_occupied', 'track already has an open cycle')
  }

  const previousCycles = state.cycles.filter((cycle) => cycle.itemId === item.id)
  const cycle: ExperimentCycle = {
    id: createId(),
    itemId: item.id,
    cycleNumber: previousCycles.length + 1,
    startDate: input.startDate,
    endDate: getCycleEndDate(input.startDate),
    status: compareLocalDate(todayLocalDate(now), input.startDate) >= 0 ? 'active' : 'scheduled',
    question: normalizeRequiredText(input.question, 'question', 300),
    positiveSignals: normalizeOptionalText(input.positiveSignals, 500),
    negativeSignals: normalizeOptionalText(input.negativeSignals, 500),
    actionPlan: normalizeRequiredText(input.actionPlan, 'actionPlan', 500),
    minimumStandard: normalizeRequiredText(input.minimumStandard, 'minimumStandard', 240),
    idealStandard: normalizeOptionalText(input.idealStandard, 240),
    adjustments: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    items: state.items.map((candidate) => {
      if (candidate.id !== item.id) {
        return candidate
      }
      const status: ItemStatus = cycle.status === 'review_due' ? 'review_due' : 'active'
      return { ...candidate, status, updatedAt: now.toISOString() }
    }),
    cycles: [...state.cycles, cycle],
  }
}

export function saveDailyEntry(
  state: LifeLabState,
  input: SaveDailyEntryInput,
  now: Date,
  createId: IdFactory,
): LifeLabState {
  validateLocalDate(input.date)
  const cycle = state.cycles.find((candidate) => candidate.id === input.cycleId)
  if (!cycle) {
    throw new DomainError('not_found', 'cycle does not exist')
  }
  if (cycle.status === 'reviewed') {
    throw new DomainError('frozen', 'reviewed cycle entries are frozen')
  }
  if (!canRecordCycleDate(cycle, input.date, todayLocalDate(now))) {
    throw new DomainError('invalid_input', 'entry date is not recordable')
  }
  if (state.reviews.some((review) => review.cycleId === cycle.id)) {
    throw new DomainError('frozen', 'reviewed cycle entries are frozen')
  }

  const entry = normalizeDailyEntry(state, input, now, createId)
  const existingIndex = state.dailyEntries.findIndex(
    (candidate) => candidate.cycleId === input.cycleId && candidate.date === input.date,
  )
  const dailyEntries =
    existingIndex === -1
      ? [...state.dailyEntries, entry]
      : state.dailyEntries.map((candidate, index) =>
          index === existingIndex
            ? { ...entry, id: candidate.id, createdAt: candidate.createdAt }
            : candidate,
        )

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    dailyEntries,
  }
}

export function addCycleAdjustment(
  state: LifeLabState,
  input: AddCycleAdjustmentInput,
  now: Date,
  createId: IdFactory,
): LifeLabState {
  validateLocalDate(input.effectiveFrom, 'effectiveFrom')
  const cycle = state.cycles.find((candidate) => candidate.id === input.cycleId)
  if (!cycle) {
    throw new DomainError('not_found', 'cycle does not exist')
  }
  if (cycle.status === 'reviewed') {
    throw new DomainError('frozen', 'reviewed cycle is frozen')
  }
  if (state.reviews.some((review) => review.cycleId === cycle.id)) {
    throw new DomainError('frozen', 'reviewed cycle is frozen')
  }
  if (compareLocalDate(input.effectiveFrom, cycle.startDate) < 0 || compareLocalDate(input.effectiveFrom, cycle.endDate) > 0) {
    throw new DomainError('invalid_input', 'adjustment date must be inside the cycle')
  }

  const actionPlan = normalizeOptionalText(input.actionPlan, 500)
  const minimumStandard = normalizeOptionalText(input.minimumStandard, 240)
  const idealStandard = normalizeOptionalText(input.idealStandard, 240)
  const reason = normalizeOptionalText(input.reason, 240)
  if (!actionPlan && !minimumStandard && !idealStandard) {
    throw new DomainError('invalid_input', 'adjustment requires at least one plan field')
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    cycles: state.cycles.map((candidate) =>
      candidate.id === cycle.id
        ? {
            ...candidate,
            adjustments: [
              ...candidate.adjustments,
              {
                id: createId(),
                cycleId: cycle.id,
                effectiveFrom: input.effectiveFrom,
                actionPlan,
                minimumStandard,
                idealStandard,
                reason,
                createdAt: now.toISOString(),
              },
            ],
            updatedAt: now.toISOString(),
          }
        : candidate,
    ),
  }
}

export function endCycleEarly(state: LifeLabState, cycleId: UUID, now: Date): LifeLabState {
  const cycle = state.cycles.find((candidate) => candidate.id === cycleId)
  if (!cycle) {
    throw new DomainError('not_found', 'cycle does not exist')
  }
  if (cycle.status !== 'active' && cycle.status !== 'scheduled') {
    throw new DomainError('invalid_state', 'only active or scheduled cycles can end early')
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    cycles: state.cycles.map((candidate) =>
      candidate.id === cycle.id
        ? {
            ...candidate,
            status: 'review_due',
            endedEarlyAt: now.toISOString(),
            updatedAt: now.toISOString(),
          }
        : candidate,
    ),
    items: state.items.map((item) =>
      item.id === cycle.itemId
        ? { ...item, status: 'review_due', updatedAt: now.toISOString() }
        : item,
    ),
  }
}

export function saveEnergyEntry(
  state: LifeLabState,
  input: SaveEnergyEntryInput,
  now: Date,
  createId: IdFactory,
): LifeLabState {
  if (input.category !== 'energy' && input.category !== 'drain') {
    throw new DomainError('invalid_input', 'category is invalid')
  }
  const occurredAt = new Date(input.occurredAt)
  if (Number.isNaN(occurredAt.getTime())) {
    throw new DomainError('invalid_input', 'occurredAt is invalid')
  }
  if (occurredAt.getTime() > now.getTime()) {
    throw new DomainError('invalid_input', 'occurredAt cannot be in the future')
  }
  validateEnergyDelta(input.energyDelta)

  const existing = input.id
    ? state.energyEntries.find((entry) => entry.id === input.id)
    : undefined
  const entry: EnergyEntry = {
    id: existing?.id ?? createId(),
    category: input.category,
    occurredAt: occurredAt.toISOString(),
    scene: normalizeOptionalText(input.scene, 80),
    event: normalizeRequiredText(input.event, 'event', 240),
    feelingTags: normalizeTags(input.feelingTags),
    energyDelta: input.energyDelta as EnergyDelta,
    reason: normalizeOptionalText(input.reason, 240),
    reflection: normalizeOptionalText(input.reflection, 500),
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    energyEntries: existing
      ? state.energyEntries.map((candidate) => (candidate.id === existing.id ? entry : candidate))
      : [...state.energyEntries, entry],
  }
}

export function deleteEnergyEntry(state: LifeLabState, entryId: UUID, now: Date): LifeLabState {
  if (!state.energyEntries.some((entry) => entry.id === entryId)) {
    throw new DomainError('not_found', 'energy entry does not exist')
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    energyEntries: state.energyEntries.filter((entry) => entry.id !== entryId),
  }
}

export function submitCycleReview(
  state: LifeLabState,
  input: SubmitReviewInput,
  now: Date,
  createId: IdFactory,
): LifeLabState {
  const cycle = state.cycles.find((candidate) => candidate.id === input.cycleId)
  if (!cycle) {
    throw new DomainError('not_found', 'cycle does not exist')
  }
  if (cycle.status !== 'review_due') {
    throw new DomainError('invalid_state', 'cycle must be review_due')
  }
  if (state.reviews.some((review) => review.cycleId === cycle.id)) {
    throw new DomainError('duplicate_review', 'cycle already has a review')
  }

  const item = state.items.find((candidate) => candidate.id === cycle.itemId)
  if (!item) {
    throw new DomainError('not_found', 'item does not exist')
  }

  const counts = selectCycleCounts(cycle, state.dailyEntries)
  const reviewId = createId()
  const review: CycleReview = {
    id: reviewId,
    cycleId: cycle.id,
    effectiveDays: counts.practiced,
    missedDays: counts.notPracticed,
    blankDays: counts.blank,
    factSummary: normalizeRequiredText(input.factSummary, 'factSummary', 1000),
    energizing: normalizeOptionalText(input.energizing, 500),
    draining: normalizeOptionalText(input.draining, 500),
    evidenceFor: normalizeOptionalText(input.evidenceFor, 800),
    evidenceAgainst: normalizeOptionalText(input.evidenceAgainst, 800),
    discovery: normalizeOptionalText(input.discovery, 800),
    conclusion: normalizeRequiredText(input.conclusion, 'conclusion', 300),
    decision: input.decision,
    submittedAt: now.toISOString(),
  }

  const shouldContinue = input.decision === 'continue' || input.decision === 'adjust_continue'
  if (input.decision === 'adjust_continue' && !hasAdjustment(input)) {
    throw new DomainError('invalid_input', '重置需要至少填写一个下一轮调整项')
  }

  const nextCycleId = shouldContinue ? createId() : undefined
  const nextCycle = nextCycleId
    ? createNextCycle(cycle, input, nextCycleId, addCalendarDays(todayLocalDate(now), 1), now)
    : undefined

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    cycles: [
      ...state.cycles.map((candidate) =>
        candidate.id === cycle.id
          ? { ...candidate, status: 'reviewed' as const, reviewId, nextCycleId, updatedAt: now.toISOString() }
          : candidate,
      ),
      ...(nextCycle ? [nextCycle] : []),
    ],
    reviews: [...state.reviews, review],
    items: state.items.map((candidate) => {
      if (candidate.id !== item.id) {
        return candidate
      }
      return {
        ...candidate,
        status: nextItemStatus(input.decision),
        latestConclusion: review.conclusion,
        archivedAt: input.decision === 'archive' ? now.toISOString() : undefined,
        updatedAt: now.toISOString(),
      }
    }),
  }
}

function normalizeDailyEntry(
  state: LifeLabState,
  input: SaveDailyEntryInput,
  now: Date,
  createId: IdFactory,
): DailyEntry {
  const existing = state.dailyEntries.find(
    (candidate) => candidate.cycleId === input.cycleId && candidate.date === input.date,
  )
  if (input.energyDelta !== undefined) {
    validateEnergyDelta(input.energyDelta)
  }
  if (input.durationMinutes !== undefined && (input.durationMinutes < 0 || input.durationMinutes > 1440)) {
    throw new DomainError('invalid_input', 'durationMinutes must be between 0 and 1440')
  }
  if (input.status === 'practiced') {
    normalizeRequiredText(input.actionSummary ?? '', 'actionSummary', 500)
  }

  return {
    id: existing?.id ?? createId(),
    cycleId: input.cycleId,
    date: input.date,
    status: input.status,
    actionSummary:
      input.status === 'practiced'
        ? normalizeRequiredText(input.actionSummary ?? '', 'actionSummary', 500)
        : normalizeOptionalText(input.actionSummary, 500),
    durationMinutes: input.durationMinutes,
    feelingTags: normalizeTags(input.feelingTags),
    energyDelta: input.energyDelta,
    observation: normalizeOptionalText(input.observation, 500),
    missReason: input.status === 'not_practiced' ? input.missReason : undefined,
    missReasonOther:
      input.status === 'not_practiced' ? normalizeOptionalText(input.missReasonOther, 120) : undefined,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

function createNextCycle(
  cycle: ExperimentCycle,
  input: SubmitReviewInput,
  id: UUID,
  startDate: LocalDate,
  now: Date,
): ExperimentCycle {
  const adjusted = input.adjustedPlan
  return {
    ...cycle,
    id,
    cycleNumber: cycle.cycleNumber + 1,
    startDate,
    endDate: getCycleEndDate(startDate),
    status: 'scheduled',
    actionPlan: adjusted?.actionPlan?.trim() || cycle.actionPlan,
    minimumStandard: adjusted?.minimumStandard?.trim() || cycle.minimumStandard,
    idealStandard: adjusted?.idealStandard?.trim() || cycle.idealStandard,
    adjustments: [],
    endedEarlyAt: undefined,
    reviewId: undefined,
    nextCycleId: undefined,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

function nextItemStatus(decision: ReviewDecision): ItemStatus {
  if (decision === 'continue' || decision === 'adjust_continue') {
    return 'active'
  }
  if (decision === 'long_term') {
    return 'long_term'
  }
  if (decision === 'archive') {
    return 'archived'
  }
  if (decision === 'voided' || decision === 'terminated' || decision === 'completed') {
    return decision
  }
  return 'exploring'
}

function isEndedItemStatus(status: ItemStatus): boolean {
  return status === 'voided' || status === 'terminated' || status === 'completed'
}

function hasAdjustment(input: SubmitReviewInput): boolean {
  return Boolean(
    input.adjustedPlan?.actionPlan?.trim() ||
      input.adjustedPlan?.minimumStandard?.trim() ||
      input.adjustedPlan?.idealStandard?.trim(),
  )
}
