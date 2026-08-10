import type { LifeLabState } from './types'

export function createEmptyState(now = new Date()): LifeLabState {
  const instant = now.toISOString()
  return {
    schemaVersion: 2,
    meta: {
      createdAt: instant,
      updatedAt: instant,
      hasSeenLocalDataNotice: false,
    },
    items: [],
    cycles: [],
    dailyEntries: [],
    reviews: [],
    longTermEntries: [],
    energyEntries: [],
  }
}
