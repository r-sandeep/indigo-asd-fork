import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDateOnlyLocal,
  isDateOnlyExpiredLocal,
  isDateOnlyExpiringSoonLocal,
} from '../.tmp-tests/subsCoiDate.js'

test('formats date-only COI dates on the local calendar date', () => {
  assert.equal(formatDateOnlyLocal('2026-07-21'), 'Jul 21, 2026')
})

test('yesterday is expired and not expiring soon', () => {
  const now = new Date(2026, 6, 21, 12)
  assert.equal(isDateOnlyExpiredLocal('2026-07-20', now), true)
  assert.equal(isDateOnlyExpiringSoonLocal('2026-07-20', 30, now), false)
})

test('today remains valid and expiring soon throughout the local day', () => {
  const morning = new Date(2026, 6, 21, 0, 1)
  const night = new Date(2026, 6, 21, 23, 59)
  assert.equal(isDateOnlyExpiredLocal('2026-07-21', morning), false)
  assert.equal(isDateOnlyExpiredLocal('2026-07-21', night), false)
  assert.equal(isDateOnlyExpiringSoonLocal('2026-07-21', 30, night), true)
})

test('tomorrow and 30 days ahead are expiring soon, 31 days ahead is not', () => {
  const now = new Date(2026, 6, 21, 12)
  assert.equal(isDateOnlyExpiringSoonLocal('2026-07-22', 30, now), true)
  assert.equal(isDateOnlyExpiringSoonLocal('2026-08-20', 30, now), true)
  assert.equal(isDateOnlyExpiringSoonLocal('2026-08-21', 30, now), false)
})

test('local calendar boundary stays valid until the next local day regardless of the instant time', () => {
  const lateLocalDay = new Date(2026, 6, 21, 23, 30)
  const nextLocalDay = new Date(2026, 6, 22, 0, 0)

  assert.equal(formatDateOnlyLocal('2026-07-21'), 'Jul 21, 2026')
  assert.equal(isDateOnlyExpiredLocal('2026-07-21', lateLocalDay), false)
  assert.equal(isDateOnlyExpiredLocal('2026-07-21', nextLocalDay), true)
})