import { NotificationType } from '@prisma/client'

export class NotificationDto {
  id: string
  userId: string
  type: NotificationType
  actorId: string
  actor: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
    domain: string | null
  }
  artworkId?: string | null
  artwork?: {
    id: string
    title: string
    images: Array<{
      thumbnailUrl: string
    }>
  } | null
  commentId?: string | null
  comment?: {
    id: string
    content: string
  } | null
  likeId?: string | null
  followId?: string | null
  isRead: boolean
  readAt: Date | null
  createdAt: Date
}
