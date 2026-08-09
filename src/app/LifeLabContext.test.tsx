import { describe, expect, it } from 'vitest'
import { createEmptyState } from '../domain/fixtures'
import { makeCycle, makeItem, makeState } from '../domain/testUtils'
import { lifeLabReducer } from './LifeLabContext'

describe('lifeLabReducer', () => {
  it('loads and refreshes temporal state on startup', () => {
    const state = makeState({
      items: [makeItem({ status: 'exploring' })],
      cycles: [
        makeCycle({
          status: 'active',
          startDate: '2026-08-01',
          endDate: '2026-08-07',
        }),
      ],
    })

    const next = lifeLabReducer(
      { status: 'loading', state: null, loadResult: null, lastSaveResult: null },
      { type: 'loaded', result: { ok: true, source: 'existing', state } },
    )

    expect(next.status).toBe('ready')
    expect(next.state?.cycles[0].status).toBe('review_due')
    expect(next.state?.items[0].status).toBe('review_due')
  })

  it('keeps corrupt load results out of app state', () => {
    const next = lifeLabReducer(
      { status: 'loading', state: null, loadResult: null, lastSaveResult: null },
      {
        type: 'loaded',
        result: { ok: false, reason: 'invalid_json', message: 'bad json', raw: '{bad' },
      },
    )

    expect(next.status).toBe('load_error')
    expect(next.state).toBeNull()
  })

  it('does not replace in-memory state when persistence fails', () => {
    const current = createEmptyState(new Date('2026-08-09T04:00:00.000Z'))
    const attempted = makeState({ items: [makeItem()] })

    const next = lifeLabReducer(
      { status: 'ready', state: current, loadResult: null, lastSaveResult: null },
      {
        type: 'replace_state',
        next: attempted,
        saveResult: { ok: false, reason: 'write_failed', message: 'nope' },
      },
    )

    expect(next.state).toBe(current)
    expect(next.lastSaveResult).toMatchObject({ ok: false, reason: 'write_failed' })
  })

  it('replaces state only after persistence succeeds', () => {
    const current = createEmptyState(new Date('2026-08-09T04:00:00.000Z'))
    const attempted = makeState({ items: [makeItem()] })

    const next = lifeLabReducer(
      { status: 'ready', state: current, loadResult: null, lastSaveResult: null },
      {
        type: 'replace_state',
        next: attempted,
        saveResult: { ok: true },
      },
    )

    expect(next.state).toBe(attempted)
  })

  it('replaces state after delete-all persistence succeeds', () => {
    const current = makeState({ items: [makeItem()] })
    const nextState = createEmptyState(new Date('2026-08-10T04:00:00.000Z'))

    const next = lifeLabReducer(
      { status: 'ready', state: current, loadResult: null, lastSaveResult: null },
      { type: 'delete_all', next: nextState, saveResult: { ok: true } },
    )

    expect(next.state).toBe(nextState)
    expect(next.state?.items).toEqual([])
  })
})
