export interface ActivityDeliveryJobData {
  // Unique delivery log ID for tracking
  deliveryLogId: string

  // Sender information
  senderId: string

  // Target inbox
  inboxUrl: string

  // Activity payload
  activity: Record<string, unknown>
  activityType: string
}

export interface ActivityDeliveryResult {
  success: boolean
  statusCode?: number
  error?: string
}
