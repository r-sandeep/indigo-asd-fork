/**
 * Money utilities.
 * All internal values are integer cents.
 * Never do arithmetic on formatted strings.
 */

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const USD_CENTS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Format cents as "$1,234" (no cents shown when .00) */
export function formatMoney(cents: number): string {
  const dollars = cents / 100
  return dollars % 1 === 0 ? USD.format(dollars) : USD_CENTS.format(dollars)
}

/** Format cents always showing cents: "$1,234.56" */
export function formatMoneyFull(cents: number): string {
  return USD_CENTS.format(cents / 100)
}

/** Convert dollars (float) to cents (integer) */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/** Convert cents to dollars float */
export function centsToDollars(cents: number): number {
  return cents / 100
}

/** Add a percentage to a cents amount. Returns cents. */
export function addPercent(cents: number, percent: number): number {
  return Math.round(cents * (1 + percent / 100))
}

/** Calculate variance: actual - budgeted. Positive = over budget. */
export function variance(actual: number, budgeted: number): number {
  return actual - budgeted
}

/** True if amount is over budget by more than the given threshold percent */
export function isOverBudget(actual: number, budgeted: number, thresholdPercent = 0): boolean {
  if (budgeted === 0) return actual > 0
  return (actual - budgeted) / budgeted > thresholdPercent / 100
}
