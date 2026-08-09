export type IsoInstant = string
export type LocalDate = string
export type UUID = string

export type Track = 'ideal_self' | 'side_hustle'
export type ItemStatus =
  | 'exploring'
  | 'active'
  | 'review_due'
  | 'long_term'
  | 'voided'
  | 'terminated'
  | 'completed'
  | 'archived'
export type CycleStatus = 'scheduled' | 'active' | 'review_due' | 'reviewed'
export type DailyEntryStatus = 'practiced' | 'not_practiced'
export type EnergyCategory = 'energy' | 'drain'
export type EnergyDelta = -2 | -1 | 0 | 1 | 2
export type MissReason =
  | 'busy'
  | 'low_energy'
  | 'forgot'
  | 'blocked'
  | 'unwell'
  | 'not_priority'
  | 'other'
export type ReviewDecision =
  | 'continue'
  | 'adjust_continue'
  | 'defer'
  | 'long_term'
  | 'archive'
  | 'voided'
  | 'terminated'
  | 'completed'

export type AppMeta = {
  createdAt: IsoInstant
  updatedAt: IsoInstant
  hasSeenLocalDataNotice: boolean
}

export type LifeLabState = {
  schemaVersion: 1
  meta: AppMeta
  items: LifeItem[]
  cycles: ExperimentCycle[]
  dailyEntries: DailyEntry[]
  reviews: CycleReview[]
  energyEntries: EnergyEntry[]
}

export type LifeItem = {
  id: UUID
  title: string
  track: Track
  why?: string
  question?: string
  status: ItemStatus
  latestConclusion?: string
  createdAt: IsoInstant
  updatedAt: IsoInstant
  archivedAt?: IsoInstant
}

export type ExperimentCycle = {
  id: UUID
  itemId: UUID
  cycleNumber: number
  startDate: LocalDate
  endDate: LocalDate
  status: CycleStatus
  question: string
  positiveSignals?: string
  negativeSignals?: string
  actionPlan: string
  minimumStandard: string
  idealStandard?: string
  adjustments: CycleAdjustment[]
  endedEarlyAt?: IsoInstant
  reviewId?: UUID
  nextCycleId?: UUID
  createdAt: IsoInstant
  updatedAt: IsoInstant
}

export type DailyEntry = {
  id: UUID
  cycleId: UUID
  date: LocalDate
  status: DailyEntryStatus
  actionSummary?: string
  durationMinutes?: number
  feelingTags: string[]
  energyDelta?: EnergyDelta
  observation?: string
  missReason?: MissReason
  missReasonOther?: string
  createdAt: IsoInstant
  updatedAt: IsoInstant
}

export type CycleReview = {
  id: UUID
  cycleId: UUID
  effectiveDays: number
  missedDays: number
  blankDays: number
  factSummary: string
  energizing?: string
  draining?: string
  evidenceFor?: string
  evidenceAgainst?: string
  discovery?: string
  conclusion: string
  decision: ReviewDecision
  submittedAt: IsoInstant
}

export type EnergyEntry = {
  id: UUID
  category: EnergyCategory
  occurredAt: IsoInstant
  scene?: string
  event: string
  feelingTags: string[]
  energyDelta: EnergyDelta
  reason?: string
  reflection?: string
  createdAt: IsoInstant
  updatedAt: IsoInstant
}

export type CycleAdjustment = {
  id: UUID
  cycleId: UUID
  effectiveFrom: LocalDate
  actionPlan?: string
  minimumStandard?: string
  idealStandard?: string
  reason?: string
  createdAt: IsoInstant
}

export type DomainErrorCode =
  | 'not_found'
  | 'invalid_input'
  | 'invalid_state'
  | 'track_occupied'
  | 'duplicate_review'
  | 'frozen'

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}
