import {
  canRecordCycleDate,
  compareLocalDate,
  getCycleEndDate,
  todayLocalDate,
} from './dates'
import { isCyclePendingReview, isOpenCycle, selectCycleCounts, selectOpenCycleByTrack } from './selectors'
import {
  DomainError,
  type CycleReview,
  type CycleOutcome,
  type DailyEntry,
  type EnergyCategory,
  type EnergyDelta,
  type EnergyEntry,
  type ExperimentCycle,
  type ItemStatus,
  type LifeItem,
  type LifeLabState,
  type LocalDate,
  type LongTermEntry,
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
  missReasonTags?: string[]
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

export type SaveLongTermEntryInput = {
  itemId: UUID
  date: LocalDate
  note?: string
}

export function refreshTemporalState(state: LifeLabState, now = new Date()): LifeLabState {
  const today = todayLocalDate(now)
  let changed = false

  const cycles = state.cycles.map((cycle) => {
    if ((cycle.status === 'scheduled' || cycle.status === 'active') && compareLocalDate(today, cycle.endDate) > 0) {
      changed = true
      return {
        ...cycle,
        status: getNaturalCycleOutcome(cycle, state) as CycleOutcome,
        updatedAt: now.toISOString(),
      }
    }
    if (cycle.status === 'scheduled' && compareLocalDate(today, cycle.startDate) >= 0) {
      changed = true
      return { ...cycle, status: 'active' as const, updatedAt: now.toISOString() }
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
    const status: ItemStatus =
      openCycle.status === 'scheduled' || openCycle.status === 'active'
        ? 'active'
        : openCycle.status === 'terminated' || openCycle.status === 'completed' || openCycle.status === 'concluded'
          ? openCycle.status
          : item.status
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
        ? {
            ...candidate,
            status: candidate.archivedFromStatus ?? 'exploring',
            archivedAt: undefined,
            archivedFromStatus: undefined,
            updatedAt: now.toISOString(),
          }
        : candidate,
    ),
  }
}

export function archiveLifeItem(state: LifeLabState, itemId: UUID, now: Date): LifeLabState {
  const item = state.items.find((candidate) => candidate.id === itemId)
  if (!item) {
    throw new DomainError('not_found', 'item does not exist')
  }
  if (item.status !== 'completed' && item.status !== 'concluded') {
    throw new DomainError('invalid_state', 'only completed or concluded items can be archived')
  }
  const latestCycle = state.cycles
    .filter((cycle) => cycle.itemId === item.id)
    .sort((left, right) => right.cycleNumber - left.cycleNumber)[0]
  if (!latestCycle || latestCycle.status !== 'reviewed') {
    throw new DomainError('invalid_state', 'the latest cycle must be reviewed before archiving')
  }
  const archivedFromStatus = item.status

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    items: state.items.map((candidate) =>
      candidate.id === item.id
        ? {
            ...candidate,
            status: 'archived',
            archivedAt: now.toISOString(),
            archivedFromStatus,
            updatedAt: now.toISOString(),
          }
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
  if (state.dailyEntries.some((entry) => cycleIds.has(entry.cycleId))) {
    throw new DomainError('invalid_state', 'items with practice records cannot be deleted')
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    items: state.items.filter((item) => item.id !== itemId),
    cycles: state.cycles.filter((cycle) => cycle.itemId !== itemId),
    dailyEntries: state.dailyEntries.filter((entry) => !cycleIds.has(entry.cycleId)),
    reviews: state.reviews.filter((review) => !cycleIds.has(review.cycleId)),
    longTermEntries: state.longTermEntries.filter((entry) => entry.itemId !== itemId),
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
  if (!['exploring', 'terminated', 'completed', 'concluded'].includes(item.status)) {
    throw new DomainError('invalid_state', 'item status cannot start a cycle')
  }
  if (item.status !== 'exploring' && !hasReviewedLatestCycle(state, item.id)) {
    throw new DomainError('invalid_state', 'the latest cycle must be reviewed before starting another round')
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
      return { ...candidate, status: 'active', updatedAt: now.toISOString() }
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
  if (!itemHasPracticeRecords(state, cycle.itemId)) {
    throw new DomainError('invalid_state', 'items without practice records should be deleted instead')
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    cycles: state.cycles.map((candidate) =>
      candidate.id === cycle.id
        ? {
            ...candidate,
            status: 'terminated',
            endedEarlyAt: now.toISOString(),
            updatedAt: now.toISOString(),
          }
        : candidate,
    ),
    items: state.items.map((item) =>
      item.id === cycle.itemId
        ? { ...item, status: 'terminated', updatedAt: now.toISOString() }
        : item,
    ),
  }
}

export function convertArchivedItemToLongTerm(state: LifeLabState, itemId: UUID, now: Date): LifeLabState {
  const item = state.items.find((candidate) => candidate.id === itemId)
  if (!item) {
    throw new DomainError('not_found', 'item does not exist')
  }
  if (item.status !== 'archived' || !item.archivedFromStatus) {
    throw new DomainError('invalid_state', 'only archived successful items can become long term')
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    items: state.items.map((candidate) =>
      candidate.id === item.id
        ? { ...candidate, status: 'long_term', archivedAt: undefined, updatedAt: now.toISOString() }
        : candidate,
    ),
  }
}

export function terminateLongTermItem(state: LifeLabState, itemId: UUID, now: Date): LifeLabState {
  return updateLongTermStatus(state, itemId, 'long_term', 'long_term_terminated', now)
}

export function restartLongTermItem(state: LifeLabState, itemId: UUID, now: Date): LifeLabState {
  return updateLongTermStatus(state, itemId, 'long_term_terminated', 'long_term', now)
}

export function saveLongTermEntry(
  state: LifeLabState,
  input: SaveLongTermEntryInput,
  now: Date,
  createId: IdFactory,
): LifeLabState {
  validateLocalDate(input.date, 'date')
  if (input.date !== todayLocalDate(now)) {
    throw new DomainError('invalid_input', 'long-term entries can only be recorded for today')
  }
  const item = state.items.find((candidate) => candidate.id === input.itemId)
  if (!item) {
    throw new DomainError('not_found', 'item does not exist')
  }
  if (item.status !== 'long_term') {
    throw new DomainError('invalid_state', 'only active long-term items can be recorded')
  }

  const existing = state.longTermEntries.find((entry) => entry.itemId === item.id && entry.date === input.date)
  const entry: LongTermEntry = {
    id: existing?.id ?? createId(),
    itemId: item.id,
    date: input.date,
    note: normalizeOptionalText(input.note, 500),
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    longTermEntries: existing
      ? state.longTermEntries.map((candidate) => (candidate.id === existing.id ? entry : candidate))
      : [...state.longTermEntries, entry],
  }
}

function updateLongTermStatus(
  state: LifeLabState,
  itemId: UUID,
  currentStatus: Extract<ItemStatus, 'long_term' | 'long_term_terminated'>,
  nextStatus: Extract<ItemStatus, 'long_term' | 'long_term_terminated'>,
  now: Date,
): LifeLabState {
  const item = state.items.find((candidate) => candidate.id === itemId)
  if (!item) {
    throw new DomainError('not_found', 'item does not exist')
  }
  if (item.status !== currentStatus) {
    throw new DomainError('invalid_state', 'long-term item is not in the required status')
  }
  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    items: state.items.map((candidate) =>
      candidate.id === item.id ? { ...candidate, status: nextStatus, updatedAt: now.toISOString() } : candidate,
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
  const category = input.energyDelta > 0 ? 'energy' : input.energyDelta < 0 ? 'drain' : input.category

  const existing = input.id
    ? state.energyEntries.find((entry) => entry.id === input.id)
    : undefined
  const entry: EnergyEntry = {
    id: existing?.id ?? createId(),
    category,
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
  if (!isCyclePendingReview(cycle)) {
    throw new DomainError('invalid_state', 'cycle must be terminated, completed, or concluded before review')
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
    decision: getCycleOutcome(cycle),
    submittedAt: now.toISOString(),
  }

  return {
    ...state,
    meta: { ...state.meta, updatedAt: now.toISOString() },
    cycles: [
      ...state.cycles.map((candidate) =>
        candidate.id === cycle.id
          ? { ...candidate, status: 'reviewed' as const, reviewId, nextCycleId: undefined, updatedAt: now.toISOString() }
          : candidate,
      ),
    ],
    reviews: [...state.reviews, review],
    items: state.items.map((candidate) => {
      if (candidate.id !== item.id) {
        return candidate
      }
      return {
        ...candidate,
        status: getCycleOutcome(cycle),
        latestConclusion: review.conclusion,
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
    missReasonTags: input.status === 'not_practiced' ? normalizeTags(input.missReasonTags) : undefined,
    missReasonOther:
      input.status === 'not_practiced' ? normalizeOptionalText(input.missReasonOther, 120) : undefined,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

function getNaturalCycleOutcome(cycle: ExperimentCycle, state: LifeLabState): CycleOutcome {
  return selectCycleCounts(cycle, state.dailyEntries).recorded === 7 ? 'completed' : 'concluded'
}

function getCycleOutcome(cycle: ExperimentCycle): CycleOutcome {
  if (cycle.status === 'terminated' || cycle.status === 'completed' || cycle.status === 'concluded') {
    return cycle.status
  }
  throw new DomainError('invalid_state', 'cycle has no reviewable outcome')
}

function itemHasPracticeRecords(state: LifeLabState, itemId: UUID): boolean {
  const cycleIds = new Set(state.cycles.filter((cycle) => cycle.itemId === itemId).map((cycle) => cycle.id))
  return state.dailyEntries.some((entry) => cycleIds.has(entry.cycleId))
}

function hasReviewedLatestCycle(state: LifeLabState, itemId: UUID): boolean {
  const latestCycle = state.cycles
    .filter((cycle) => cycle.itemId === itemId)
    .sort((left, right) => right.cycleNumber - left.cycleNumber)[0]
  return latestCycle?.status === 'reviewed' && Boolean(latestCycle.reviewId)
}
