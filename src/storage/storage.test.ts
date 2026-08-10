import { describe, expect, it } from 'vitest'
import { createEmptyState } from '../domain/fixtures'
import { makeCycle, makeItem, makeState } from '../domain/testUtils'
import {
  deleteAllData,
  exportFullBackup,
  loadState,
  mergeImportedState,
  migrateState,
  saveState,
  storageKey,
  type BrowserStorage,
} from './storage'

class MemoryStorage implements BrowserStorage {
  private values = new Map<string, string>()

  constructor(private readonly failSet = false) {}

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failSet) {
      throw new DOMException('full', 'QuotaExceededError')
    }
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

describe('storage', () => {
  it('loads an empty v2 state when no local data exists', () => {
    const result = loadState(new MemoryStorage(), new Date('2026-08-09T04:00:00.000Z'))

    expect(result.ok).toBe(true)
    expect(result.ok && result.source).toBe('empty')
    expect(result.ok && result.state).toMatchObject({
      schemaVersion: 2,
      items: [],
      cycles: [],
      dailyEntries: [],
      reviews: [],
      longTermEntries: [],
      energyEntries: [],
    })
  })

  it('saves only after JSON serialization and reports quota failures without mutating storage', () => {
    const storage = new MemoryStorage(true)
    const state = createEmptyState(new Date('2026-08-09T04:00:00.000Z'))

    const result = saveState(state, storage)

    expect(result).toMatchObject({ ok: false, reason: 'quota_exceeded' })
    expect(storage.getItem(storageKey)).toBeNull()
  })

  it('does not overwrite invalid JSON or unknown schema while loading', () => {
    expect(migrateState('{bad json')).toMatchObject({ ok: false, reason: 'invalid_json' })
    expect(migrateState(JSON.stringify({ schemaVersion: 2 }))).toMatchObject({
      ok: false,
      reason: 'unknown_schema',
    })
    expect(migrateState(JSON.stringify({ items: [] }))).toMatchObject({
      ok: false,
      reason: 'unknown_schema',
    })
  })

  it('round-trips a valid state and can delete all data into a fresh v2 state', () => {
    const storage = new MemoryStorage()
    const state = makeState({ items: [makeItem()] })

    expect(saveState(state, storage)).toEqual({ ok: true })
    expect(loadState(storage)).toMatchObject({ ok: true, source: 'existing', state })

    const fresh = deleteAllData(storage, new Date('2026-08-10T04:00:00.000Z'))
    expect(storage.getItem(storageKey)).toBeNull()
    expect(fresh.items).toEqual([])
    expect(fresh.meta.createdAt).toBe('2026-08-10T04:00:00.000Z')
  })

  it('migrates v1 review_due and voided states into the v2 model', () => {
    const legacy = {
      schemaVersion: 1,
      meta: { createdAt: '2026-08-09T04:00:00.000Z', updatedAt: '2026-08-09T04:00:00.000Z', hasSeenLocalDataNotice: true },
      items: [makeItem({ status: 'review_due' as never }), makeItem({ id: 'void', status: 'voided' as never })],
      cycles: [makeCycle({ status: 'review_due' as never })],
      dailyEntries: [],
      reviews: [],
      energyEntries: [],
    }
    const result = migrateState(JSON.stringify(legacy))
    expect(result).toMatchObject({ ok: true, state: { schemaVersion: 2 } })
    expect(result.ok && result.state.items.map((item) => item.status)).toEqual(['concluded', 'exploring'])
    expect(result.ok && result.state.cycles[0].status).toBe('concluded')
  })

  it('exports a full backup and merges imported data without duplicating daily records', async () => {
    const state = makeState({
      items: [makeItem({ title: '秘密标题' })],
      cycles: [makeCycle()],
      dailyEntries: [{ id: 'entry-old', cycleId: 'cycle-1', date: '2026-08-09', status: 'practiced', actionSummary: '旧记录', feelingTags: [], createdAt: '2026-08-09T04:00:00.000Z', updatedAt: '2026-08-09T04:00:00.000Z' }],
    })

    await expect(exportFullBackup(state).text()).resolves.toContain('秘密标题')

    const imported = makeState({
      items: [makeItem({ id: 'item-1', title: '导入后更新的标题', updatedAt: '2026-08-10T04:00:00.000Z' }), makeItem({ id: 'item-2', title: '导入事项' })],
      cycles: [makeCycle()],
      dailyEntries: [{ id: 'entry-new', cycleId: 'cycle-1', date: '2026-08-09', status: 'practiced', actionSummary: '新记录', feelingTags: [], createdAt: '2026-08-09T04:00:00.000Z', updatedAt: '2026-08-10T04:00:00.000Z' }],
    })
    const merged = mergeImportedState(state, imported, new Date('2026-08-11T04:00:00.000Z'))

    expect(merged.items).toHaveLength(2)
    expect(merged.items.find((item) => item.id === 'item-1')?.title).toBe('导入后更新的标题')
    expect(merged.dailyEntries).toEqual([expect.objectContaining({ id: 'entry-new', actionSummary: '新记录' })])
    expect(merged.meta.updatedAt).toBe('2026-08-11T04:00:00.000Z')
  })
})
