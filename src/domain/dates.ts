import type { ExperimentCycle, LocalDate } from './types'

const localDatePattern = /^\d{4}-\d{2}-\d{2}$/

export function isLocalDate(value: string): value is LocalDate {
  if (!localDatePattern.test(value)) {
    return false
  }

  const [year, month, day] = parseLocalDateParts(value)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function toLocalDate(date: Date): LocalDate {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayLocalDate(now = new Date()): LocalDate {
  return toLocalDate(now)
}

export function addCalendarDays(date: LocalDate, days: number): LocalDate {
  assertLocalDate(date)
  const [year, month, day] = parseLocalDateParts(date)
  const result = new Date(year, month - 1, day)
  result.setDate(result.getDate() + days)
  return toLocalDate(result)
}

export function getCycleEndDate(startDate: LocalDate): LocalDate {
  return addCalendarDays(startDate, 6)
}

export function nextLocalDate(date: LocalDate): LocalDate {
  return addCalendarDays(date, 1)
}

export function compareLocalDate(left: LocalDate, right: LocalDate): number {
  assertLocalDate(left)
  assertLocalDate(right)
  return left.localeCompare(right)
}

export function isWithinInclusive(date: LocalDate, start: LocalDate, end: LocalDate): boolean {
  return compareLocalDate(date, start) >= 0 && compareLocalDate(date, end) <= 0
}

export function enumerateLocalDates(start: LocalDate, end: LocalDate): LocalDate[] {
  if (compareLocalDate(start, end) > 0) {
    return []
  }

  const dates: LocalDate[] = []
  let current = start
  while (compareLocalDate(current, end) <= 0) {
    dates.push(current)
    current = addCalendarDays(current, 1)
  }
  return dates
}

export function getRecordableDateRange(
  cycle: ExperimentCycle,
  today: LocalDate,
): { startDate: LocalDate; endDate: LocalDate } | null {
  if (cycle.status !== 'active') {
    return null
  }

  if (compareLocalDate(today, cycle.startDate) < 0) {
    return null
  }

  return {
    startDate: cycle.startDate,
    endDate: compareLocalDate(today, cycle.endDate) < 0 ? today : cycle.endDate,
  }
}

export function canRecordCycleDate(cycle: ExperimentCycle, date: LocalDate, today: LocalDate): boolean {
  const range = getRecordableDateRange(cycle, today)
  return Boolean(range && date === today && isWithinInclusive(date, range.startDate, range.endDate))
}

function parseLocalDateParts(value: LocalDate | string): [number, number, number] {
  return value.split('-').map(Number) as [number, number, number]
}

function assertLocalDate(value: string): asserts value is LocalDate {
  if (!isLocalDate(value)) {
    throw new Error(`Invalid LocalDate: ${value}`)
  }
}
