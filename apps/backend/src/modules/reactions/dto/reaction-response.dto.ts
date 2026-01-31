export interface ReactionSummary {
  emoji: string
  count: number
}

export interface ReactionResponse {
  reactions: ReactionSummary[]
  total: number
}

export interface UserReactionsResponse {
  emojis: string[]
}

export interface ReactionToggleResponse {
  reacted: boolean
  emoji: string
  message: string
}
