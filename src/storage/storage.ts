import { createEmptyState } from '../domain/fixtures'
import type { CycleStatus, ItemStatus, LifeLabState, ReviewDecision } from '../domain/types'

export const storageKey = 'life-lab:v1'
const currentSchemaVersion = 2

export type StorageFailureReason =
  | 'unavailable'
  | 'not_found'
  | 'invalid_json'
  | 'unknown_schema'
  | 'invalid_shape'
  | 'quota_exceeded'
  | 'write_failed'

export type LoadResult =
  | { ok: true; state: LifeLabState; source: 'existing' | 'empty' }
  | { ok: false; reason: StorageFailureReason; message: string; raw?: string }

export type SaveResult = { ok: true } | { ok: false; reason: StorageFailureReason; message: string }
export type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function loadState(storage = getDefaultStorage(), now = new Date()): LoadResult {
  if (!storage) return { ok: false, reason: 'unavailable', message: 'localStorage is unavailable' }
  let raw: string | null
  try {
    raw = storage.getItem(storageKey)
  } catch {
    return { ok: false, reason: 'unavailable', message: 'localStorage cannot be read' }
  }
  if (raw === null) return { ok: true, source: 'empty', state: createEmptyState(now) }
  const migrated = migrateState(raw)
  return migrated.ok ? { ok: true, source: 'existing', state: migrated.state } : migrated
}

export function saveState(next: LifeLabState, storage = getDefaultStorage()): SaveResult {
  if (!storage) return { ok: false, reason: 'unavailable', message: 'localStorage is unavailable' }
  let serialized: string
  try {
    serialized = JSON.stringify(next)
  } catch {
    return { ok: false, reason: 'write_failed', message: 'state could not be serialized' }
  }
  try {
    storage.setItem(storageKey, serialized)
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: isQuotaExceeded(error) ? 'quota_exceeded' : 'write_failed', message: 'localStorage write failed' }
  }
}

export function migrateState(raw: string): LoadResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'invalid_json', message: 'stored data is not valid JSON', raw }
  }
  if (!isRecord(parsed)) return { ok: false, reason: 'invalid_shape', message: 'stored data root must be an object', raw }
  if (!('schemaVersion' in parsed)) return { ok: false, reason: 'unknown_schema', message: 'schemaVersion is missing', raw }
  if (parsed.schemaVersion === currentSchemaVersion && isValidV2State(parsed)) {
    return { ok: true, source: 'existing', state: parsed as LifeLabState }
  }
  if (parsed.schemaVersion === 1 && isValidV1State(parsed)) {
    return { ok: true, source: 'existing', state: migrateV1State(parsed) }
  }
  return { ok: false, reason: 'unknown_schema', message: 'schemaVersion is not supported', raw }
}

export function deleteAllData(storage = getDefaultStorage(), now = new Date()): LifeLabState {
  storage?.removeItem(storageKey)
  return createEmptyState(now)
}

export function exportFullBackup(state: LifeLabState): Blob {
  return new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
}

export function exportValidationSummary(state: LifeLabState): Blob {
  const decisions: Record<ReviewDecision, number> = { terminated: 0, completed: 0, concluded: 0 }
  let practicedDays = 0
  let missedDays = 0
  for (const review of state.reviews) {
    decisions[review.decision] += 1
    practicedDays += review.effectiveDays
    missedDays += review.missedDays
  }
  const summary = {
    schemaVersion: currentSchemaVersion,
    itemsCreated: state.items.length,
    cyclesStarted: state.cycles.length,
    cyclesReachedReview: state.cycles.filter((cycle) => cycle.status === 'reviewed').length,
    reviewsSubmitted: state.reviews.length,
    decisions,
    practicedDays,
    missedDays,
    blankDays: state.reviews.reduce((total, review) => total + review.blankDays, 0),
    longTermEntryCount: state.longTermEntries.length,
    energyEntryCount: state.energyEntries.length,
  }
  return new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' })
}

