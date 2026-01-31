/**
 * Custom backoff delays for activity delivery
 * Matches the original implementation: 1min, 5min, 30min, 2hr
 */
export function getActivityDeliveryBackoffDelay(attemptsMade: number): number {
  const delays = [
    60000, // 1 minute
    300000, // 5 minutes
    1800000, // 30 minutes
    7200000, // 2 hours
  ]
  return delays[Math.min(attemptsMade, delays.length - 1)]
}

/**
 * Default job options for activity delivery queue
 */
export const ACTIVITY_DELIVERY_JOB_OPTIONS = {
  attempts: 4,
  backoff: {
    type: 'exponential' as const,
    delay: 60000, // Start at 1 minute
  },
}
