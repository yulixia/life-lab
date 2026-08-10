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

export function mergeImportedState(current: LifeLabState, imported: LifeLabState, now = new Date()): LifeLabState {
  return {
    schemaVersion: currentSchemaVersion,
    meta: {
      createdAt: current.meta.createdAt.localeCompare(imported.meta.createdAt) <= 0 ? current.meta.createdAt : imported.meta.createdAt,
      updatedAt: now.toISOString(),
      hasSeenLocalDataNotice: current.meta.hasSeenLocalDataNotice || imported.meta.hasSeenLocalDataNotice,
    },
    items: mergeRecords(current.items, imported.items, (item) => item.updatedAt),
    cycles: mergeRecords(current.cycles, imported.cycles, (cycle) => cycle.updatedAt),
    dailyEntries: mergeRecords(current.dailyEntries, imported.dailyEntries, (entry) => entry.updatedAt, (entry) => `${entry.cycleId}:${entry.date}`),
    reviews: mergeRecords(current.reviews, imported.reviews, (review) => review.submittedAt, (review) => review.cycleId),
    longTermEntries: mergeRecords(current.longTermEntries, imported.longTermEntries, (entry) => entry.updatedAt, (entry) => `${entry.itemId}:${entry.date}`),
    energyEntries: mergeRecords(current.energyEntries, imported.energyEntries, (entry) => entry.updatedAt),
  }
}

type IdentifiedRecord = { id: string }

function mergeRecords<T extends IdentifiedRecord>(
  current: T[],
  imported: T[],
  getUpdatedAt: (record: T) => string,
  getNaturalKey?: (record: T) => string,
): T[] {
  const merged = [...current]
  const byId = new Map(merged.map((record, index) => [record.id, index]))
  const byNaturalKey = getNaturalKey ? new Map(merged.map((record, index) => [getNaturalKey(record), index])) : null

  for (const incoming of imported) {
    const existingIndex = byId.get(incoming.id) ?? (getNaturalKey ? byNaturalKey?.get(getNaturalKey(incoming)) : undefined)
    if (existingIndex === undefined) {
      byId.set(incoming.id, merged.length)
      if (getNaturalKey) byNaturalKey?.set(getNaturalKey(incoming), merged.length)
      merged.push(incoming)
      continue
    }

    const existing = merged[existingIndex]
    if (getUpdatedAt(incoming).localeCompare(getUpdatedAt(existing)) > 0) {
      byId.delete(existing.id)
      byId.set(incoming.id, existingIndex)
      if (getNaturalKey) byNaturalKey?.set(getNaturalKey(incoming), existingIndex)
      merged[existingIndex] = incoming
    }
  }

  return merged
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
