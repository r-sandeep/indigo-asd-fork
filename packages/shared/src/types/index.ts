/** Domain-level types that are not raw DB rows */

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/** GGB business line — matches jobs.project_type */
export type ProjectType = 'custom' | 'express'

/** Canonical status color mapping for UI badges */
export type StatusColor = 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'purple'

export interface StatusConfig {
  label: string
  color: StatusColor
}
