import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class SendMessageDto {
  @IsNotEmpty()
  @IsString()
  content: string

  @IsOptional()
  @IsString()
  replyToId?: string // Reply to a specific message
}