function migrateV1State(value: Record<string, unknown>): LifeLabState {
  const legacyCycles = value.cycles as Array<Record<string, unknown>>
  const legacyEntries = value.dailyEntries as Array<Record<string, unknown>>
  const recordedByCycle = new Map<string, number>()
  for (const entry of legacyEntries) {
    if (typeof entry.cycleId === 'string') recordedByCycle.set(entry.cycleId, (recordedByCycle.get(entry.cycleId) ?? 0) + 1)
  }
  const cycles = legacyCycles.map((cycle): Record<string, unknown> => ({
    ...cycle,
    status: migrateCycleStatus(cycle.status, recordedByCycle.get(String(cycle.id)) ?? 0),
  }))
  const latestCycleByItem = new Map<string, Record<string, unknown>>()
  for (const cycle of cycles) {
    if (typeof cycle.itemId !== 'string') continue
    const previous = latestCycleByItem.get(cycle.itemId)
    if (!previous || Number(cycle.cycleNumber) > Number(previous.cycleNumber)) latestCycleByItem.set(cycle.itemId, cycle)
  }
  const items = (value.items as Array<Record<string, unknown>>).map((item) => {
    const status = migrateItemStatus(item.status, latestCycleByItem.get(String(item.id))?.status)
    const archivedFromStatus = migrateArchivedFromStatus(item.archivedFromStatus)
    return {
      ...item,
      status,
      archivedFromStatus: status === 'archived' ? archivedFromStatus ?? 'completed' : undefined,
    }
  })
  const cycleOutcomeById = new Map(cycles.map((cycle) => [String(cycle.id), cycle.status]))
  const reviews = (value.reviews as Array<Record<string, unknown>>).map((review) => ({
    ...review,
    decision: migrateReviewDecision(review.decision, cycleOutcomeById.get(String(review.cycleId))),
  }))
  return {
    ...(value as Omit<LifeLabState, 'schemaVersion' | 'items' | 'cycles' | 'reviews' | 'longTermEntries'>),
    schemaVersion: 2,
    items: items as LifeLabState['items'],
    cycles: cycles as LifeLabState['cycles'],
    reviews: reviews as LifeLabState['reviews'],
    longTermEntries: [],
  }
}

function migrateCycleStatus(status: unknown, recorded: number): CycleStatus {
  if (status === 'review_due') return recorded === 7 ? 'completed' : 'concluded'
  if (status === 'voided') return 'reviewed'
  if (status === 'scheduled' || status === 'active' || status === 'reviewed' || status === 'terminated' || status === 'completed' || status === 'concluded') return status
  return 'reviewed'
}

function migrateItemStatus(status: unknown, latestCycleStatus?: unknown): ItemStatus {
  if (status === 'review_due') {
    return latestCycleStatus === 'completed' ? 'completed' : latestCycleStatus === 'concluded' ? 'concluded' : 'terminated'
  }
  if (status === 'voided') return 'exploring'
  if (status === 'exploring' || status === 'active' || status === 'terminated' || status === 'completed' || status === 'concluded' || status === 'archived' || status === 'long_term' || status === 'long_term_terminated') return status
  return 'exploring'
}

function migrateArchivedFromStatus(status: unknown): Extract<ItemStatus, 'completed' | 'concluded'> | undefined {
  return status === 'concluded' ? 'concluded' : status === 'completed' ? 'completed' : undefined
}

function migrateReviewDecision(decision: unknown, cycleStatus?: unknown): ReviewDecision {
  if (decision === 'terminated' || decision === 'completed' || decision === 'concluded') return decision
  return cycleStatus === 'terminated' ? 'terminated' : cycleStatus === 'concluded' ? 'concluded' : 'completed'
}

function getDefaultStorage(): BrowserStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidV1State(value: Record<string, unknown>): boolean {
  return isBaseState(value)
}

function isValidV2State(value: Record<string, unknown>): boolean {
  return isBaseState(value) && Array.isArray(value.longTermEntries)
}

function isBaseState(value: Record<string, unknown>): boolean {
  return isRecord(value.meta) && typeof value.meta.createdAt === 'string' && typeof value.meta.updatedAt === 'string' && typeof value.meta.hasSeenLocalDataNotice === 'boolean' && Array.isArray(value.items) && Array.isArray(value.cycles) && Array.isArray(value.dailyEntries) && Array.isArray(value.reviews) && Array.isArray(value.energyEntries)
}

function isQuotaExceeded(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
}
