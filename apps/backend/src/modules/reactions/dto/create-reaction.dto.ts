import { IsString, IsNotEmpty, MaxLength } from 'class-validator'

export class CreateReactionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  emoji: string
}
