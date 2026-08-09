import { describe, expect, it } from 'vitest'
import { createEmptyState } from '../domain/fixtures'
import { makeCycle, makeItem, makeState } from '../domain/testUtils'
import {
  deleteAllData,
  exportFullBackup,
  exportValidationSummary,
  loadState,
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
  it('loads an empty v1 state when no local data exists', () => {
    const result = loadState(new MemoryStorage(), new Date('2026-08-09T04:00:00.000Z'))

    expect(result.ok).toBe(true)
    expect(result.ok && result.source).toBe('empty')
    expect(result.ok && result.state).toMatchObject({
      schemaVersion: 1,
      items: [],
      cycles: [],
      dailyEntries: [],
      reviews: [],
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

  it('round-trips a valid state and can delete all data into a fresh v1 state', () => {
    const storage = new MemoryStorage()
    const state = makeState({ items: [makeItem()] })

    expect(saveState(state, storage)).toEqual({ ok: true })
    expect(loadState(storage)).toMatchObject({ ok: true, source: 'existing', state })

    const fresh = deleteAllData(storage, new Date('2026-08-10T04:00:00.000Z'))
    expect(storage.getItem(storageKey)).toBeNull()
    expect(fresh.items).toEqual([])
    expect(fresh.meta.createdAt).toBe('2026-08-10T04:00:00.000Z')
  })

  it('exports full backup and anonymous validation summary without text content', async () => {
    const state = makeState({
      items: [makeItem({ title: '秘密标题' })],
      cycles: [makeCycle({ status: 'reviewed' })],
      reviews: [
        {
          id: 'review-1',
          cycleId: 'cycle-1',
          effectiveDays: 2,
          missedDays: 1,
          blankDays: 4,
          factSummary: '很私密的事实',
          conclusion: '不要泄露',
          decision: 'archive',
          submittedAt: '2026-08-20T04:00:00.000Z',
        },
      ],
      energyEntries: [
        {
          id: 'energy-1',
          category: 'energy',
          occurredAt: '2026-08-09T04:00:00.000Z',
          event: '私密事件',
          feelingTags: ['私密标签'],
          energyDelta: 1,
          createdAt: '2026-08-09T04:00:00.000Z',
          updatedAt: '2026-08-09T04:00:00.000Z',
        },
      ],
    })

    await expect(exportFullBackup(state).text()).resolves.toContain('秘密标题')

    const summary = await exportValidationSummary(state).text()
    expect(summary).toContain('"itemsCreated": 1')
    expect(summary).toContain('"energyEntryCount": 1')
    expect(summary).toContain('"practicedDays": 2')
    expect(summary).toContain('"missedDays": 1')
    expect(summary).toContain('"blankDays": 4')
    expect(summary).not.toContain('秘密标题')
    expect(summary).not.toContain('私密事件')
    expect(summary).not.toContain('私密标签')
    expect(summary).not.toContain('很私密的事实')
  })
})
