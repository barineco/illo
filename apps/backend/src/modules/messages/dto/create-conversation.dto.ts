import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateConversationDto {
  @IsNotEmpty()
  @IsString()
  recipientId: string // User ID of the recipient (1-on-1 only)

  @IsOptional()
  @IsString()
  initialMessage?: string // First message content (optional)
}
