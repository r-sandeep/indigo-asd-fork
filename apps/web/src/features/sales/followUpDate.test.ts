import test from 'node:test'
import assert from 'node:assert/strict'
import { formatRelativeFollowUpDate, isFollowUpOverdue } from './followUpDate.ts'

test('due today stays Today and is not overdue', () => {
  const now = new Date('2026-07-21T12:00:00-07:00')

  assert.equal(formatRelativeFollowUpDate('2026-07-21', now), 'Today')
  assert.equal(isFollowUpOverdue('2026-07-21', now), false)
})

test('yesterday is overdue', () => {
  const now = new Date('2026-07-21T12:00:00-07:00')

  assert.equal(formatRelativeFollowUpDate('2026-07-20', now), 'Yesterday')
  assert.equal(isFollowUpOverdue('2026-07-20', now), true)
})

test('tomorrow is not overdue', () => {
  const now = new Date('2026-07-21T12:00:00-07:00')

  assert.equal(formatRelativeFollowUpDate('2026-07-22', now), 'Tomorrow')
  assert.equal(isFollowUpOverdue('2026-07-22', now), false)
})

test('utc/local boundary does not mark local today overdue', () => {
  const now = new Date('2026-07-21T00:30:00-07:00')

  assert.equal(formatRelativeFollowUpDate('2026-07-21', now), 'Today')
  assert.equal(isFollowUpOverdue('2026-07-21', now), false)
})

test('missing follow-up date stays unset and is not overdue', () => {
  assert.equal(formatRelativeFollowUpDate(null), null)
  assert.equal(isFollowUpOverdue(null), false)
})