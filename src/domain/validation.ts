import { isLocalDate } from './dates'
import { DomainError, type EnergyDelta, type Track } from './types'

type RuleResult = { ok: true } | { ok: false; message: string }

export function normalizeOptionalText(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.trim()
  if (!normalized) {
    return undefined
  }
  assertMaxLength(normalized, maxLength)
  return normalized
}

export function normalizeRequiredText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new DomainError('invalid_input', `${field} is required`)
  }
  assertMaxLength(normalized, maxLength)
  return normalized
}

export function validateTrack(value: string): asserts value is Track {
  if (value !== 'ideal_self' && value !== 'side_hustle') {
    throw new DomainError('invalid_input', 'track is invalid')
  }
}

export function validateLocalDate(value: string, field = 'date'): void {
  if (!isLocalDate(value)) {
    throw new DomainError('invalid_input', `${field} must be YYYY-MM-DD`)
  }
}

export function validateEnergyDelta(value: number): asserts value is EnergyDelta {
  if (![-2, -1, 0, 1, 2].includes(value)) {
    throw new DomainError('invalid_input', 'energyDelta must be between -2 and 2')
  }
}

export function normalizeTags(tags: string[] | undefined, maxCount = 5, maxLength = 12): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const tag of tags ?? []) {
    const trimmed = tag.trim()
    if (!trimmed || seen.has(trimmed)) {
      continue
    }
    assertMaxLength(trimmed, maxLength)
    normalized.push(trimmed)
    seen.add(trimmed)
  }

  if (normalized.length > maxCount) {
    throw new DomainError('invalid_input', `tags cannot exceed ${maxCount}`)
  }

  return normalized
}

export function collectValidation(results: RuleResult[]): string[] {
  return results.flatMap((result) => (result.ok ? [] : [result.message]))
}

function assertMaxLength(value: string, maxLength: number): void {
  if (value.length > maxLength) {
    throw new DomainError('invalid_input', `text cannot exceed ${maxLength} characters`)
  }
}
