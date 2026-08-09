import { createEmptyState } from '../domain/fixtures'
import type { LifeLabState } from '../domain/types'

export const storageKey = 'life-lab:v1'

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
  if (!storage) {
    return { ok: false, reason: 'unavailable', message: 'localStorage is unavailable' }
  }

  let raw: string | null
  try {
    raw = storage.getItem(storageKey)
  } catch {
    return { ok: false, reason: 'unavailable', message: 'localStorage cannot be read' }
  }

  if (raw === null) {
    return { ok: true, source: 'empty', state: createEmptyState(now) }
  }

  const migrated = migrateState(raw)
  return migrated.ok ? { ok: true, source: 'existing', state: migrated.state } : migrated
}

export function saveState(next: LifeLabState, storage = getDefaultStorage()): SaveResult {
  if (!storage) {
    return { ok: false, reason: 'unavailable', message: 'localStorage is unavailable' }
  }

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
    return {
      ok: false,
      reason: isQuotaExceeded(error) ? 'quota_exceeded' : 'write_failed',
      message: 'localStorage write failed',
    }
  }
}

export function migrateState(raw: string): LoadResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'invalid_json', message: 'stored data is not valid JSON', raw }
  }

  if (!isRecord(parsed)) {
    return { ok: false, reason: 'invalid_shape', message: 'stored data root must be an object', raw }
  }

  if (!('schemaVersion' in parsed)) {
    return { ok: false, reason: 'unknown_schema', message: 'schemaVersion is missing', raw }
  }

  if (parsed.schemaVersion !== 1) {
    return { ok: false, reason: 'unknown_schema', message: 'schemaVersion is not supported', raw }
  }

  const state = parsed as Record<string, unknown>
  if (!isValidV1State(state)) {
    return { ok: false, reason: 'invalid_shape', message: 'stored v1 data is incomplete', raw }
  }

  return { ok: true, source: 'existing', state: state as LifeLabState }
}

export function deleteAllData(storage = getDefaultStorage(), now = new Date()): LifeLabState {
  storage?.removeItem(storageKey)
  return createEmptyState(now)
}

export function exportFullBackup(state: LifeLabState): Blob {
  return new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
}

export function exportValidationSummary(state: LifeLabState): Blob {
  const decisions = {
    continue: 0,
    adjust_continue: 0,
    defer: 0,
    long_term: 0,
    archive: 0,
    voided: 0,
    terminated: 0,
    completed: 0,
  }
  let practicedDays = 0
  let missedDays = 0

  for (const review of state.reviews) {
    decisions[review.decision] += 1
    practicedDays += review.effectiveDays
    missedDays += review.missedDays
  }

  const summary = {
    schemaVersion: 1,
    itemsCreated: state.items.length,
    cyclesStarted: state.cycles.length,
    cyclesReachedReview: state.cycles.filter(
      (cycle) => cycle.status === 'review_due' || cycle.status === 'reviewed',
    ).length,
    reviewsSubmitted: state.reviews.length,
    decisions,
    practicedDays,
    missedDays,
    blankDays: state.reviews.reduce((total, review) => total + review.blankDays, 0),
    energyEntryCount: state.energyEntries.length,
  }

  return new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' })
}

function getDefaultStorage(): BrowserStorage | null {
  if (typeof window === 'undefined') {
    return null
  }

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
  return (
    isRecord(value.meta) &&
    typeof value.meta.createdAt === 'string' &&
    typeof value.meta.updatedAt === 'string' &&
    typeof value.meta.hasSeenLocalDataNotice === 'boolean' &&
    Array.isArray(value.items) &&
    Array.isArray(value.cycles) &&
    Array.isArray(value.dailyEntries) &&
    Array.isArray(value.reviews) &&
    Array.isArray(value.energyEntries)
  )
}

function isQuotaExceeded(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
}
